import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const recipientSchema = z.object({
  email: z.string().email().max(320),
  vars: z.record(z.string().max(64), z.string().max(2000)).default({}),
});

const attachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(200),
  dataBase64: z.string().min(1).max(20_000_000), // ~15MB raw
});

const payloadSchema = z.object({
  from: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1).max(500_000),
  recipients: z.array(recipientSchema).min(1).max(500),
  attachments: z.array(attachmentSchema).max(10).default([]),
});

type Payload = z.infer<typeof payloadSchema>;
type Recipient = z.infer<typeof recipientSchema>;
type Attachment = z.infer<typeof attachmentSchema>;

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
      altPart.split("\r\n")[0], // Content-Type line
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

export const sendBulk = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => payloadSchema.parse(input))
  .handler(async ({ data }: { data: Payload }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!gmailKey) throw new Error("GOOGLE_MAIL_API_KEY is not configured (connect Gmail)");

    if (totalAttachmentBytes(data.attachments) > 20 * 1024 * 1024) {
      throw new Error("Total attachment size exceeds 20MB");
    }

    const url =
      "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send";
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
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gmailKey,
          },
          body: JSON.stringify({ raw }),
        });
        if (!resp.ok) {
          const txt = await resp.text();
          results.push({ email: r.email, ok: false, error: `${resp.status} ${txt.slice(0, 200)}` });
        } else {
          results.push({ email: r.email, ok: true });
        }
      } catch (e) {
        results.push({ email: r.email, ok: false, error: (e as Error).message });
      }
      await new Promise((res) => setTimeout(res, 120));
    }

    const sent = results.filter((r) => r.ok).length;
    return { sent, failed: results.length - sent, results };
  });

export const getGmailProfile = createServerFn({ method: "GET" }).handler(async () => {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey || !gmailKey) return { email: null as string | null };
  const resp = await fetch(
    "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/profile",
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
      },
    },
  );
  if (!resp.ok) return { email: null };
  const json = (await resp.json()) as { emailAddress?: string };
  return { email: json.emailAddress ?? null };
});
