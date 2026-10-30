import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadUserMailbox, buildRawMime, htmlToPlain, type Attachment } from "@/lib/gmail-send.server";
import {
  createDraft, sendMessageRaw, getThread, getMessage, listHistory, GmailApiError,
} from "@/lib/automation/gmail.server";
import { applyMergeTags, contactToValues, parseAddressList, invalidAddresses } from "@/lib/automation/merge.server";
import type { ContactValues } from "@/lib/automation/merge.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any;

const STAGE_ORDER = ["initial", "fu1", "fu2", "fu3", "fu4"] as const;

async function loadCampaign(sb: Sb, userId: string, campaignId: string) {
  const { data: campaign, error } = await sb
    .from("automation_campaigns").select("*").eq("id", campaignId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) throw new Error("Campaign not found");
  return campaign;
}

async function loadMailbox(sb: Sb, userId: string, campaign: any) {
  const mailbox = campaign.mailbox_id
    ? await sb.from("mailbox_connections").select("id, email, access_token, refresh_token, expires_at, status, provider, daily_sent_count, daily_sent_date, daily_cap").eq("id", campaign.mailbox_id).eq("user_id", userId).maybeSingle()
    : { data: await loadUserMailbox(userId) };
  if (!mailbox.data) throw new Error("No connected Gmail mailbox");
  return mailbox.data;
}

async function logEvent(sb: Sb, userId: string, campaignId: string | null, contactId: string | null, eventType: string, detail: Record<string, unknown>) {
  await sb.from("automation_events").insert({ user_id: userId, campaign_id: campaignId, contact_id: contactId, event_type: eventType, detail });
}

async function suppressionSet(sb: Sb, userId: string): Promise<Set<string>> {
  const [a, s] = await Promise.all([
    sb.from("automation_suppressions").select("email").eq("user_id", userId).is("removed_at", null).limit(10000),
    sb.from("suppressions").select("email").eq("user_id", userId).limit(10000),
  ]);
  const set = new Set<string>();
  for (const r of a.data ?? []) set.add(String(r.email).toLowerCase());
  for (const r of s.data ?? []) set.add(String(r.email).toLowerCase());
  return set;
}

// ============= Follow-up generation (Mode A: Gmail drafts, default) =============

