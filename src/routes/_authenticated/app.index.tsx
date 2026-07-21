import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { sendBulk, getGmailProfile } from "@/lib/bulk-send.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { RichEditor } from "@/components/RichEditor";
import { Button } from "@/components/ui/button";
import { CarrotLogo } from "@/components/CarrotLogo";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useBilling, planLabel } from "@/hooks/useEntitlement";
import { SendBlockedDialog, type SendBlockReason } from "@/components/SendBlockedDialog";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Compose | Carrot Mails" },
      { name: "description", content: "Compose a personalized broadcast and send from your connected Gmail inbox." },
      { property: "og:title", content: "Compose | Carrot Mails" },
      { property: "og:description", content: "Compose and send a personalized broadcast from your connected mailbox." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Index,
});

type Recipient = { email: string; vars: Record<string, string> };
type Attachment = { filename: string; contentType: string; dataBase64: string; size: number };

function parseRecipients(raw: string): { rows: Recipient[]; headers: string[]; error?: string } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
  const getUserProfile = useServerFn(getMyProfile);

  const { data: profile } = useQuery({
    queryKey: ["gmail-profile"],
    queryFn: () => getProfile(),
    staleTime: 30_000,
  });
  const { data: userProfile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getUserProfile(),
  });
  const { data: billing } = useBilling();

  const [fromName, setFromName] = usePersistentState("cm:compose:fromName", "");
  const [subject, setSubject] = usePersistentState("cm:compose:subject", "Quick hello, {{name}}");
  const [bodyHtml, setBodyHtml] = usePersistentState(
    "cm:compose:bodyHtml",
    '<p>Hi {{name}},</p><p>I wanted to share something with you. Take a look <a href="https://example.com" target="_blank" rel="noopener">here</a>.</p><p>Best,<br/>Me</p>',
  );
  const [raw, setRaw] = usePersistentState("cm:compose:recipients", "email,name\n");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [consent, setConsent] = usePersistentState("cm:compose:consent", false);
  const [consentSource, setConsentSource] = usePersistentState("cm:compose:consentSource", "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<null | { sent: number; failed: number; results: { email: string; ok: boolean; error?: string }[] }>(null);
  const [blockReason, setBlockReason] = useState<SendBlockReason | null>(null);

  const parsed = useMemo(() => parseRecipients(raw), [raw]);
  const sample: Recipient = parsed.rows[0] ?? { email: "you@example.com", vars: { name: "there" } };

  const fromAddress = profile?.email
    ? fromName.trim()
      ? `${fromName.trim()} <${profile.email}>`
      : profile.email
    : "";

  const hasPaid = billing?.hasPaidAccess ?? false;
  const profileComplete = userProfile?.complete ?? false;
  const hasMailbox = Boolean(profile?.email);
  const isLifetime = billing?.tier === "lifetime";
  const remaining = billing?.quotaRemaining ?? 0;
  const consentReady = consent && consentSource.trim().length >= 3;

  function attemptSend() {
    if (!profileComplete && !hasPaid) return setBlockReason("profile-and-plan");
    if (!profileComplete) return setBlockReason("profile");
    if (!hasPaid) return setBlockReason("plan");
    if (!hasMailbox) return setBlockReason("mailbox");
    if (!consentReady) return setBlockReason("consent");
    if (!isLifetime && parsed.rows.length > remaining) return setBlockReason("quota");
    void handleSend();
  }

  async function handleSend() {
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
          attachments: attachments.map(({ filename, contentType, dataBase64 }) => ({ filename, contentType, dataBase64 })),
          consentConfirmed: true as const,
          consentSource: consentSource.trim(),
          senderName: fromName.trim() || undefined,
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
            <p className="mt-2 text-sm text-muted-foreground">Bulk mail. Personalized. From your own inbox.</p>
          </div>
          <div className="text-right font-mono text-xs text-muted-foreground">
            {profile?.email ? (
              <>
                <div className="text-foreground">{profile.email}</div>
                <div>gmail · connected</div>
              </>
            ) : (
              <div>connect gmail to send · your account, your inbox</div>
            )}
            <div className="mt-1 text-[10px] uppercase tracking-widest text-primary">
              {planLabel(billing?.tier)}{isLifetime ? " · unlimited" : hasPaid ? ` · ${remaining.toLocaleString()} left` : ""}
            </div>
          </div>
        </header>

        {!hasPaid && (
          <div className="mb-8 flex flex-col items-start justify-between gap-3 border border-primary/40 bg-primary/5 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <div className="text-sm font-medium text-foreground">Carrot Mails is a paid tool.</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Complete your profile and pick Growth ($3.50/mo, 5,000 sends) or Lifetime (unlimited). No free tier, no fluff.
              </div>
            </div>
            <div className="flex gap-3">
              {!profileComplete && (
                <Link to="/app/profile" className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline">
                  profile →
                </Link>
              )}
              <Link to="/app/billing" className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline">
                choose a plan →
              </Link>
            </div>
          </div>
        )}
        {hasPaid && !isLifetime && (
          <QuotaBar used={billing?.sentThisPeriod ?? 0} limit={billing?.quota ?? 5000} />
        )}
        {hasPaid && !hasMailbox && (
          <div className="mb-8 flex items-center justify-between border border-border px-5 py-4">
            <div className="text-sm">Your plan is active. Connect a mailbox to start sending.</div>
            <Link to="/app/mailboxes" className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline">connect gmail →</Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <section className="space-y-5">
            <Field label="From name (optional)">
              <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your name"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20" />
            </Field>

            <Field label="Subject" hint="Use {{name}} or any column from your list">
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-base outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20" />
            </Field>

            <Field label="Body" hint="Paste from Word or import HTML. Use {{vars}} for per-recipient values.">
              <RichEditor value={bodyHtml} onChange={setBodyHtml} />
            </Field>

            <Field label="Attachments" hint={`${attachments.length}/10 files · ${fmtBytes(totalAttachSize)} / 20 MB`}>
              <div className="space-y-2">
                <input ref={fileInputRef} type="file" multiple onChange={(e) => handleFiles(e.target.files)}
                  className="block w-full font-mono text-xs file:mr-3 file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:font-mono file:text-xs file:uppercase file:tracking-wider file:text-foreground hover:file:bg-muted" />
                {attachments.length > 0 && (
                  <ul className="divide-y divide-border border border-border">
                    {attachments.map((a, i) => (
                      <li key={`${a.filename}-${i}`} className="flex items-center justify-between px-3 py-2 font-mono text-xs">
                        <span className="truncate">{a.filename}</span>
                        <span className="ml-3 flex items-center gap-3 text-muted-foreground">
                          <span>{fmtBytes(a.size)}</span>
                          <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                            className="text-destructive hover:underline">remove</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>

            <Field label="Recipients" hint={`CSV or TSV. First row = headers (email required). ${parsed.rows.length} valid · cols: ${parsed.headers.join(", ") || "none"}`}>
              <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={8}
                placeholder={"email,name,company\nada@hey.com,Ada,Analytica\ngrace@hey.com,Grace,USN"}
                className="w-full resize-none rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20" />
            </Field>

            <div className="rounded-md border border-border bg-muted/30 p-4">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
                <span>
                  <span className="font-medium">I confirm every recipient in this list explicitly opted in</span> to receive email from me, and I can produce proof of consent on request. Carrot Mails is permission-based only, cold outreach is not allowed.
                </span>
              </label>
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">How did they opt in?</label>
                <input
                  type="text"
                  value={consentSource}
                  onChange={(e) => setConsentSource(e.target.value)}
                  placeholder="e.g. Signed up via my website form on 2025-04-12"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-muted-foreground">
                {parsed.rows.length} recipient{parsed.rows.length === 1 ? "" : "s"} ready
              </div>
              <Button onClick={attemptSend}
                disabled={sending || parsed.rows.length === 0 || !subject.trim() || !bodyHtml.replace(/<[^>]+>/g, "").trim()}
                className="rounded-md px-6 py-2.5">
                {sending ? "Sending…" : `Send to ${parsed.rows.length}`}
              </Button>
            </div>
          </section>

          <section className="lg:sticky lg:top-10 lg:self-start">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Preview</h2>
              <span className="text-xs text-muted-foreground">{sample.email}</span>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 border-b border-border pb-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</div>
                <div className="mt-1 text-base font-medium">
                  {applyVars(subject, sample) || <span className="text-muted-foreground">None</span>}
                </div>
              </div>
              <div className="qq-content text-[15px] leading-relaxed text-foreground"
                dangerouslySetInnerHTML={{ __html: applyVars(bodyHtml, sample) }} />
              {attachments.length > 0 && (
                <div className="mt-4 border-t border-border pt-3 font-mono text-xs text-muted-foreground">
                  📎 {attachments.length} attachment{attachments.length === 1 ? "" : "s"} · {attachments.map((a) => a.filename).join(", ")}
                </div>
              )}
            </div>

            {result && (
              <div className="mt-6 border border-border p-4">
                <div className="flex items-baseline gap-4 font-mono text-sm">
                  <span><span className="text-foreground">{result.sent}</span><span className="text-muted-foreground"> sent</span></span>
                  {result.failed > 0 && <span className="text-destructive">{result.failed} failed</span>}
                </div>
                {result.failed > 0 && (
                  <ul className="mt-3 max-h-40 overflow-auto font-mono text-xs text-muted-foreground">
                    {result.results.filter((r) => !r.ok).map((r) => (
                      <li key={r.email}>{r.email}: {r.error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <SendBlockedDialog
        open={blockReason !== null}
        onOpenChange={(o) => !o && setBlockReason(null)}
        reason={blockReason ?? "plan"}
      />
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function QuotaBar({ used, limit }: { used: number; limit: number }) {
  const left = Math.max(0, limit - used);
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const low = left <= Math.max(1, Math.floor(limit * 0.1));
  return (
    <div className="mb-8 border border-border px-5 py-4">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Growth · sends this period</div>
        <div className={`font-mono text-xs ${low ? "text-destructive" : "text-foreground"}`}>
          {used.toLocaleString()}/{limit.toLocaleString()} used
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full bg-muted">
        <div className={`h-full ${low ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      {low && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Running low. Upgrade to Lifetime for unlimited sending.</span>
          <Link to="/app/billing" className="font-mono text-[11px] uppercase tracking-widest text-primary hover:underline">upgrade →</Link>
        </div>
      )}
    </div>
  );
}
