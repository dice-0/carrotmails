import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const recipientSchema = z.object({
  email: z.string().email().max(320),
  vars: z.record(z.string().max(64), z.string().max(2000)).default({}),
});

const attachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(200),
  dataBase64: z.string().min(1).max(20_000_000),
});

const payloadSchema = z.object({
  from: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1).max(500_000),
  recipients: z.array(recipientSchema).min(1).max(500),
  attachments: z.array(attachmentSchema).max(10).default([]),
});

type Recipient = z.infer<typeof recipientSchema>;
type Attachment = z.infer<typeof attachmentSchema>;

// Free quota: 20 recipient sends per rolling 3 days for users without a paid plan.
export const FREE_QUOTA = 20;
export const FREE_WINDOW_DAYS = 3;

function applyVars(template: string, r: Recipient) {
  const vars: Record<string, string> = { email: r.email, ...r.vars };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function htmlToPlain(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapHtml(inner: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0"><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">${inner}</div></body></html>`;
}

function b64url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function chunk76(s: string) {
  return s.match(/.{1,76}/g)?.join("\r\n") ?? s;
}

function buildRawMime(
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments: Attachment[],
) {
  const altBoundary = "alt_" + Math.random().toString(36).slice(2);
  const altPart = [
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    `--${altBoundary}--`,
  ].join("\r\n");

  const subjectEncoded = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

  if (attachments.length === 0) {
    const headers = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subjectEncoded}`,
      "MIME-Version: 1.0",
      altPart.split("\r\n")[0],
    ].join("\r\n");
    const body = altPart.split("\r\n").slice(1).join("\r\n");
    return b64url(headers + "\r\n\r\n" + body);
  }

  const mixedBoundary = "mix_" + Math.random().toString(36).slice(2);
  const parts: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    altPart,
  ];
  for (const a of attachments) {
    const safeName = a.filename.replace(/[\r\n"]/g, "_");
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: ${a.contentType}; name="${safeName}"`,
      `Content-Disposition: attachment; filename="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      "",
      chunk76(a.dataBase64),
    );
  }
  parts.push(`--${mixedBoundary}--`, "");
  return b64url(parts.join("\r\n"));
}

function totalAttachmentBytes(atts: Attachment[]) {
  return atts.reduce((n, a) => n + Math.floor((a.dataBase64.length * 3) / 4), 0);
}

type GmailMailbox = {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to refresh Gmail token: ${await res.text()}`);
  }
  return (await res.json()) as { access_token: string; expires_in: number };
}

async function getActiveAccessToken(mailbox: GmailMailbox): Promise<string> {
  const expMs = mailbox.expires_at ? new Date(mailbox.expires_at).getTime() : 0;
  // Refresh 60s before expiry
  if (expMs - 60_000 > Date.now()) return mailbox.access_token;
  if (!mailbox.refresh_token) throw new Error("Mailbox needs to be reconnected");
  const refreshed = await refreshAccessToken(mailbox.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await updateMailboxToken(mailbox.id, refreshed.access_token, newExpiry);
  return refreshed.access_token;
}

async function loadUserMailbox(userId: string): Promise<GmailMailbox | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("mailbox_connections")
    .select("id, email, access_token, refresh_token, expires_at, status, provider")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GmailMailbox | null) ?? null;
}

async function updateMailboxToken(mailboxId: string, accessToken: string, expiresAt: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("mailbox_connections")
    .update({ access_token: accessToken, expires_at: expiresAt })
    .eq("id", mailboxId);
}

async function getUsage(supabase: any) {
  const since = new Date(Date.now() - FREE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("email_send_events")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function hasPaidAccess(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("billing_entitlements")
    .select("active, expires_at")
    .eq("user_id", userId)
    .eq("active", true);
  if (error) throw new Error("Unable to verify paid access");
  return (data ?? []).some(
    (i: { active: boolean; expires_at: string | null }) =>
      i.active && (!i.expires_at || new Date(i.expires_at).getTime() > Date.now()),
  );
}

export const getGmailProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mailbox = await loadUserMailbox(context.userId);
    const paid = await hasPaidAccess(context.supabase, context.userId);
    const used = await getUsage(context.supabase);
    return {
      email: mailbox?.email ?? null,
      paid,
      freeUsed: used,
      freeLimit: FREE_QUOTA,
      freeWindowDays: FREE_WINDOW_DAYS,
    };
  });

export const sendBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => payloadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const mailbox = await loadUserMailbox(context.userId);
    if (!mailbox) throw new Error("Connect a Gmail mailbox before sending");

    const paid = await hasPaidAccess(context.supabase, context.userId);
    if (!paid) {
      const used = await getUsage(context.supabase);
      const remaining = Math.max(0, FREE_QUOTA - used);
      if (data.recipients.length > remaining) {
        throw new Error(
          `Free plan limit: ${FREE_QUOTA} emails per ${FREE_WINDOW_DAYS} days. You have ${remaining} left. Upgrade to send more.`,
        );
      }
    }

    if (totalAttachmentBytes(data.attachments) > 20 * 1024 * 1024) {
      throw new Error("Total attachment size exceeds 20MB");
    }

    let accessToken: string;
    try {
      accessToken = await getActiveAccessToken(context.supabase, mailbox);
    } catch (e) {
      throw new Error((e as Error).message);
    }

    const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    const results: { email: string; ok: boolean; error?: string }[] = [];

    for (const r of data.recipients) {
      try {
        const subject = applyVars(data.subject, r);
        const htmlBody = wrapHtml(applyVars(data.bodyHtml, r));
        const textBody = htmlToPlain(applyVars(data.bodyHtml, r));
        const raw = buildRawMime(data.from, r.email, subject, htmlBody, textBody, data.attachments);

        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ raw }),
        });
        if (!resp.ok) {
          const txt = await resp.text();
          // Token may have expired mid-batch (rare). Refresh once and retry this recipient.
          if (resp.status === 401 && mailbox.refresh_token) {
            try {
              const refreshed = await refreshAccessToken(mailbox.refresh_token);
              accessToken = refreshed.access_token;
              await context.supabase
                .from("mailbox_connections")
                .update({
                  access_token: refreshed.access_token,
                  expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
                })
                .eq("id", mailbox.id);
              const retry = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ raw }),
              });
              if (!retry.ok) {
                results.push({ email: r.email, ok: false, error: `${retry.status} ${(await retry.text()).slice(0, 200)}` });
              } else {
                results.push({ email: r.email, ok: true });
                await context.supabase.from("email_send_events").insert({
                  user_id: context.userId,
                  mailbox_id: mailbox.id,
                  recipient_email: r.email,
                });
              }
              continue;
            } catch (re) {
              results.push({ email: r.email, ok: false, error: (re as Error).message });
              continue;
            }
          }
          results.push({ email: r.email, ok: false, error: `${resp.status} ${txt.slice(0, 200)}` });
        } else {
          results.push({ email: r.email, ok: true });
          await context.supabase.from("email_send_events").insert({
            user_id: context.userId,
            mailbox_id: mailbox.id,
            recipient_email: r.email,
          });
        }
      } catch (e) {
        results.push({ email: r.email, ok: false, error: (e as Error).message });
      }
      await new Promise((res) => setTimeout(res, 120));
    }

    const sent = results.filter((r) => r.ok).length;
    return { sent, failed: results.length - sent, results };
  });