// For every contact whose next follow-up is due, build a reply draft inside
// the original Gmail thread (threadId + In-Reply-To + References). Never sends.
export const generateDueFollowUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; contactIds?: string[]; batchLimit?: number }) => d)
  .handler(async ({ data, context }) => {
    const sb: Sb = context.supabase;
    const campaign = await loadCampaign(sb, context.userId, data.campaignId);
    const mb = await loadMailbox(sb, context.userId, campaign);
    const steps: any[] = (await sb.from("automation_steps").select("*").eq("campaign_id", data.campaignId).eq("user_id", context.userId)).data ?? [];
    const stepByStage = new Map(steps.map((s) => [s.stage, s]));
    const suppressions = await suppressionSet(sb, context.userId);

    const now = new Date().toISOString();
    let q = sb.from("automation_contacts").select("*")
      .eq("campaign_id", data.campaignId).eq("user_id", context.userId)
      .eq("status", "fu_pending").lte("next_followup_at", now)
      .order("next_followup_at").limit(200);
    if (data.contactIds?.length) q = q.in("id", data.contactIds);
    const { data: due } = await q;
    if (!due?.length) return { generated: 0, results: [], remaining: 0 };

    // Which stage is next per contact: first enabled stage after last_stage.
    const results: { email: string; ok: boolean; stage?: string; error?: string }[] = [];
    const limit = Math.min(data.batchLimit ?? 10, 20);
    let processed = 0;

    for (const c of due as any[]) {
      if (processed >= limit) break;
      if (suppressions.has(c.email)) {
        await sb.from("automation_contacts").update({ status: "suppressed", next_followup_at: null, updated_at: now }).eq("id", c.id);
        continue;
      }
      const lastIdx = STAGE_ORDER.indexOf(c.last_stage ?? "initial");
      const nextStage = STAGE_ORDER.slice(lastIdx + 1).find((s) => stepByStage.get(s)?.enabled);
      if (!nextStage) {
        await sb.from("automation_contacts").update({ status: "completed", next_followup_at: null, updated_at: now }).eq("id", c.id);
        continue;
      }
      // Duplicate prevention: skip if an open draft already exists for this stage.
      const { data: existing } = await sb.from("automation_drafts").select("id, status")
        .eq("campaign_id", data.campaignId).eq("contact_id", c.id).eq("stage", nextStage).maybeSingle();
      if (existing && (existing.status === "created" || existing.status === "regenerated")) continue;

      // Find the thread's latest message to reply in-thread.
      if (!c.gmail_thread_id) {
        results.push({ email: c.email, ok: false, error: "Original thread not found; reconnect via reconciliation" });
        continue;
      }
      const thread = await getThread(mb, c.gmail_thread_id).catch(() => null);
      if (!thread) {
        results.push({ email: c.email, ok: false, error: "Gmail thread could not be loaded" });
        continue;
      }
      // Skip if a reply/bounce already arrived (checked live, right before drafting).
      const messages = (thread as any).messages ?? [];
      const knownIds = new Set(
        ((await sb.from("automation_messages").select("gmail_message_id").eq("contact_id", c.id)).data ?? []).map((m: any) => m.gmail_message_id),
      );
      const inbound = messages.filter((m: any) => !knownIds.has(m.id));
      if (inbound.length) {
        results.push({ email: c.email, ok: false, error: "New messages in the thread; run the reply/bounce scan first" });
        continue;
      }
      const lastMsg = messages[messages.length - 1];
      const lastHeaders = Object.fromEntries(((lastMsg as any)?.payload?.headers ?? []).map((h: any) => [h.name.toLowerCase(), h.value]));

      const step = stepByStage.get(nextStage);
      const values: ContactValues = contactToValues(c);
      const originalSubject = lastHeaders["subject"] ?? campaign.subject ?? "";
      const subjectTemplate = (step?.subject ?? "").trim() || originalSubject;
      const subject = /^re\s*:/i.test(subjectTemplate) ? applyMergeTags(subjectTemplate, values).output : `Re: ${applyMergeTags(subjectTemplate, values).output}`;
      const bodyHtml = applyMergeTags(step?.body_html ?? "", values, { escapeHtml: true }).output;
      if (!bodyHtml.trim()) {
        results.push({ email: c.email, ok: false, error: `${nextStage.toUpperCase()} template is empty` });
        continue;
      }
      // CC only when the contact has Follow-up CC enabled; never copies the
      // initial email's CC automatically.
      const ccList = c.followup_cc
        ? parseAddressList(c.cc || campaign.default_cc || "")
        : [];
      const bad = invalidAddresses(ccList);
      if (bad.length) {
        results.push({ email: c.email, ok: false, error: `Invalid follow-up CC: ${bad.join(", ")}` });
        continue;
      }

      try {
        const fromHeader = campaign.from_name ? `${campaign.from_name} <${mb.email}>` : mb.email;
        const extraHeaders = [
          ...(lastHeaders["message-id"] ? [`In-Reply-To: ${lastHeaders["message-id"]}`] : []),
          ...(lastHeaders["message-id"] ? [`References: ${lastHeaders["references"] ?? lastHeaders["message-id"]}`] : []),
          ...(ccList.length ? [`Cc: ${ccList.join(", ")}`] : []),
        ];
        const raw = buildRawMime(fromHeader, c.email, subject, bodyHtml, htmlToPlain(bodyHtml), step?.attachments ?? [], extraHeaders);
        const draft = await createDraft(mb, raw, { threadId: c.gmail_thread_id });
        await sb.from("automation_drafts").upsert({
          user_id: context.userId, campaign_id: data.campaignId, contact_id: c.id, stage: nextStage,
          gmail_draft_id: draft.id, gmail_message_id: draft.message.id, thread_id: c.gmail_thread_id,
          expected_cc: ccList.join(", ") || null, cc_verified: true, status: "created",
        }, { onConflict: "campaign_id,contact_id,stage" });
        await sb.from("automation_contacts").update({ last_stage: nextStage, updated_at: now }).eq("id", c.id);
        await logEvent(sb, context.userId, data.campaignId, c.id, "followup_generated", { stage: nextStage, draft_id: draft.id });
        results.push({ email: c.email, ok: true, stage: nextStage });
        processed++;
      } catch (e) {
        const msg = (e as Error).message;
        results.push({ email: c.email, ok: false, error: msg });
        await logEvent(sb, context.userId, data.campaignId, c.id, "error", { kind: "followup_draft", stage: nextStage, message: msg });
        if (e instanceof GmailApiError && [401, 403, 429].includes(e.status)) break;
      }
    }
    return { generated: results.filter((r) => r.ok).length, results, remaining: Math.max(0, (due as any[]).length - limit) };
  });

