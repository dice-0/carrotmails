import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadUserMailbox, buildRawMime, htmlToPlain, type Attachment } from "@/lib/gmail-send.server";
import {
  createDraft, getDraftHeaders, deleteDraft, listMessages, getMessage, GmailApiError,
} from "@/lib/automation/gmail.server";
import {
  applyMergeTags, contactToValues, parseAddressList, invalidAddresses, type ContactValues,
} from "@/lib/automation/merge.server";

// ============= Shared helpers =============

type CampaignRow = {
  id: string; user_id: string; mailbox_id: string | null; name: string; subject: string;
  body_html: string; default_cc: string | null; default_bcc: string | null;
  attachments: Attachment[] | null; status: string; from_name: string | null;
};
type ContactRow = {
  id: string; email: string; name: string | null; first_name: string | null; name2: string | null;
  company: string | null; role: string | null; cc: string | null; bcc: string | null;
  followup_cc: boolean; status: string; custom: Record<string, string> | null;
  gmail_thread_id: string | null; last_sent_at: string | null; next_followup_at: string | null; error: string | null;
};
type StepRow = {
  stage: string; enabled: boolean; delay_days: number; subject: string | null;
  body_html: string; attachments: Attachment[] | null; delivery_mode: string;
};

async function loadCampaign(sb: ReturnType<typeof requireSupabaseAuth>["handler"] extends never ? never : any, userId: string, campaignId: string) {
  const { data: campaign, error } = await sb
    .from("automation_campaigns").select("*").eq("id", campaignId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) throw new Error("Campaign not found");
  return campaign as CampaignRow;
}

// Active suppression set for the user: automation-level entries plus the
// account-wide `suppressions` table (unsubscribes etc.). Fetched in bulk once.
async function loadSuppressionSet(sb: any, userId: string): Promise<Set<string>> {
  const [a, s] = await Promise.all([
    sb.from("automation_suppressions").select("email").eq("user_id", userId).is("removed_at", null).limit(10000),
    sb.from("suppressions").select("email").eq("user_id", userId).limit(10000),
  ]);
  const set = new Set<string>();
  for (const r of a.data ?? []) set.add(String(r.email).toLowerCase());
  for (const r of s.data ?? []) set.add(String(r.email).toLowerCase());
  return set;
}

async function logEvent(sb: any, userId: string, campaignId: string | null, contactId: string | null, eventType: string, detail: Record<string, unknown>) {
  await sb.from("automation_events").insert({ user_id: userId, campaign_id: campaignId, contact_id: contactId, event_type: eventType, detail });
}

function effectiveCc(contact: ContactRow, campaign: CampaignRow) {
  const ccList = contact.cc?.trim() ? parseAddressList(contact.cc) : parseAddressList(campaign.default_cc);
  const bccList = contact.bcc?.trim() ? parseAddressList(contact.bcc) : parseAddressList(campaign.default_bcc);
  return { ccList, bccList };
}

// ============= Audit (dry run) =============

