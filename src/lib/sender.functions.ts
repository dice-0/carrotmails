import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  apiKey: z.string().min(1),
  from: z.string().min(3),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  recipients: z.array(z.string().email()).min(1).max(1000),
});

export const sendBulk = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const results: { email: string; ok: boolean; error?: string }[] = [];
    for (const email of data.recipients) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.apiKey}`,
          },
          body: JSON.stringify({
            from: data.from,
            to: [email],
            subject: data.subject,
            html: data.body,
          }),
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
      // gentle throttle
      await new Promise((r) => setTimeout(r, 60));
    }
    return { results };
  });