// ============= Mode B: explicitly selected follow-up sending =============

// Dry-run preview or a confirmed batch send. Requires explicit contactIds and
// confirm:true; rechecks replies, bounces and suppression immediately before
// each send. Gmail accepting the API call is reported as "sent request",
// delivery is never claimed.
export const sendSelectedFollowUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; contactIds: string[]; confirm?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const sb: Sb = context.supabase;
    if (!data.contactIds?.length) throw new Error("Select the follow-ups to send");
    const campaign = await loadCampaign(sb, context.userId, data.campaignId);
    const mb = await loadMailbox(sb, context.userId, campaign);
    const steps: any[] = (await sb.from("automation_steps").select("*").eq("campaign_id", data.campaignId).eq("user_id", context.userId)).data ?? [];
    const stepByStage = new Map(steps.map((s) => [s.stage, s]));
    const suppressions = await suppressionSet(sb, context.userId);

    const { data: contacts } = await sb.from("automation_contacts").select("*")
      .eq("campaign_id", data.campaignId).eq("user_id", context.userId).in("id", data.contactIds);

    // Pre-send eligibility snapshot (also used as the dry-run preview).
    const eligible: any[] = [];
    const preview: { contact_id?: string; email: string; stage: string; status: string; reason?: string }[] = [];
    for (const c of contacts ?? []) {
      if (suppressions.has(c.email)) { preview.push({ email: c.email, stage: "", status: "blocked", reason: "Suppressed" }); continue; }
      if (c.status !== "fu_pending") { preview.push({ email: c.email, stage: "", status: "blocked", reason: `Status ${c.status}` }); continue; }
      const nextStage = STAGE_ORDER.slice(STAGE_ORDER.indexOf(c.last_stage ?? "initial") + 1).find((s) => stepByStage.get(s)?.enabled);
      if (!nextStage) { preview.push({ email: c.email, stage: "", status: "blocked", reason: "No enabled follow-up remaining" }); continue; }
      eligible.push({ contact: c, stage: nextStage });
      preview.push({ contact_id: c.id, email: c.email, stage: nextStage, status: "eligible" });
    }

    if (!data.confirm) return { mode: "dry_run", eligibleCount: eligible.length, preview };

    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const { contact: c, stage } of eligible) {
      // Live recheck immediately before sending.
      const { data: fresh } = await sb.from("automation_contacts").select("status, gmail_thread_id, followup_cc, cc").eq("id", c.id).maybeSingle();
      if (!fresh || fresh.status !== "fu_pending") { results.push({ email: c.email, ok: false, error: "Status changed before send" }); continue; }
      if (suppressions.has(c.email)) { results.push({ email: c.email, ok: false, error: "Suppressed before send" }); continue; }
      const suppress = await suppressionSet(sb, context.userId);
      if (suppress.has(c.email)) { results.push({ email: c.email, ok: false, error: "Suppressed before send" }); continue; }
      if (!fresh.gmail_thread_id) { results.push({ email: c.email, ok: false, error: "Thread not found" }); continue; }
      try {
        const thread = await getThread(mb, fresh.gmail_thread_id) as any;
        const messages = thread.messages ?? [];
        const knownIds = new Set(((await sb.from("automation_messages").select("gmail_message_id").eq("contact_id", c.id)).data ?? []).map((m: any) => m.gmail_message_id));
        if (messages.some((m: any) => !knownIds.has(m.id))) { results.push({ email: c.email, ok: false, error: "New thread activity; scan before sending" }); continue; }
        const lastMsg = messages[messages.length - 1];
        const lastHeaders = Object.fromEntries(((lastMsg as any)?.payload?.headers ?? []).map((h: any) => [h.name.toLowerCase(), h.value]));
        const step = stepByStage.get(stage);
        const values = contactToValues(c);
        const subjectTemplate = (step?.subject ?? "").trim() || lastHeaders["subject"] || campaign.subject || "";
        const subject = /^re\s*:/i.test(subjectTemplate) ? applyMergeTags(subjectTemplate, values).output : `Re: ${applyMergeTags(subjectTemplate, values).output}`;
        const bodyHtml = applyMergeTags(step?.body_html ?? "", values, { escapeHtml: true }).output;
        const ccList = fresh.followup_cc ? parseAddressList(fresh.cc || campaign.default_cc || "") : [];
        const fromHeader = campaign.from_name ? `${campaign.from_name} <${mb.email}>` : mb.email;
        const extraHeaders = [
          ...(lastHeaders["message-id"] ? [`In-Reply-To: ${lastHeaders["message-id"]}`] : []),
          ...(lastHeaders["message-id"] ? [`References: ${lastHeaders["references"] ?? lastHeaders["message-id"]}`] : []),
          ...(ccList.length ? [`Cc: ${ccList.join(", ")}`] : []),
        ];
        const raw = buildRawMime(fromHeader, c.email, subject, bodyHtml, htmlToPlain(bodyHtml), step?.attachments ?? [], extraHeaders);
        const sent = await sendMessageRaw(mb, raw, fresh.gmail_thread_id) as any;
        const sentAt = new Date().toISOString();
        await sb.from("automation_messages").upsert({
          user_id: context.userId, campaign_id: data.campaignId, contact_id: c.id,
          gmail_message_id: sent.id, thread_id: sent.threadId ?? fresh.gmail_thread_id,
          direction: "out", kind: stage, sent_at: sentAt,
        }, { onConflict: "user_id,gmail_message_id" });
        const nextStage = STAGE_ORDER.slice(STAGE_ORDER.indexOf(stage) + 1).find((s) => stepByStage.get(s)?.enabled);
        const delayDays = nextStage ? stepByStage.get(nextStage)?.delay_days ?? 3 : 0;
        await sb.from("automation_contacts").update({
          status: nextStage ? "fu_pending" : "completed", last_stage: stage, last_sent_at: sentAt,
          next_followup_at: nextStage ? new Date(Date.now() + delayDays * 86_400_000).toISOString() : null,
          updated_at: sentAt,
        }).eq("id", c.id);
        await logEvent(sb, context.userId, data.campaignId, c.id, "followup_sent", { stage, gmail_message_id: sent.id });
        results.push({ email: c.email, ok: true });
      } catch (e) {
        results.push({ email: c.email, ok: false, error: (e as Error).message });
        if (e instanceof GmailApiError && [401, 403, 429].includes(e.status)) break;
      }
    }
    return { mode: "sent", eligibleCount: eligible.length, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  });