export const runAutomationAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; stage?: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const campaign = await loadCampaign(sb, context.userId, data.campaignId);
    const stage = data.stage ?? "initial";
    const [{ data: contacts }, suppressionSet] = await Promise.all([
      sb.from("automation_contacts").select("*").eq("campaign_id", data.campaignId).eq("user_id", context.userId).order("created_at").limit(5000),
      loadSuppressionSet(sb, context.userId),
    ]);

    const step = (await sb.from("automation_steps").select("*").eq("campaign_id", data.campaignId).eq("stage", stage).eq("user_id", context.userId).maybeSingle()).data as StepRow | null;
    const { data: existingDrafts } = await sb
      .from("automation_drafts").select("contact_id, status").eq("campaign_id", data.campaignId).eq("stage", stage).eq("user_id", context.userId);
    const draftable = new Set((existingDrafts ?? []).filter((d: any) => d.status === "created" || d.status === "regenerated").map((d: any) => d.contact_id));

    const template = stage === "initial" ? campaign.subject : step?.subject ?? "";
    const body = stage === "initial" ? campaign.body_html : step?.body_html ?? "";

    const rows: {
      contact_id: string; email: string; eligible: boolean; reason?: string; cc: string[]; bcc: string[]; missingVars: string[];
    }[] = [];
    for (const c of (contacts ?? []) as ContactRow[]) {
      const reasons: string[] = [];
      if (c.status === "suppressed") reasons.push("Contact suppressed");
      if (suppressionSet.has(c.email)) reasons.push("Address on suppression list");
      if (draftable.has(c.id)) reasons.push("Draft already exists");
      const values = contactToValues(c);
      const { missing } = applyMergeTags(template, values);
      const { missing: missingBody } = applyMergeTags(body, values, { escapeHtml: false });
      const missingVars = Array.from(new Set([...missing, ...missingBody]));
      if (missingVars.length) reasons.push(`Missing personalisation: ${missingVars.join(", ")}`);
      const { ccList, bccList } = effectiveCc(c, campaign);
      const badCc = invalidAddresses(ccList);
      if (badCc.length) reasons.push(`Invalid CC: ${badCc.join(", ")}`);
      const badBcc = invalidAddresses(bccList);
      if (badBcc.length) reasons.push(`Invalid BCC: ${badBcc.join(", ")}`);
      rows.push({ contact_id: c.id, email: c.email, eligible: reasons.length === 0, reason: reasons[0], cc: ccList, bcc: bccList, missingVars });
    }
    const summary = {
      stage, total: rows.length,
      eligible: rows.filter((r) => r.eligible).length,
      blocked: rows.filter((r) => !r.eligible).length,
      created_at: new Date().toISOString(),
    };
    await sb.from("automation_audits").insert({ user_id: context.userId, campaign_id: data.campaignId, summary: { ...summary, rows: rows.filter((r) => !r.eligible).slice(0, 100) } });
    await logEvent(sb, context.userId, data.campaignId, null, "audit_run", summary);
    return { summary, rows };
  });

// ============= Gmail draft creation (initial emails) =============

