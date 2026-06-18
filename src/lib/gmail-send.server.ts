// Server-only Gmail send helpers shared by bulk-send + campaign dispatch.

export type GmailMailbox = {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

export type Attachment = {
  filename: string;
  contentType: string;
  dataBase64: string;
};

export function applyVars(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

export function htmlToPlain(html: string) {
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

export function wrapHtml(inner: string, footerHtml?: string) {
  const footer = footerHtml
    ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;font-family:-apple-system,Helvetica,Arial,sans-serif">${footerHtml}</div>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0"><div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">${inner}${footer}</div></body></html>`;
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

const ALLOWED_ATTACHMENT_CT = /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/;
function sanitizeHeader(v: string) {
  return String(v).replace(/[\r\n]+/g, " ").trim();
}
function safeContentType(ct: string) {
  const cleaned = String(ct).replace(/[\r\n;].*$/s, "").trim();
  return ALLOWED_ATTACHMENT_CT.test(cleaned) ? cleaned : "application/octet-stream";
}

export function buildRawMime(
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  attachments: Attachment[],
) {
  const safeFrom = sanitizeHeader(from);
  const safeTo = sanitizeHeader(to);
  const safeSubject = sanitizeHeader(subject);
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

  const subjectEncoded = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(safeSubject)))}?=`;

  if (!attachments || attachments.length === 0) {
    const headers = [
      `From: ${safeFrom}`,
      `To: ${safeTo}`,
      `Subject: ${subjectEncoded}`,
      "MIME-Version: 1.0",
      altPart.split("\r\n")[0],
    ].join("\r\n");
    const body = altPart.split("\r\n").slice(1).join("\r\n");
    return b64url(headers + "\r\n\r\n" + body);
  }

  const mixedBoundary = "mix_" + Math.random().toString(36).slice(2);
  const parts: string[] = [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${subjectEncoded}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    altPart,
  ];
  for (const a of attachments) {
    const safeName = String(a.filename).replace(/[\r\n"]/g, "_");
    const safeCt = safeContentType(a.contentType);
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: ${safeCt}; name="${safeName}"`,
      `Content-Disposition: attachment; filename="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      "",
      chunk76(a.dataBase64),
    );
  }
  parts.push(`--${mixedBoundary}--`, "");
  return b64url(parts.join("\r\n"));
}


export async function refreshAccessToken(refreshToken: string) {
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
  if (!res.ok) throw new Error(`Failed to refresh Gmail token: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function getActiveAccessToken(mailbox: GmailMailbox): Promise<string> {
  const expMs = mailbox.expires_at ? new Date(mailbox.expires_at).getTime() : 0;
  if (expMs - 60_000 > Date.now()) return mailbox.access_token;
  if (!mailbox.refresh_token) throw new Error("Mailbox needs to be reconnected");
  const refreshed = await refreshAccessToken(mailbox.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("mailbox_connections")
    .update({ access_token: refreshed.access_token, expires_at: newExpiry })
    .eq("id", mailbox.id);
  return refreshed.access_token;
}

export async function loadUserMailbox(userId: string): Promise<GmailMailbox | null> {
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

export async function sendGmailRaw(accessToken: string, raw: string) {
  const url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ raw }),
  });
}
