import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { sendBulk, getGmailProfile } from "@/lib/bulk-send.functions";
import { RichEditor } from "@/components/RichEditor";
import { Button } from "@/components/ui/button";
import { CarrotLogo } from "@/components/CarrotLogo";
import { usePersistentState } from "@/hooks/usePersistentState";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Carrot Mails | bulk mail, sharp and simple" },
      { name: "description", content: "Personalized bulk email from your own inbox. No clutter." },
      { property: "og:title", content: "Carrot Mails | bulk mail, sharp and simple" },
      { property: "og:description", content: "Personalized bulk email from your own inbox." },
    ],
  }),
  component: Index,
});

type Recipient = { email: string; vars: Record<string, string> };
type Attachment = { filename: string; contentType: string; dataBase64: string; size: number };

function parseRecipients(raw: string): { rows: Recipient[]; headers: string[]; error?: string } {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], headers: [] };

  const split = (l: string) => l.split(/\t|,/).map((s) => s.trim());
  const first = split(lines[0]);
  const looksLikeHeader = first[0].toLowerCase() === "email" || first.some((c) => /^[a-zA-Z_]\w*$/.test(c) && !c.includes("@"));
  let headers: string[];
  let dataLines: string[];
  if (looksLikeHeader && !first[0].includes("@")) {
    headers = first.map((h) => h.toLowerCase());
    dataLines = lines.slice(1);
  } else {
    headers = first.length >= 2 ? ["email", "name"] : ["email"];
    dataLines = lines;
  }
  const emailIdx = headers.indexOf("email");
  if (emailIdx === -1) return { rows: [], headers, error: "Missing 'email' column" };

  const rows: Recipient[] = [];
  for (const line of dataLines) {
    const cols = split(line);
    const email = cols[emailIdx];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const vars: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h !== "email" && cols[i]) vars[h] = cols[i];
    });
    rows.push({ email, vars });
  }
  return { rows, headers };
}