// Creates Gmail drafts, one per eligible recipient. NEVER sends.
// Duplicate prevention: a live check for an existing open draft per
// (campaign, contact, stage) before every create.
export const createAutomationDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; stage?: string; contactIds?: string[]; batchLimit?: number }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const campaign = await loadCampaign(sb, context.userId, data.campaignId);
    const stage = data.stage ?? "initial";
    if (campaign.status === "archived") throw new Error("Campaign is archived");

    const mailbox = campaign.mailbox_id
      ? await sb.from("mailbox_connections").select("id, email, access_token, refresh_token, expires_at, status, provider, display_name").eq("id", campaign.mailbox_id).eq("user_id", context.userId).maybeSingle()
      : { data: await loadUserMailbox(context.userId) };
    if (!mailbox.data) throw new Error("No connected Gmail mailbox. Connect one in Mailboxes first.");
    const mb = mailbox.data as any;

    const step = (await sb.from("automation_steps").select("*").eq("campaign_id", data.campaignId).eq("stage", stage).eq("user_id", context.userId).maybeSingle()).data as StepRow | null;
    if (step && !step.enabled) throw new Error(`${stage.toUpperCase()} stage is disabled`);
    const subjectTemplate = stage === "initial" ? campaign.subject : step?.subject ?? "";
    const bodyTemplate = stage === "initial" ? campaign.body_html : step?.body_html ?? "";
    if (!subjectTemplate.trim() && !bodyTemplate.trim()) throw new Error("Nothing to draft: compose the email first");

    // Eligible contacts: unsuppressed, not yet drafted for this stage.
    const [{ data: contacts }, suppressionSet, { data: existingDrafts }] = await Promise.all([
      sb.from("automation_contacts").select("*").eq("campaign_id", data.campaignId).eq("user_id", context.userId)
        .order("created_at").limit(data.contactIds?.length ? 5000 : 2000),
      loadSuppressionSet(sb, context.userId),
      sb.from("automation_drafts").select("contact_id, status").eq("campaign_id", data.campaignId).eq("stage", stage).eq("user_id", context.userId),
    ]);
    const hasOpenDraft = new Set((existingDrafts ?? []).filter((d: any) => d.status === "created" || d.status === "regenerated").map((d: any) => d.contact_id));
    const targetIds = data.contactIds?.length ? new Set(data.contactIds) : null;

    const eligible = ((contacts ?? []) as ContactRow[]).filter((c) => {
      if (targetIds && !targetIds.has(c.id)) return false;
      if (stage === "initial" && c.status !== "pending") return false;
      if (stage !== "initial" && c.status !== "fu_pending") return false;
      return !hasOpenDraft.has(c.id) && !suppressionSet.has(c.email) && c.status !== "suppressed";
    });

    const limit = Math.min(data.batchLimit ?? 10, 25);
    const batch = eligible.slice(0, limit);

    const results: { email: string; ok: boolean; draftId?: string; ccVerified?: boolean; error?: string }[] = [];
    const attachments: Attachment[] = (stage === "initial" ? campaign.attachments : step?.attachments) ?? [];

    for (const c of batch) {
      const values: ContactValues = contactToValues(c);
      const subject = applyMergeTags(subjectTemplate, values).output;
      const bodyHtml = applyMergeTags(bodyTemplate, values, { escapeHtml: true }).output;
      if (!subject.trim() && !bodyHtml.trim()) {
        results.push({ email: c.email, ok: false, error: "Empty subject and body after personalisation" });
        continue;
      }
      const { ccList, bccList } = effectiveCc(c, campaign);
      const bad = invalidAddresses([...ccList, ...bccList]);
      if (bad.length) {
        results.push({ email: c.email, ok: false, error: `Invalid CC/BCC address: ${bad.join(", ")}` });
        await logEvent(sb, context.userId, campaign.id, c.id, "error", { kind: "invalid_cc", detail: bad });
        continue;
      }
      try {
        const fromHeader = campaign.from_name ? `${campaign.from_name} <${mb.email}>` : mb.email;
        const extraHeaders = [
          ...(ccList.length ? [`Cc: ${ccList.join(", ")}`] : []),
          ...(bccList.length ? [`Bcc: ${bccList.join(", ")}`] : []),
        ];
        const raw = buildRawMime(fromHeader, c.email, subject, bodyHtml, htmlToPlain(bodyHtml), attachments, extraHeaders);
        const draft = await createDraft(mb, raw, c.gmail_thread_id ? { threadId: c.gmail_thread_id } : {});
        // CC verification: read the saved draft back; a mismatched header is
        // deleted and reported as an error, never as success.
        let ccVerified = true;
        if (ccList.length) {
          const headers = await getDraftHeaders(mb, draft.id, ["Cc", "Bcc", "To"]);
          const savedCc = parseAddressList(headers["cc"] ?? "");
          const same = ccList.length === savedCc.length && ccList.every((a) => savedCc.some((b) => b.toLowerCase() === a.toLowerCase()));
          if (!same) {
            await deleteDraft(mb, draft.id).catch(() => {});
            ccVerified = false;
          }
        }
        if (!ccVerified) {
          results.push({ email: c.email, ok: false, error: "Gmail saved the draft with a different CC; it was deleted, try again" });
          await logEvent(sb, context.userId, campaign.id, c.id, "error", { kind: "cc_mismatch", expected: ccList });
          continue;
        }
        await sb.from("automation_drafts").upsert({
          user_id: context.userId, campaign_id: campaign.id, contact_id: c.id, stage,
          gmail_draft_id: draft.id, gmail_message_id: draft.message.id,
          thread_id: draft.message.threadId, expected_cc: ccList.join(", ") || null,
          cc_verified: ccList.length === 0 ? true : true, status: "created",
        }, { onConflict: "campaign_id,contact_id,stage" });
        await sb.from("automation_contacts").update({
          status: stage === "initial" ? "draft_created" : "fu_pending",
          last_stage: stage, updated_at: new Date().toISOString(),
        }).eq("id", c.id).eq("user_id", context.userId);
        await logEvent(sb, context.userId, campaign.id, c.id, "draft_created", { stage, draft_id: draft.id, cc: ccList });
        results.push({ email: c.email, ok: true, draftId: draft.id, ccVerified: true });
      } catch (e) {
        const err = e as Error;
        const msg = err instanceof GmailApiError ? err.message : err.message;
        results.push({ email: c.email, ok: false, error: msg });
        await logEvent(sb, context.userId, campaign.id, c.id, "error", { kind: "draft_creation", message: msg });
        if (err instanceof GmailApiError && (err.status === 401 || err.status === 403 || err.status === 429)) break;
      }
    }

    const remaining = Math.max(0, eligible.length - batch.length);
    return { created: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results, remaining };
  });

