import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applyVars,
  buildRawMime,
  getActiveAccessToken,
  htmlToPlain,
  loadUserMailbox,
  refreshAccessToken,
  sendGmailRaw,
  wrapHtml,
} from "./gmail-send.server";
import { listUnsubscribeHeaders } from "./compliance-footer";

const createInput = z.object({
  name: z.string().trim().min(1).max(160),
  listId: z.string().uuid(),
  subject: z.string().trim().min(1).max(500),
  bodyHtml: z.string().min(1).max(500_000),
  fromName: z.string().trim().max(160).optional(),
  throttleSeconds: z.number().int().min(0).max(120).default(8),
  dailyCap: z.number().int().min(1).max(2000).default(200),
});

function randToken() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

function publicSiteOrigin() {
  return process.env.PUBLIC_SITE_URL || "https://carrotmails.lovable.app";
}

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("campaigns")
      .select(
        "id, name, subject, status, total_count, sent_count, failed_count, replied_count, unsubscribed_count, created_at, updated_at, list_id, throttle_seconds, daily_cap",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: c, error } = await context.supabase
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Campaign not found");
    const { data: recipients } = await context.supabase
      .from("campaign_recipients")
      .select("id, email, status, sent_at, error")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: true })
      .limit(500);
    return { campaign: c, recipients: recipients ?? [] };
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createInput.parse(i))
  .handler(async ({ data, context }) => {
    // Consent gate: list must be marked as opt-in.
    const { data: listRow, error: listErr } = await context.supabase
      .from("contact_lists")
      .select("id, consent_confirmed, consent_source")
      .eq("id", data.listId)
      .maybeSingle();
    if (listErr) throw new Error(listErr.message);
    if (!listRow) throw new Error("Selected list not found");
    if (!listRow.consent_confirmed) {
      throw new Error("This list is not marked as opt-in. Open Lists, edit the list, and confirm every recipient consented.");
    }

    // pull contacts for the list
    const { data: contacts, error: cErr } = await context.supabase
      .from("contacts")
      .select("email, vars")
      .eq("list_id", data.listId);
    if (cErr) throw new Error(cErr.message);
    if (!contacts || contacts.length === 0) throw new Error("Selected list has no contacts");

    // filter against suppressions
    const emails = contacts.map((c) => c.email.toLowerCase());
    const suppressed = new Set<string>();
    for (let i = 0; i < emails.length; i += 500) {
      const { data: s } = await context.supabase
        .from("suppressions")
        .select("email")
        .in("email", emails.slice(i, i + 500));
      s?.forEach((r) => suppressed.add(r.email.toLowerCase()));
    }
    const clean = contacts.filter((c) => !suppressed.has(c.email.toLowerCase()));
    if (clean.length === 0) throw new Error("All contacts in this list are suppressed");

    const mailbox = await loadUserMailbox(context.userId);
    const { data: campaign, error: campErr } = await context.supabase
      .from("campaigns")
      .insert({
        user_id: context.userId,
        name: data.name,
        subject: data.subject,
        body_html: data.bodyHtml,
        from_name: data.fromName ?? null,
        list_id: data.listId,
        mailbox_id: mailbox?.id ?? null,
        throttle_seconds: data.throttleSeconds,
        daily_cap: data.dailyCap,
        total_count: clean.length,
        status: "draft",
        consent_confirmed: true,
        consent_source: listRow.consent_source,
        consent_confirmed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (campErr) throw new Error(campErr.message);

    const rows = clean.map((c) => ({
      campaign_id: campaign.id,
      user_id: context.userId,
      email: c.email.toLowerCase(),
      vars: c.vars ?? {},
      unsubscribe_token: randToken(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await context.supabase
        .from("campaign_recipients")
        .insert(rows.slice(i, i + 500));
      if (error) {
        await context.supabase.from("campaigns").delete().eq("id", campaign.id);
        throw new Error(error.message);
      }
    }
    return campaign;
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pauseCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("campaigns")
      .update({ status: "paused" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Dispatch processes up to MAX_PER_CALL pending recipients in one invocation.
// The UI keeps calling this until the campaign is done or paused.
const MAX_PER_CALL = 40;

export const dispatchCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: c, error: cErr } = await context.supabase
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Campaign not found");
    if (c.status === "paused") return { processed: 0, remaining: 0, status: "paused" as const };

    // paid check: only paid users can launch campaigns (campaigns can be large)
    const { data: ent } = await context.supabase
      .from("billing_entitlements")
      .select("active, expires_at")
      .eq("user_id", context.userId)
      .eq("active", true);
    const paid = (ent ?? []).some(
      (i: { active: boolean; expires_at: string | null }) =>
        i.active && (!i.expires_at || new Date(i.expires_at).getTime() > Date.now()),
    );
    if (!paid) {
      throw new Error("Campaigns require a Premium or Lifetime plan. Upgrade in Billing to launch.");
    }

    const mailbox = await loadUserMailbox(context.userId);
    if (!mailbox) throw new Error("Connect a Gmail mailbox before launching");

    // mark as sending
    if (c.status !== "sending") {
      await context.supabase.from("campaigns").update({ status: "sending" }).eq("id", c.id);
    }

    // pick a batch of pending recipients
    const { data: pending, error: pErr } = await context.supabase
      .from("campaign_recipients")
      .select("id, email, vars, unsubscribe_token")
      .eq("campaign_id", c.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(MAX_PER_CALL);
    if (pErr) throw new Error(pErr.message);

    let accessToken = "";
    try {
      accessToken = await getActiveAccessToken(mailbox);
    } catch (e) {
      throw new Error((e as Error).message);
    }

    let sent = 0;
    let failed = 0;
    const origin = publicSiteOrigin();
    const fromHeader = c.from_name ? `${c.from_name} <${mailbox.email}>` : mailbox.email;

    for (const r of pending ?? []) {
      const vars: Record<string, string> = { email: r.email, ...(r.vars as Record<string, string>) };
      const subject = applyVars(c.subject, vars);
      const inner = applyVars(c.body_html, vars);
      const unsubUrl = `${origin}/u/${r.unsubscribe_token}`;
      const footer = `You're receiving this because you opted in. <a href="${unsubUrl}" style="color:#888">Unsubscribe</a>.`;
      const html = wrapHtml(inner, footer);
      const text = `${htmlToPlain(inner)}\n\n— Unsubscribe: ${unsubUrl}`;
      const raw = buildRawMime(fromHeader, r.email, subject, html, text, [], listUnsubscribeHeaders(unsubUrl));

      let resp = await sendGmailRaw(accessToken, raw);
      if (resp.status === 401 && mailbox.refresh_token) {
        try {
          const refreshed = await refreshAccessToken(mailbox.refresh_token);
          accessToken = refreshed.access_token;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin
            .from("mailbox_connections")
            .update({
              access_token: refreshed.access_token,
              expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            })
            .eq("id", mailbox.id);
          resp = await sendGmailRaw(accessToken, raw);
        } catch (e) {
          // fall through to error path
        }
      }

      if (resp.ok) {
        const json: { id?: string; threadId?: string } = await resp.json().catch(() => ({}));
        await context.supabase
          .from("campaign_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            message_id: json.id ?? null,
            thread_id: json.threadId ?? null,
            error: null,
          })
          .eq("id", r.id);
        await context.supabase.from("email_send_events").insert({
          user_id: context.userId,
          mailbox_id: mailbox.id,
          recipient_email: r.email,
        });
        sent += 1;
      } else {
        const txt = (await resp.text()).slice(0, 300);
        await context.supabase
          .from("campaign_recipients")
          .update({ status: "failed", error: `${resp.status} ${txt}` })
          .eq("id", r.id);
        failed += 1;
      }

      // increment counters
      await context.supabase
        .from("campaigns")
        .update({
          sent_count: (c.sent_count ?? 0) + sent,
          failed_count: (c.failed_count ?? 0) + failed,
        })
        .eq("id", c.id);

      // small throttle inside batch (cap to keep request snappy)
      const ms = Math.min(c.throttle_seconds ?? 0, 5) * 1000;
      if (ms > 0) await new Promise((res) => setTimeout(res, ms));
    }

    // check remaining
    const { count: remaining } = await context.supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id)
      .eq("status", "pending");

    let status: "sending" | "done" | "paused" = "sending";
    if ((remaining ?? 0) === 0) {
      status = "done";
      await context.supabase.from("campaigns").update({ status: "done" }).eq("id", c.id);
    }

    return { processed: (pending ?? []).length, sent, failed, remaining: remaining ?? 0, status };
  });

// PUBLIC unsubscribe (no auth) — used by the public /u/$token route.
export const unsubscribeByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().min(8).max(64) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rec, error } = await supabaseAdmin
      .from("campaign_recipients")
      .select("id, email, user_id, campaign_id, status")
      .eq("unsubscribe_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rec) return { ok: false, email: null };
    if (rec.status !== "unsubscribed") {
      await supabaseAdmin
        .from("campaign_recipients")
        .update({ status: "unsubscribed" })
        .eq("id", rec.id);
      await supabaseAdmin
        .from("suppressions")
        .upsert(
          { user_id: rec.user_id, email: rec.email, reason: "unsubscribe" },
          { onConflict: "user_id,email" },
        );
    }
    return { ok: true, email: rec.email };
  });