// ============= Reply / bounce / manual-outreach detection =============

// Scans known campaign threads for new inbound and unrecorded outbound
// messages, classifies them and stops sequences appropriately.
export const scanCampaignThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; batchLimit?: number }) => d)
  .handler(async ({ data, context }) => {
    const sb: Sb = context.supabase;
    const campaign = await loadCampaign(sb, context.userId, data.campaignId);
    const mb = await loadMailbox(sb, context.userId, campaign);
    const myEmail = String(mb.email).toLowerCase();

    const { data: contacts } = await sb.from("automation_contacts").select("id, email, gmail_thread_id, status")
      .eq("campaign_id", data.campaignId).eq("user_id", context.userId)
      .not("gmail_thread_id", "is", null)
      .in("status", ["fu_pending", "sent", "draft_created", "completed", "paused_review"])
      .limit(Math.min(data.batchLimit ?? 25, 50));
    if (!contacts?.length) return { scanned: 0, replies: 0, bounces: 0, manual: 0, results: [] };

    const threadIds = contacts.map((c: any) => c.gmail_thread_id);
    const { data: knownMsgs } = await sb.from("automation_messages").select("contact_id, gmail_message_id")
      .eq("campaign_id", data.campaignId).eq("user_id", context.userId).in("thread_id", threadIds);
    const knownByContact = new Map<string, Set<string>>();
    for (const m of knownMsgs ?? []) {
      if (!knownByContact.has(m.contact_id)) knownByContact.set(m.contact_id, new Set());
      knownByContact.get(m.contact_id)!.add(m.gmail_message_id);
    }

    const results: { email: string; found: string; classification?: string }[] = [];
    let replies = 0, bounces = 0, manual = 0;
    const now = new Date().toISOString();

    for (const c of contacts as any[]) {
      const known = knownByContact.get(c.id) ?? new Set<string>();
      const thread = await getThread(mb, c.gmail_thread_id).catch(() => null);
      if (!thread) { results.push({ email: c.email, found: "thread_unreachable" }); continue; }
      let changed = false;
      for (const m of ((thread as any).messages ?? []) as any[]) {
        if (known.has(m.id)) continue;
        const headers = Object.fromEntries((m.payload?.headers ?? []).map((h: any) => [h.name.toLowerCase(), h.value]));
        const from = String(headers["from"] ?? "").toLowerCase();
        const isMine = from.includes(`<${myEmail}>`) || from.includes(myEmail);
        const subject = headers["subject"] ?? "";

        if (isMine) {
          // The account owner wrote this thread manually: pause automation.
          await sb.from("automation_messages").insert({
            user_id: context.userId, campaign_id: data.campaignId, contact_id: c.id,
            gmail_message_id: m.id, thread_id: c.gmail_thread_id, direction: "out",
            kind: "manual_outreach", sent_at: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
            headers: { subject, from },
          });
          await sb.from("automation_contacts").update({ status: "paused_review", next_followup_at: null, updated_at: now }).eq("id", c.id);
          await logEvent(sb, context.userId, data.campaignId, c.id, "manual_outreach_detected", { subject, gmail_message_id: m.id });
          manual++; changed = true;
          continue;
        }

        const isBounce = /mailer-daemon|postmaster@|delivery-status|mail delivery subsystem/i.test(from) ||
          Boolean(headers["x-failed-recipients"]) ||
          /message\/delivery-status/i.test(JSON.stringify(m.payload ?? {}));
        if (isBounce) {
          const failed = String(headers["x-failed-recipients"] ?? "").split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
          const failedEmail = failed.length ? failed : [c.email.toLowerCase()];
          await sb.from("automation_messages").insert({
            user_id: context.userId, campaign_id: data.campaignId, contact_id: c.id,
            gmail_message_id: m.id, thread_id: c.gmail_thread_id, direction: "in",
            kind: "bounce", sent_at: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
            headers: { subject, from, x_failed_recipients: headers["x-failed-recipients"] ?? null },
          });
          for (const fe of failedEmail) {
            await sb.from("automation_suppressions").upsert({
              user_id: context.userId, email: fe, reason: "hard_bounce",
              campaign_id: data.campaignId, source_message_id: m.id, note: `Bounce: ${subject}`.slice(0, 300),
            }, { onConflict: "user_id,email" });
          }
          await sb.from("automation_contacts").update({ status: "bounced", next_followup_at: null, error: `Bounced: ${subject}`.slice(0, 300), updated_at: now }).eq("id", c.id);
          await logEvent(sb, context.userId, data.campaignId, c.id, "bounce_detected", { subject, gmail_message_id: m.id, failed: failedEmail });
          bounces++; changed = true;
          continue;
        }

        const autoReply = /autoreply|auto-reply|auto-generated/i.test(`${headers["x-autoreply"] ?? ""}${headers["auto-submitted"] ?? ""}${headers["precedence"] ?? ""}`);
        if (autoReply) {
          await sb.from("automation_messages").insert({
            user_id: context.userId, campaign_id: data.campaignId, contact_id: c.id,
            gmail_message_id: m.id, thread_id: c.gmail_thread_id, direction: "in",
            kind: "ooo", sent_at: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
            headers: { subject, from },
          });
          // Out-of-office: note it, keep the sequence running.
          await logEvent(sb, context.userId, data.campaignId, c.id, "ooo_detected", { subject, gmail_message_id: m.id });
          results.push({ email: c.email, found: "ooo" });
          changed = true;
          continue;
        }

        // Genuine human reply: stop the sequence.
        await sb.from("automation_messages").insert({
          user_id: context.userId, campaign_id: data.campaignId, contact_id: c.id,
          gmail_message_id: m.id, thread_id: c.gmail_thread_id, direction: "in",
          kind: "reply", sent_at: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
          headers: { subject, from },
        });
        await sb.from("automation_contacts").update({ status: "replied", next_followup_at: null, updated_at: now }).eq("id", c.id);
        await logEvent(sb, context.userId, data.campaignId, c.id, "reply_received", { subject, from, gmail_message_id: m.id });
        replies++; changed = true;
      }
      if (changed) results.push({ email: c.email, found: "updated" });
    }
    return { scanned: contacts.length, replies, bounces, manual, results };
  });