// Test draft: addressed to the connected mailbox owner only. Never sends,
// and deliberately omits CC/BCC so no external contact is copied.
export const createAutomationTestDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const campaign = await loadCampaign(sb, context.userId, data.campaignId);
    const mailbox = campaign.mailbox_id
      ? await sb.from("mailbox_connections").select("id, email, access_token, refresh_token, expires_at, status, provider, display_name").eq("id", campaign.mailbox_id).eq("user_id", context.userId).maybeSingle()
      : { data: await loadUserMailbox(context.userId) };
    if (!mailbox.data) throw new Error("No connected Gmail mailbox");
    const mb = mailbox.data as any;
    const raw = buildRawMime(
      campaign.from_name ? `${campaign.from_name} <${mb.email}>` : mb.email,
      mb.email,
      `[TEST] ${campaign.subject || campaign.name}`,
      campaign.body_html || "<p>(empty body)</p>",
      htmlToPlain(campaign.body_html || ""),
      [],
      [],
    );
    const draft = await createDraft(mb, raw);
    await logEvent(sb, context.userId, campaign.id, null, "draft_created", { stage: "test", draft_id: draft.id });
    return { ok: true, draftId: draft.id, to: mb.email };
  });

// ============= Manual-send reconciliation =============

function normalizeSubject(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/^(re|fwd):\s*/gi, "").trim();
}

