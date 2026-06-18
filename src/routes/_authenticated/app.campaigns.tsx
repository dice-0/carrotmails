import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppPage } from "@/components/AppPage";
import { Button } from "@/components/ui/button";
import { RichEditor } from "@/components/RichEditor";
import {
  createCampaign,
  deleteCampaign,
  dispatchCampaign,
  getCampaign,
  listCampaigns,
  pauseCampaign,
} from "@/lib/campaigns.functions";
import { listContactLists } from "@/lib/lists.functions";
import { listTemplates } from "@/lib/templates.functions";

export const Route = createFileRoute("/_authenticated/app/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns | Carrot Mails" }, { name: "robots", content: "noindex" }] }),
  component: CampaignsPage,
});

type CampaignRow = Awaited<ReturnType<typeof listCampaigns>>[number];

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  paused: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  failed: "bg-destructive/15 text-destructive",
  scheduled: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

function CampaignsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listCampaigns);
  const remove = useServerFn(deleteCampaign);
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => list(),
    refetchInterval: (q) => {
      const items = (q.state.data as CampaignRow[] | undefined) ?? [];
      return items.some((c) => c.status === "sending") ? 3000 : false;
    },
  });
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppPage
      eyebrow="Outbound"
      title="Campaigns"
      description="Send to a whole list with throttling, per-recipient status, unsubscribe handling, and live progress."
      action={<Button onClick={() => setShowNew(true)}>New campaign</Button>}
    >
      {showNew && <NewCampaign onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); setOpenId(id); }} />}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">All campaigns</h2>
        <span className="text-xs text-muted-foreground">{campaigns.length} total</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <h3 className="text-lg font-medium">No campaigns yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">Create a list, then launch your first campaign.</p>
          <Button className="mt-5" onClick={() => setShowNew(true)}>New campaign</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Sent</th>
                <th className="px-4 py-3 text-right">Failed</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((c) => {
                const pct = c.total_count ? Math.round(((c.sent_count + c.failed_count) / c.total_count) * 100) : 0;
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <button onClick={() => setOpenId(c.id)} className="text-left font-medium hover:underline">
                        {c.name}
                      </button>
                      <div className="text-xs text-muted-foreground">{c.subject}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[c.status] ?? "bg-muted"}`}>
                        {c.status}
                      </span>
                      {c.status === "sending" && (
                        <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.sent_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{c.failed_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{c.total_count}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(c.updated_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => confirm(`Delete "${c.name}"?`) && deleteMutation.mutate(c.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId && <CampaignDetail id={openId} onClose={() => setOpenId(null)} />}
    </AppPage>
  );
}

function NewCampaign({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const listsFn = useServerFn(listContactLists);
  const templatesFn = useServerFn(listTemplates);
  const create = useServerFn(createCampaign);
  const { data: lists = [] } = useQuery({ queryKey: ["contact-lists"], queryFn: () => listsFn() });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => templatesFn() });

  const [name, setName] = useState("");
  const [listId, setListId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p>Hi {{first_name}},</p><p></p>");
  const [fromName, setFromName] = useState("");
  const [throttleSeconds, setThrottle] = useState(8);
  const [dailyCap, setDailyCap] = useState(200);

  // Pre-fill from compose handoff (Use template -> compose) if user clicked it
  useEffect(() => {
    const s = localStorage.getItem("cm:compose:subject");
    const b = localStorage.getItem("cm:compose:bodyHtml");
    if (s) setSubject(s);
    if (b) setBodyHtml(b);
  }, []);

  const selectedList = lists.find((l) => l.id === listId);

  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          name: name.trim(),
          listId,
          subject: subject.trim(),
          bodyHtml,
          fromName: fromName.trim() || undefined,
          throttleSeconds,
          dailyCap,
        },
      }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(`Campaign created with ${c.total_count} recipients`);
      onCreated(c.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal onClose={onClose} title="New campaign" maxWidth="max-w-3xl">
      <div className="grid gap-5">
        <Field label="Campaign name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="June launch — wave 1" className={inputCls} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Contact list">
            <select value={listId} onChange={(e) => setListId(e.target.value)} className={inputCls}>
              <option value="">Select a list…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.contact_count} contacts
                </option>
              ))}
            </select>
            {selectedList && (
              <p className="mt-1 text-xs text-muted-foreground">{selectedList.contact_count} recipients will be queued (suppressions excluded).</p>
            )}
          </Field>
          <Field label="From name (optional)">
            <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Alex from Carrot" className={inputCls} />
          </Field>
        </div>

        <Field label="Subject">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A quick idea for {{company}}" className={inputCls} />
        </Field>

        <Field label="Body">
          {templates.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Start from template:</span>
              {templates.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setSubject(t.subject || subject); setBodyHtml(t.body_html || bodyHtml); }}
                  className="rounded-full border border-border px-2.5 py-1 hover:bg-muted"
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-xl border border-border">
            <RichEditor value={bodyHtml} onChange={setBodyHtml} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Use <code>{"{{first_name}}"}</code>, <code>{"{{company}}"}</code>, etc. Variables come from CSV columns.
          </p>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Throttle between sends (seconds)">
            <input type="number" min={0} max={120} value={throttleSeconds} onChange={(e) => setThrottle(Number(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Daily cap (recipients)">
            <input type="number" min={1} max={2000} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value) || 1)} className={inputCls} />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!name.trim() || !listId || !subject.trim() || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Creating…" : "Create campaign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CampaignDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getCampaign);
  const dispatch = useServerFn(dispatchCampaign);
  const pause = useServerFn(pauseCampaign);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => get({ data: { id } }),
    refetchInterval: (q) => {
      const c = (q.state.data as { campaign: { status: string } } | undefined)?.campaign;
      return c && c.status === "sending" ? 2500 : false;
    },
  });

  const loopingRef = useRef(false);
  const [looping, setLooping] = useState(false);

  async function runLoop() {
    if (loopingRef.current) return;
    loopingRef.current = true;
    setLooping(true);
    try {
      while (loopingRef.current) {
        const r = await dispatch({ data: { id } });
        await qc.invalidateQueries({ queryKey: ["campaign", id] });
        await qc.invalidateQueries({ queryKey: ["campaigns"] });
        if (r.status !== "sending" || r.remaining === 0) break;
        await new Promise((res) => setTimeout(res, 300));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      loopingRef.current = false;
      setLooping(false);
      refetch();
    }
  }

  async function onPause() {
    loopingRef.current = false;
    await pause({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["campaign", id] });
    await qc.invalidateQueries({ queryKey: ["campaigns"] });
  }

  useEffect(() => () => { loopingRef.current = false; }, []);

  if (isLoading || !data) {
    return (
      <Modal onClose={onClose} title="Campaign" maxWidth="max-w-3xl">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Modal>
    );
  }

  const c = data.campaign;
  const recipients = data.recipients;
  const counts = {
    sent: recipients.filter((r) => r.status === "sent").length,
    failed: recipients.filter((r) => r.status === "failed").length,
    pending: recipients.filter((r) => r.status === "pending").length,
    unsub: recipients.filter((r) => r.status === "unsubscribed").length,
  };
  const pct = c.total_count ? Math.round(((c.sent_count + c.failed_count) / c.total_count) * 100) : 0;

  return (
    <Modal onClose={onClose} title={c.name} maxWidth="max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${STATUS_STYLE[c.status] ?? "bg-muted"}`}>{c.status}</span>
          <span className="text-xs text-muted-foreground">{c.subject}</span>
        </div>
        <div className="flex gap-2">
          {(c.status === "draft" || c.status === "paused") && (
            <Button onClick={runLoop} disabled={looping}>
              {looping ? "Sending…" : c.status === "paused" ? "Resume sending" : "Launch now"}
            </Button>
          )}
          {(c.status === "sending" || looping) && (
            <Button variant="outline" onClick={onPause}>Pause</Button>
          )}
        </div>
      </div>

      <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3 text-center">
        <Stat label="Sent" value={c.sent_count} tone="ok" />
        <Stat label="Failed" value={c.failed_count} tone="bad" />
        <Stat label="Pending" value={Math.max(0, c.total_count - c.sent_count - c.failed_count - c.unsubscribed_count)} />
        <Stat label="Total" value={c.total_count} />
      </div>

      <div className="rounded-xl border border-border">
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
          Recipients ({recipients.length} shown · {counts.sent} sent / {counts.failed} failed / {counts.pending} pending / {counts.unsub} unsubscribed)
        </div>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {recipients.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono text-xs">{r.email}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                      r.status === "sent" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                      r.status === "failed" ? "bg-destructive/15 text-destructive" :
                      r.status === "unsubscribed" ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" :
                      "bg-muted text-muted-foreground"
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.sent_at ? new Date(r.sent_at).toLocaleString() : ""}</td>
                  <td className="px-4 py-2 text-xs text-destructive">{r.error ? r.error.slice(0, 80) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-destructive" : "";
  return (
    <div className="rounded-xl border border-border p-3">
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Modal({ children, onClose, title, maxWidth = "max-w-2xl" }: { children: React.ReactNode; onClose: () => void; title: string; maxWidth?: string }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
      <div className={`mt-10 w-full ${maxWidth} rounded-2xl border border-border bg-background shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
