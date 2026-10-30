import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { headerToVar, isValidEmail, normalizeHeader } from "@/lib/automation/merge.server";

// ============= Campaigns =============

export const createAutomationCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name?: string; subject?: string; bodyHtml?: string; mailboxId?: string; defaultCc?: string; defaultBcc?: string; consentSource?: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: campaign, error } = await sb
      .from("automation_campaigns")
      .insert({
        user_id: context.userId,
        name: data.name?.trim() || "Untitled campaign",
        subject: data.subject ?? "",
        body_html: data.bodyHtml ?? "",
        mailbox_id: data.mailboxId ?? null,
        default_cc: data.defaultCc ?? null,
        default_bcc: data.defaultBcc ?? null,
        consent_confirmed: true,
        consent_source: data.consentSource ?? "imported-list",
        status: "draft",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Seed the follow-up steps: initial + FU1..FU4, 3 days apart, draft mode.
    const stages = ["initial", "fu1", "fu2", "fu3", "fu4"] as const;
    const { error: stepErr } = await sb.from("automation_steps").insert(
      stages.map((stage) => ({
        user_id: context.userId,
        campaign_id: campaign.id,
        stage,
        enabled: stage === "initial" ? true : true,
        delay_days: 3,
        delivery_mode: "draft" as const,
      })),
    );
    if (stepErr) throw new Error(stepErr.message);
    await sb.from("automation_events").insert({
      user_id: context.userId,
      campaign_id: campaign.id,
      event_type: "campaign_created",
      detail: { name: campaign.name },
    });
    return campaign;
  });

export const listAutomationCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: campaigns, error } = await sb
      .from("automation_campaigns")
      .select("id, name, status, mailbox_id, last_activity_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Batched aggregate counts (three small grouped queries, not per-campaign loops).
    const ids = (campaigns ?? []).map((c) => c.id);
    if (ids.length === 0) return [];
    const [{ data: contactRows }, { data: messageRows }, { data: stepRows }] = await Promise.all([
      sb.from("automation_contacts").select("campaign_id, status").in("campaign_id", ids),
      sb.from("automation_messages").select("campaign_id, direction, kind").in("campaign_id", ids),
      sb.from("automation_drafts").select("campaign_id, stage, status").in("campaign_id", ids),
    ]);

    type Agg = {
      total: number; sent: number; replies: number; bounces: number; suppressed: number; pendingFu: number;
      initialDrafts: number; initialSent: number;
    };
    const agg = new Map<string, Agg>();
    const fresh = (): Agg => ({ total: 0, sent: 0, replies: 0, bounces: 0, suppressed: 0, pendingFu: 0, initialDrafts: 0, initialSent: 0 });
    for (const r of contactRows ?? []) {
      const a = agg.get(r.campaign_id) ?? fresh();
      a.total++;
      if (r.status === "sent" || r.status === "completed") a.sent++;
      if (r.status === "replied") a.replies++;
      if (r.status === "bounced") a.bounces++;
      if (r.status === "suppressed") a.suppressed++;
      if (r.status === "fu_pending") a.pendingFu++;
      agg.set(r.campaign_id, a);
    }
    for (const r of messageRows ?? []) {
      const a = agg.get(r.campaign_id) ?? fresh();
      if (r.direction === "out" && r.kind === "initial") a.initialSent++;
      agg.set(r.campaign_id, a);
    }
    for (const r of stepRows ?? []) {
      const a = agg.get(r.campaign_id) ?? fresh();
      if (r.stage === "initial" && (r.status === "created" || r.status === "regenerated")) a.initialDrafts++;
      agg.set(r.campaign_id, a);
    }

    return (campaigns ?? []).map((c) => ({
      ...c,
      stats: agg.get(c.id) ?? fresh(),
    }));
  });

export const getAutomationCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [{ data: campaign }, { data: steps }, { data: mailbox }] = await Promise.all([
      sb.from("automation_campaigns").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle(),
      sb.from("automation_steps").select("*").eq("campaign_id", data.id).eq("user_id", context.userId).order("stage"),
      sb.from("mailbox_connections").select("id, email, status").eq("user_id", context.userId).eq("status", "active"),
    ]);
    if (!campaign) throw new Error("Campaign not found");
    return { campaign, steps: steps ?? [], mailboxes: mailbox ?? [] };
  });

export const updateAutomationCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const allowed = [
      "name", "subject", "body_html", "mailbox_id", "default_cc", "default_bcc",
      "attachments", "consent_source", "status", "consent_confirmed",
    ];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in data.patch) patch[k] = data.patch[k];
    const { error } = await context.supabase
      .from("automation_campaigns")
      .update(patch as any)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateAutomationCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: src } = await sb
      .from("automation_campaigns").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!src) throw new Error("Campaign not found");
    const { data: copy, error } = await sb
      .from("automation_campaigns")
      .insert({ ...src, id: undefined, name: `${src.name} (copy)`, status: "draft", created_at: undefined, updated_at: undefined, last_activity_at: null })
      .select().single();
    if (error) throw new Error(error.message);
    const { data: steps } = await sb.from("automation_steps").select("*").eq("campaign_id", data.id);
    if (steps?.length) {
      await sb.from("automation_steps").insert(steps.map((s) => ({ ...s, id: undefined, campaign_id: copy.id, created_at: undefined, updated_at: undefined })));
    }
    return copy;
  });

export const saveAutomationStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; stage: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const allowed = ["enabled", "delay_days", "subject", "body_html", "attachments", "delivery_mode"];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in data.patch) patch[k] = data.patch[k];
    const { error } = await context.supabase
      .from("automation_steps")
      .update(patch as any)
      .eq("campaign_id", data.campaignId)
      .eq("stage", data.stage as any)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Contacts =============