// Detects drafts the user has manually sent from Gmail. Matching is
// conservative: exact recipient + normalised subject, sent after the draft
// was created; ambiguous cases are reported for manual reconciliation.
export const reconcileAutomationSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const campaign = await loadCampaign(sb, context.userId, data.campaignId);
    const mailbox = campaign.mailbox_id
      ? await sb.from("mailbox_connections").select("id, email, access_token, refresh_token, expires_at, status, provider").eq("id", campaign.mailbox_id).eq("user_id", context.userId).maybeSingle()
      : { data: await loadUserMailbox(context.userId) };
    if (!mailbox.data) throw new Error("No connected Gmail mailbox");
    const mb = mailbox.data as any;

    const { data: openDrafts } = await sb
      .from("automation_drafts")
      .select("id, contact_id, stage, created_at, gmail_draft_id")
      .eq("campaign_id", data.campaignId).eq("user_id", context.userId)
      .in("status", ["created", "regenerated"])
      .neq("stage", "test")
      .limit(200);
    if (!openDrafts?.length) return { reconciled: 0, ambiguous: 0, results: [] };

    const contactIds = openDrafts.map((d: any) => d.contact_id);
    const { data: contacts } = await sb.from("automation_contacts").select("id, email").in("id", contactIds).eq("user_id", context.userId);
    const contactById = new Map((contacts ?? []).map((c: any) => [c.id, c.email]));

    const steps: StepRow[] = (await sb.from("automation_steps").select("*").eq("campaign_id", data.campaignId).eq("user_id", context.userId)).data ?? [];
    const stepByStage = new Map(steps.map((s) => [s.stage, s]));

    const results: { email: string; stage: string; status: string }[] = [];
    for (const d of openDrafts as any[]) {
      const email = contactById.get(d.contact_id);
      if (!email) continue;
      // Only search the Sent mailbox; unsent drafts never count as outreach.
      const q = `in:sent to:${email} newer_than:30d`;
      const found = await listMessages(mb, { q, maxResults: 25 }).catch(() => ({ messages: [] as { id: string; threadId: string }[] }));
      const candidates: { id: string; threadId: string; date: number }[] = [];
      for (const m of found.messages ?? []) {
        const msg = await getMessage(mb, m.id) as any;
        const headers = Object.fromEntries((msg.payload?.headers ?? []).map((h: any) => [h.name.toLowerCase(), h.value]));
        const toList = parseAddressList(headers["to"] ?? "").map((a) => a.toLowerCase());
        if (!toList.includes(email.toLowerCase())) continue;
        const stageSubject = d.stage === "initial" ? campaign.subject : stepByStage.get(d.stage)?.subject ?? campaign.subject;
        if (stageSubject && normalizeSubject(headers["subject"] ?? "") !== normalizeSubject(stageSubject)) continue;
        const sentAt = Number(msg.internalDate ?? 0);
        if (sentAt && new Date(d.created_at).getTime() - 60_000 > sentAt) continue;
        candidates.push({ id: m.id, threadId: m.threadId, date: sentAt });
      }
      if (candidates.length === 1) {
        const c = candidates[0];
        await sb.from("automation_drafts").update({ status: "sent", resolved_at: new Date().toISOString(), gmail_message_id: c.id, thread_id: c.threadId }).eq("id", d.id);
        const sentAtIso = new Date(c.date).toISOString();
        await sb.from("automation_messages").upsert({
          user_id: context.userId, campaign_id: data.campaignId, contact_id: d.contact_id,
          gmail_message_id: c.id, thread_id: c.threadId, direction: "out", kind: d.stage, sent_at: sentAtIso,
        }, { onConflict: "user_id,gmail_message_id" });
        // Schedule the next enabled follow-up from the actual sent timestamp.
        const stageOrder = ["initial", "fu1", "fu2", "fu3", "fu4"];
        const nextStage = stageOrder.slice(stageOrder.indexOf(d.stage) + 1).find((s) => stepByStage.get(s)?.enabled);
        if (nextStage) {
          const delayDays = stepByStage.get(nextStage)?.delay_days ?? 3;
          await sb.from("automation_contacts").update({
            status: "fu_pending", last_stage: d.stage, last_sent_at: sentAtIso,
            next_followup_at: new Date(c.date + delayDays * 86_400_000).toISOString(), updated_at: new Date().toISOString(),
          }).eq("id", d.contact_id);
        } else {
          await sb.from("automation_contacts").update({
            status: "completed", last_stage: d.stage, last_sent_at: sentAtIso, next_followup_at: null, updated_at: new Date().toISOString(),
          }).eq("id", d.contact_id);
        }
        await logEvent(sb, context.userId, data.campaignId, d.contact_id, "email_manually_sent", { stage: d.stage, gmail_message_id: c.id });
        results.push({ email, stage: d.stage, status: "sent" });
      } else if (candidates.length > 1) {
        results.push({ email, stage: d.stage, status: "ambiguous" });
        await logEvent(sb, context.userId, data.campaignId, d.contact_id, "error", { kind: "ambiguous_reconciliation", stage: d.stage, candidates: candidates.length });
      } else {
        results.push({ email, stage: d.stage, status: "not_found" });
      }
    }
    return {
      reconciled: results.filter((r) => r.status === "sent").length,
      ambiguous: results.filter((r) => r.status === "ambiguous").length,
      results,
    };
  });
