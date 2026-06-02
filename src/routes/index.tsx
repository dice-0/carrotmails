import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { sendBulk } from "@/lib/sender.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "bulk — minimalist mail sender" },
      { name: "description", content: "Paste a list. Send. Done." },
    ],
  }),
  component: Page,
});

type Result = { email: string; ok: boolean; error?: string };
type Recipient = { email: string; name?: string };

const EMAIL_RE = /[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/;

function parseRecipients(raw: string): Recipient[] {
  const out = new Map<string, Recipient>();
  for (const line of raw.split(/\r?\n/)) {
    for (const chunk of line.split(/[,;\t]/)) {
      const s = chunk.trim();
      if (!s) continue;
      // "Name <email@x>" | "email, Name" | "email Name" | "email"
      const angle = s.match(/^(.*?)<\s*([^>]+)\s*>$/);
      let email = "";
      let name: string | undefined;
      if (angle) {
        name = angle[1].trim().replace(/^["']|["']$/g, "") || undefined;
        email = angle[2].trim();
      } else {
        const m = s.match(EMAIL_RE);
        if (!m) continue;
        email = m[0];
        const rest = s.replace(email, "").trim().replace(/^["']|["']$/g, "");
        if (rest) name = rest;
      }
      if (!EMAIL_RE.test(email)) continue;
      const key = email.toLowerCase();
      if (!out.has(key)) out.set(key, { email, name });
    }
  }
  return [...out.values()];
}

function Page() {
  const send = useServerFn(sendBulk);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [list, setList] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const recipients = useMemo(() => parseRecipients(list), [list]);

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const ready = subject && body && recipients.length > 0;

  async function onSend() {
    if (!ready || sending) return;
    setSending(true);
    setResults([]);
    try {
      const res = await send({ data: { subject, body, recipients } });
      setResults(res.results);
    } catch (e: any) {
      setResults([{ email: "—", ok: false, error: String(e?.message ?? e) }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen mx-auto max-w-2xl px-6 py-16">
      <header className="flex items-baseline justify-between mb-10">
        <h1 className="text-base font-medium tracking-tight">bulk.</h1>
        <span className="text-muted-foreground text-xs">
          gmail · {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="space-y-3">
        <Field label="subject" hint="use {name} to personalize">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="hi {name}"
            className={inputCls}
          />
        </Field>

        <Field
          label="body"
          hint="plain text — links auto-format · use {name} · blank line = paragraph"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder={`Hi {name},\n\nQuick note — check this out: https://example.com\n\nThanks`}
            className={inputCls + " resize-y font-mono text-[13px] leading-relaxed"}
          />
        </Field>

        <Field label="recipients" hint="one per line — `email` or `Name <email>` or `email, Name`">
          <textarea
            value={list}
            onChange={(e) => setList(e.target.value)}
            rows={5}
            placeholder={`alice@x.com, Alice\nBob Smith <bob@y.com>\ncarol@z.com`}
            className={inputCls + " resize-y font-mono text-[13px]"}
          />
        </Field>
      </div>

      <button
        onClick={onSend}
        disabled={!ready || sending}
        className="mt-6 w-full h-11 bg-foreground text-background text-sm tracking-tight disabled:opacity-30 transition-opacity"
      >
        {sending ? "sending…" : `send → ${recipients.length}`}
      </button>

      {results.length > 0 && (
        <section className="mt-10">
          <div className="flex justify-between text-xs text-muted-foreground mb-3">
            <span>{sent} sent</span>
            {failed > 0 && <span>{failed} failed</span>}
          </div>
          <ul className="border-t">
            {results.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between py-2 border-b text-xs gap-3"
              >
                <span className="truncate">{r.email}</span>
                <span
                  className={
                    r.ok
                      ? "text-muted-foreground shrink-0"
                      : "text-foreground truncate text-right"
                  }
                >
                  {r.ok ? "ok" : r.error?.slice(0, 60) ?? "error"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

const inputCls =
  "w-full bg-transparent border border-border px-3 py-2 text-sm outline-none focus:border-foreground transition-colors";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