export const listAutomationContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; page?: number; pageSize?: number }) => d)
  .handler(async ({ data, context }) => {
    const page = Math.max(0, data.page ?? 0);
    const pageSize = Math.min(200, Math.max(10, data.pageSize ?? 50));
    const sb = context.supabase;
    const [{ data: rows, error }, { count }] = await Promise.all([
      sb.from("automation_contacts")
        .select("*")
        .eq("campaign_id", data.campaignId)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1),
      sb.from("automation_contacts").select("id", { count: "exact", head: true }).eq("campaign_id", data.campaignId).eq("user_id", context.userId),
    ]);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page, pageSize };
  });

export const upsertAutomationContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; contact: { id?: string; email: string; name?: string; first_name?: string; name2?: string; company?: string; role?: string; cc?: string; bcc?: string; followup_cc?: boolean; custom?: Record<string, string> } }) => d)
  .handler(async ({ data, context }) => {
    const email = data.contact.email.trim().toLowerCase();
    if (!isValidEmail(email)) throw new Error(`Invalid email address: ${email}`);
    const row = {
      user_id: context.userId,
      campaign_id: data.campaignId,
      email,
      name: data.contact.name ?? null,
      first_name: data.contact.first_name ?? null,
      name2: data.contact.name2 ?? null,
      company: data.contact.company ?? null,
      role: data.contact.role ?? null,
      cc: data.contact.cc ?? null,
      bcc: data.contact.bcc ?? null,
      followup_cc: data.contact.followup_cc ?? false,
      custom: data.contact.custom ?? {},
    };
    if (data.contact.id) {
      const { error } = await context.supabase.from("automation_contacts").update(row).eq("id", data.contact.id).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("automation_contacts").insert(row);
    if (error) {
      if (error.code === "23505") throw new Error(`${email} is already in this campaign`);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteAutomationContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; contactId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_contacts").delete().eq("id", data.contactId).eq("campaign_id", data.campaignId).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// CSV import: the client parses the file, sends headers + mapped rows.
// Headers are dynamically recognised (no fixed variable list); known columns
// map to structured fields, everything else lands in `custom`.
export const importAutomationContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; headers: string[]; rows: Record<string, string>[] }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const fieldMap: Record<string, string> = {
      email: "email", name: "name", "name 2": "name2", "first name": "first_name",
      company: "company", role: "role", cc: "cc", bcc: "bcc",
      "follow-up cc": "followup_cc", "followup cc": "followup_cc",
    };
    const colPlan = data.headers.map((h) => {
      const key = normalizeHeader(h);
      const mapped = fieldMap[key];
      return { header: h, key, mapped, customKey: mapped ? null : key };
    });

    const customCols = colPlan.filter((c) => c.customKey).map((c) => c.key);
    const rows = data.rows.map((r) => {
      const contact: Record<string, unknown> = { custom: {} as Record<string, string> };
      for (const c of colPlan) {
        const v = r[c.header] ?? "";
        if (c.mapped === "followup_cc") contact.followup_cc = /^(y|yes|true|1)$/i.test(v.trim());
        else if (c.mapped) contact[c.mapped] = v || null;
        else if (c.customKey) (contact.custom as Record<string, string>)[c.customKey] = v;
      }
      return contact;
    });

    const results = { imported: 0, invalid: 0, duplicates: 0, invalidEmails: [] as string[] };
    const toInsert = [];
    for (const r of rows) {
      const email = String(r.email ?? "").trim().toLowerCase();
      if (!isValidEmail(email)) {
        results.invalid++;
        if (results.invalidEmails.length < 5 && email) results.invalidEmails.push(email || "(empty)");
        continue;
      }
      const clean: Record<string, unknown> = { ...r };
      delete (clean as Record<string, unknown>).email;
      toInsert.push({ user_id: context.userId, campaign_id: data.campaignId, email, ...clean });
    }
    // Chunked inserts; duplicates inside the campaign are skipped via upsert-ignore.
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const { data: inserted, error } = await sb
        .from("automation_contacts").insert(chunk).select("id");
      if (error) {
        if (error.code === "23505") {
          results.duplicates += chunk.length;
        } else throw new Error(error.message);
      } else results.imported += inserted?.length ?? 0;
    }
    return results;
  });

// ============= Activity + suppression registry =============

export const listAutomationEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId?: string; eventType?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("automation_events")
      .select("id, campaign_id, contact_id, event_type, detail, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(Math.min(200, data.limit ?? 50));
    if (data.campaignId) q = q.eq("campaign_id", data.campaignId);
    if (data.eventType) q = q.eq("event_type", data.eventType as any);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAutomationSuppressions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("automation_suppressions")
      .select("id, email, reason, note, campaign_id, created_at, removed_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addAutomationSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; reason: string; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!isValidEmail(email)) throw new Error(`Invalid email address: ${email}`);
    const { error } = await context.supabase
      .from("automation_suppressions")
      .upsert(
        { user_id: context.userId, email, reason: data.reason as any, note: data.note ?? null, removed_at: null },
        { onConflict: "user_id,email" },
      );
    if (error) throw new Error(error.message);
    // Suppress matching contacts across all campaigns (only pending ones).
    await context.supabase
      .from("automation_contacts")
      .update({ status: "suppressed", updated_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("email", email)
      .in("status", ["pending", "fu_pending", "draft_created"]);
    await context.supabase.from("automation_events").insert({
      user_id: context.userId, event_type: "contact_suppressed",
      detail: { email, reason: data.reason, manual: true },
    });
    return { ok: true };
  });

export const removeAutomationSuppression = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_suppressions")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
