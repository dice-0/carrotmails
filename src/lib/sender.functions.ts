import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const recipientSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
});

const schema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  recipients: z.array(recipientSchema).min(1).max(1000),
});

function b64url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Convert plain text → HTML: preserve newlines, auto-link URLs, keep existing <a> & basic tags.
function formatBody(input: string) {
  // If body already looks like HTML, just personalize as-is.
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(input);
  if (looksHtml) return input;

  // Escape, then linkify URLs and emails.
  const escaped = escapeHtml(input);
  const urlRe = /\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)'"])/gi;
  const linked = escaped.replace(urlRe, (u) => {
    const href = u.startsWith("http") ? u : `https://${u}`;
    return `<a href="${href}" style="color:#2563eb;text-decoration:underline" target="_blank" rel="noopener">${u}</a>`;
  });
  const emailRe = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;
  const withEmails = linked.replace(
    emailRe,
    (e) => `<a href="mailto:${e}" style="color:#2563eb;text-decoration:underline">${e}</a>`,
  );

  // Paragraphs from blank lines, <br> for single newlines.
  const paras = withEmails
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111">${paras}</div>`;
}

function personalize(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, k) => vars[k.toLowerCase()] ?? "");
}

function buildRaw(to: string, subject: string, html: string) {
  const msg = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  return b64url(msg);
}

export const sendBulk = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const lov = process.env.LOVABLE_API_KEY;
    const gmail = process.env.GOOGLE_MAIL_API_KEY;
    if (!lov) throw new Error("LOVABLE_API_KEY missing");
    if (!gmail) throw new Error("Gmail not connected");

    const formatted = formatBody(data.body);

    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const r of data.recipients) {
      const name = r.name ?? r.email.split("@")[0];
      const vars = { name, firstname: name.split(/\s+/)[0], email: r.email };
      const subject = personalize(data.subject, vars);
      const html = personalize(formatted, vars);
      const toHeader = r.name ? `${r.name} <${r.email}>` : r.email;
      try {
        const res = await fetch(`${GATEWAY}/users/me/messages/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lov}`,
            "X-Connection-Api-Key": gmail,
          },
          body: JSON.stringify({ raw: buildRaw(toHeader, subject, html) }),
        });
        if (!res.ok) {
          const t = await res.text();
          results.push({ email: r.email, ok: false, error: t.slice(0, 200) });
        } else {
          results.push({ email: r.email, ok: true });
        }
      } catch (e: any) {
        results.push({ email: r.email, ok: false, error: String(e?.message ?? e).slice(0, 200) });
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    return { results };
  });
