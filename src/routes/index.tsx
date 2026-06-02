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

function Page() {
  const send = useServerFn(sendBulk);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [list, setList] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const recipients = useMemo(
    () =>
      Array.from(
        new Set(
          list
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)),
        ),
      ),
    [list],
  );

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
        <Field label="subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="body (html ok)">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className={inputCls + " resize-y"}
          />
        </Field>

        <Field label="recipients">
          <textarea
            value={list}
            onChange={(e) => setList(e.target.value)}
            rows={5}
            placeholder="paste emails — commas, spaces, or newlines"
            className={inputCls + " resize-y"}
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
                className="flex items-center justify-between py-2 border-b text-xs"
              >
                <span className="truncate">{r.email}</span>
                <span className={r.ok ? "text-muted-foreground" : "text-foreground"}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
