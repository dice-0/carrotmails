import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const schema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  recipients: z.array(z.string().email()).min(1).max(1000),
});

function b64url(s: string) {
  // utf-8 safe base64url
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const email of data.recipients) {
      try {
        const res = await fetch(`${GATEWAY}/users/me/messages/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lov}`,
            "X-Connection-Api-Key": gmail,
          },
          body: JSON.stringify({ raw: buildRaw(email, data.subject, data.body) }),
        });
        if (!res.ok) {
          const t = await res.text();
          results.push({ email, ok: false, error: t.slice(0, 200) });
        } else {
          results.push({ email, ok: true });
        }
      } catch (e: any) {
        results.push({ email, ok: false, error: String(e?.message ?? e).slice(0, 200) });
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    return { results };
  });