function applyVars(template: string, r: Recipient) {
  const vars: Record<string, string> = { email: r.email, ...r.vars };
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function Index() {
  const getProfile = useServerFn(getGmailProfile);
  const send = useServerFn(sendBulk);

  const { data: profile } = useQuery({
    queryKey: ["gmail-profile"],
    queryFn: () => getProfile(),
    staleTime: 60_000,
  });

  const [fromName, setFromName] = usePersistentState("cm:compose:fromName", "");
  const [subject, setSubject] = usePersistentState("cm:compose:subject", "Quick hello, {{name}}");
  const [bodyHtml, setBodyHtml] = usePersistentState(
    "cm:compose:bodyHtml",
    '<p>Hi {{name}},</p><p>I wanted to share something with you. Take a look <a href="https://example.com" target="_blank" rel="noopener">here</a>.</p><p>Best,<br/>Me</p>',
  );
  const [raw, setRaw] = usePersistentState("cm:compose:recipients", "email,name\n");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<null | { sent: number; failed: number; results: { email: string; ok: boolean; error?: string }[] }>(null);

  const parsed = useMemo(() => parseRecipients(raw), [raw]);
  const sample: Recipient = parsed.rows[0] ?? { email: "you@example.com", vars: { name: "there" } };

  const fromAddress = profile?.email
    ? fromName.trim()
      ? `${fromName.trim()} <${profile.email}>`
      : profile.email
    : "";

  async function handleSend() {
    if (!profile?.email) return;
    if (parsed.rows.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const r = await send({
        data: {
          from: fromAddress,
          subject,
          bodyHtml,
          recipients: parsed.rows,
          attachments: attachments.map(({ filename, contentType, dataBase64 }) => ({
            filename,
            contentType,
            dataBase64,
          })),
        },
      });
      setResult(r);
    } catch (e) {
      setResult({ sent: 0, failed: parsed.rows.length, results: [{ email: "N/A", ok: false, error: (e as Error).message }] });
    } finally {
      setSending(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const added: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 15 * 1024 * 1024) {
        alert(`${f.name} is over 15MB and was skipped.`);
        continue;
      }
      added.push({
        filename: f.name,
        contentType: f.type || "application/octet-stream",
        dataBase64: await fileToBase64(f),
        size: f.size,
      });
    }
    setAttachments((prev) => [...prev, ...added].slice(0, 10));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const totalAttachSize = attachments.reduce((n, a) => n + a.size, 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10 flex items-end justify-between border-b border-border pb-6">
          <div>
            <CarrotLogo size={48} />
            <p className="mt-2 text-sm text-muted-foreground">
              Bulk mail. Personalized. From your own inbox.
            </p>
          </div>
          <div className="text-right font-mono text-xs text-muted-foreground">
            {profile?.email ? (
              <>
                <div className="text-foreground">{profile.email}</div>
                <div>gmail · connected</div>
                {profile.paid ? (
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-primary">pro · unlimited</div>
                ) : (
                  <div className="mt-1 text-[10px] uppercase tracking-widest">
                    free · {Math.max(0, (profile.freeLimit ?? 20) - (profile.freeUsed ?? 0))}/{profile.freeLimit ?? 20} left · resets every {profile.freeWindowDays ?? 3}d
                  </div>
                )}
              </>
            ) : (
              <div>connect gmail to begin · sign in with your own Google account</div>
            )}
          </div>
        </header>

        {!profile?.email && (
          <div className="mb-8 flex flex-col items-start justify-between gap-3 border border-primary/40 bg-primary/5 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <div className="text-sm font-medium text-foreground">Connect your Gmail to start sending</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Mail is sent from <em>your</em> inbox, never ours. 20 free sends every 3 days included.
              </div>
            </div>
            <Link to="/app/mailboxes" className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline">
              connect gmail →
            </Link>
          </div>
        )}
        {profile?.email && !profile.paid && (
          <QuotaBar used={profile.freeUsed ?? 0} limit={profile.freeLimit ?? 20} windowDays={profile.freeWindowDays ?? 3} />
        )}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* LEFT: compose */}
          <section className="space-y-5">
            <Field label="From name (optional)">
              <input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            <Field label="Subject" hint="Use {{name}} or any column from your list">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none transition focus:border-foreground focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            <Field label="Body" hint="Paste from Word or import HTML. Use {{vars}} for per-recipient values.">
              <RichEditor value={bodyHtml} onChange={setBodyHtml} />
            </Field>

            <Field
              label="Attachments"
              hint={`${attachments.length}/10 files · ${fmtBytes(totalAttachSize)} / 20 MB`}
            >
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  className="block w-full font-mono text-xs file:mr-3 file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:font-mono file:text-xs file:uppercase file:tracking-wider file:text-foreground hover:file:bg-muted"
                />
                {attachments.length > 0 && (
                  <ul className="divide-y divide-border border border-border">
                    {attachments.map((a, i) => (
                      <li key={`${a.filename}-${i}`} className="flex items-center justify-between px-3 py-2 font-mono text-xs">
                        <span className="truncate">{a.filename}</span>
                        <span className="ml-3 flex items-center gap-3 text-muted-foreground">
                          <span>{fmtBytes(a.size)}</span>
                          <button
                            type="button"
                            onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                            className="text-destructive hover:underline"
                          >
                            remove
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>

            <Field
              label="Recipients"
              hint={`CSV or TSV. First row = headers (email required). ${parsed.rows.length} valid · cols: ${parsed.headers.join(", ") || "none"}`}
            >
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={8}
                placeholder={"email,name,company\nada@hey.com,Ada,Analytica\ngrace@hey.com,Grace,USN"}
                className="w-full resize-none border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-foreground"
              />
            </Field>

            <div className="flex items-center justify-between pt-2">
              <div className="font-mono text-xs text-muted-foreground">
                {parsed.rows.length} recipient{parsed.rows.length === 1 ? "" : "s"} ready
              </div>
              <Button
                onClick={handleSend}
                disabled={sending || !profile?.email || parsed.rows.length === 0 || !subject.trim() || !bodyHtml.replace(/<[^>]+>/g, "").trim()}
                className="px-6 py-2.5 tracking-wide"
              >
                {sending ? "sending…" : `send → ${parsed.rows.length}`}
              </Button>
            </div>
          </section>

          {/* RIGHT: preview */}
          <section className="lg:sticky lg:top-10 lg:self-start">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Preview
              </h2>
              <span className="font-mono text-xs text-muted-foreground">
                {sample.email}
              </span>
            </div>
            <div className="border border-border bg-card p-6 shadow-[0_1px_0_0_var(--color-border)]">
              <div className="mb-4 border-b border-border pb-3">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Subject
                </div>
                <div className="mt-1 text-base font-medium">
                  {applyVars(subject, sample) || <span className="text-muted-foreground">None</span>}
                </div>
              </div>
              <div
                className="qq-content text-[15px] leading-relaxed text-foreground"
                dangerouslySetInnerHTML={{ __html: applyVars(bodyHtml, sample) }}
              />
              {attachments.length > 0 && (
                <div className="mt-4 border-t border-border pt-3 font-mono text-xs text-muted-foreground">
                  📎 {attachments.length} attachment{attachments.length === 1 ? "" : "s"} ·{" "}
                  {attachments.map((a) => a.filename).join(", ")}
                </div>
              )}
            </div>

            {result && (
              <div className="mt-6 border border-border p-4">
                <div className="flex items-baseline gap-4 font-mono text-sm">
                  <span>
                    <span className="text-foreground">{result.sent}</span>
                    <span className="text-muted-foreground"> sent</span>
                  </span>
                  {result.failed > 0 && (
                    <span className="text-destructive">{result.failed} failed</span>
                  )}
                </div>
                {result.failed > 0 && (
                  <ul className="mt-3 max-h-40 overflow-auto font-mono text-xs text-muted-foreground">
                    {result.results
                      .filter((r) => !r.ok)
                      .map((r) => (
                        <li key={r.email}>
                          {r.email}: {r.error}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

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
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function QuotaBar({ used, limit, windowDays }: { used: number; limit: number; windowDays: number }) {
  const left = Math.max(0, limit - used);
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const low = left <= Math.max(1, Math.floor(limit * 0.2));
  return (
    <div className="mb-8 border border-border px-5 py-4">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Free quota</div>
        <div className={`font-mono text-xs ${low ? "text-destructive" : "text-foreground"}`}>
          {left}/{limit} left · resets every {windowDays}d
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full bg-muted">
        <div
          className={`h-full ${low ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {low && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Running low. Upgrade for unlimited sending.</span>
          <Link to="/app/billing" className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline">upgrade →</Link>
        </div>
      )}
    </div>
  );
}
