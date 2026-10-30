import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RichEditor } from "@/components/RichEditor";
import {
  createAutomationCampaign, listAutomationCampaigns, getAutomationCampaign, updateAutomationCampaign,
  duplicateAutomationCampaign, saveAutomationStep, listAutomationContacts, upsertAutomationContact,
  deleteAutomationContact, importAutomationContacts, listAutomationEvents,
  listAutomationSuppressions, addAutomationSuppression, removeAutomationSuppression,
} from "@/lib/automation/automation.functions";
import {
  runAutomationAudit, createAutomationDrafts, createAutomationTestDraft, reconcileAutomationSent,
} from "@/lib/automation/automation-drafts.functions";
import { generateDueFollowUps, sendSelectedFollowUps, scanCampaignThreads } from "@/lib/automation/automation-followups.functions";

export const Route = createFileRoute("/_authenticated/app/automation")({
  head: () => ({ meta: [
    { title: "Automation | Carrot Mails" },
    { name: "description", content: "Gmail draft campaigns with per-recipient CC, four follow-up stages, reply and bounce tracking." },
    { name: "robots", content: "noindex" },
  ] }),
  component: AutomationPage,
});

const STAGES = ["fu1", "fu2", "fu3", "fu4"] as const;
const STAGE_LABEL: Record<string, string> = { fu1: "FU1", fu2: "FU2", fu3: "FU3", fu4: "FU4" };
const STATUS_COLOR: Record<string, string> = {
  draft: "text-muted-foreground", preparing: "text-muted-foreground", active: "text-primary",
  paused: "text-muted-foreground", completed: "text-foreground", archived: "text-muted-foreground",
};

function AutomationPage() {
  const [section, setSection] = useState<"campaigns" | "activity" | "suppression">("campaigns");
  const [openId, setOpenId] = useState<string | null>(null);

  if (openId) return <CampaignDetail id={openId} onBack={() => setOpenId(null)} />;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Automation</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Draft-based outreach: Carrot Mails creates a personalised Gmail draft for every contact (with their own CC),
        you review and send from Gmail, and follow-ups continue inside the same thread for up to four stages.
        Nothing sends automatically without your explicit approval.
      </p>

      <div className="mt-6 flex gap-6 border-b border-border font-mono text-[11px] uppercase tracking-widest">
        {(["campaigns", "activity", "suppression"] as const).map((s) => (
          <button key={s} onClick={() => setSection(s)}
            className={`pb-2 transition ${section === s ? "border-b border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {s}
          </button>
        ))}
      </div>

      {section === "campaigns" && <CampaignsSection onOpen={setOpenId} />}
      {section === "activity" && <ActivitySection />}
      {section === "suppression" && <SuppressionSection />}
    </div>
  );
}

// ============= Campaigns list =============

function CampaignsSection({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAutomationCampaigns);
  const createFn = useServerFn(createAutomationCampaign);
  const dupFn = useServerFn(duplicateAutomationCampaign);
  const updateFn = useServerFn(updateAutomationCampaign);

  const { data: campaigns, isLoading } = useQuery({ queryKey: ["automation-campaigns"], queryFn: () => listFn() });

  const create = useMutation({
    mutationFn: (name: string) => createFn({ data: { name } }),
    onSuccess: (c: any) => { qc.invalidateQueries({ queryKey: ["automation-campaigns"] }); onOpen(c.id); },
    onError: (e: Error) => toast.error(e.message),
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-campaigns"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const patch = useMutation({
    mutationFn: (p: { id: string; patch: Record<string, unknown> }) => updateFn({ data: p }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-campaigns"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-8">
      <div className="flex gap-2">
        <input placeholder="New campaign name" className="w-64 border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value.trim()) { create.mutate(e.currentTarget.value.trim()); e.currentTarget.value = ""; } }} />
        <button onClick={() => create.mutate("Untitled campaign")} disabled={create.isPending}
          className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
          New campaign
        </button>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : !campaigns?.length ? (
        <p className="mt-6 text-sm text-muted-foreground">No campaigns yet. Create one above.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border border border-border">
          {campaigns.map((c: any) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <button onClick={() => onOpen(c.id)} className="text-left">
                <div className="text-sm font-medium hover:text-primary">{c.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span className={STATUS_COLOR[c.status] ?? ""}>{c.status}</span>
                  {" · "}{c.stats.total} contacts · {c.stats.initialDrafts} drafts · {c.stats.sent} sent · {c.stats.replies} replies · {c.stats.bounces} bounced
                </div>
              </button>
              <div className="flex gap-2 font-mono text-[10px] uppercase tracking-widest">
                {c.status === "active" ? (
                  <button onClick={() => patch.mutate({ id: c.id, patch: { status: "paused" } })} className="text-muted-foreground hover:text-foreground">pause</button>
                ) : c.status === "paused" ? (
                  <button onClick={() => patch.mutate({ id: c.id, patch: { status: "active" } })} className="text-muted-foreground hover:text-foreground">resume</button>
                ) : null}
                <button onClick={() => { if (confirm(`Duplicate "${c.name}"?`)) duplicate.mutate(c.id); }} className="text-muted-foreground hover:text-foreground">duplicate</button>
                <button onClick={() => { if (confirm(`Archive "${c.name}"? Draft creation stops.`)) patch.mutate({ id: c.id, patch: { status: "archived" } }); }} className="text-muted-foreground hover:text-foreground">archive</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============= Activity =============

function ActivitySection() {
  const listFn = useServerFn(listAutomationEvents);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const listFn2 = useServerFn(listAutomationCampaigns);
  const { data: campaigns } = useQuery({ queryKey: ["automation-campaigns"], queryFn: () => listFn2() });
  const { data: events, isLoading } = useQuery({
    queryKey: ["automation-events", campaignFilter, typeFilter],
    queryFn: () => listFn({ data: { campaignId: campaignFilter || undefined, eventType: typeFilter || undefined, limit: 100 } }),
  });
  const types = ["draft_created", "email_manually_sent", "followup_generated", "followup_sent", "reply_received", "bounce_detected", "contact_suppressed", "duplicate_prevented", "invalid_recipient", "error", "ooo_detected", "manual_outreach_detected", "audit_run"];
  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3">
        <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="border border-border px-3 py-2 text-sm">
          <option value="">All campaigns</option>
          {(campaigns ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border border-border px-3 py-2 text-sm">
          <option value="">All activity</option>
          {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      {isLoading ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : !events?.length ? (
        <p className="mt-6 text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border border border-border">
          {events.map((e: any) => (
            <li key={e.id} className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{e.event_type.replace(/_/g, " ")}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 truncate text-sm text-muted-foreground">{JSON.stringify(e.detail ?? {}).slice(0, 160)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============= Suppression =============

function SuppressionSection() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAutomationSuppressions);
  const addFn = useServerFn(addAutomationSuppression);
  const rmFn = useServerFn(removeAutomationSuppression);
  const { data: rows, isLoading } = useQuery({ queryKey: ["automation-suppressions"], queryFn: () => listFn() });
  const add = useMutation({
    mutationFn: (d: { email: string; reason: string; note?: string }) => addFn({ data: d }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-suppressions"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => rmFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-suppressions"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("manual");
  const active = (rows ?? []).filter((r: any) => !r.removed_at);
  const removed = (rows ?? []).filter((r: any) => r.removed_at);
  return (
    <div className="mt-8">
      <p className="text-sm text-muted-foreground">
        Suppressed contacts never receive drafts or follow-ups: initial drafts, FU1-FU4 and any in-app sending all check this list first.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com"
          className="w-64 border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="border border-border px-3 py-2 text-sm">
          <option value="manual">Manual</option><option value="hard_bounce">Hard bounce</option>
          <option value="unsubscribe">Unsubscribe</option><option value="invalid">Invalid address</option>
        </select>
        <button onClick={() => { if (email.trim()) { add.mutate({ email: email.trim(), reason }); setEmail(""); } }} disabled={add.isPending}
          className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">Suppress</button>
      </div>
      {isLoading ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : !active.length ? (
        <p className="mt-6 text-sm text-muted-foreground">No active suppressions.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border border border-border">
          {active.map((r: any) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <div className="text-sm">{r.email}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{r.reason} · {new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <button onClick={() => { if (confirm(`Remove suppression for ${r.email}?`)) remove.mutate(r.id); }}
                className="font-mono text-[10px] uppercase tracking-widest text-destructive hover:underline">remove</button>
            </li>
          ))}
        </ul>
      )}
      {removed.length > 0 && (
        <div className="mt-8">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Audit trail (removed)</h3>
          <ul className="mt-2 text-xs text-muted-foreground">
            {removed.slice(0, 20).map((r: any) => <li key={r.id}>{r.email} · {r.reason} · removed {new Date(r.removed_at).toLocaleString()}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============= Campaign detail =============

function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getAutomationCampaign);
  const { data, isLoading, error } = useQuery({ queryKey: ["automation-campaign", id], queryFn: () => getFn({ data: { id } }) });
  const [tab, setTab] = useState<"compose" | "recipients" | "followups" | "send">("compose");
  const patch = usePatch(qc, id);

  if (isLoading) return <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="mx-auto max-w-5xl p-8 text-sm text-destructive">{(error as Error)?.message ?? "Not found"} <button onClick={onBack} className="underline">back</button></div>;

  const { campaign, steps, mailboxes } = data as any;
  const stepOf = (s: string) => steps.find((x: any) => x.stage === s);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <button onClick={onBack} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">← campaigns</button>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className={STATUS_COLOR[campaign.status] ?? ""}>{campaign.status}</span>
            {campaign.mailbox_id ? "" : " · no mailbox selected"}
          </div>
        </div>
        <select value={campaign.mailbox_id ?? ""} onChange={(e) => patch.mutate({ mailbox_id: e.target.value || null })}
          className="border border-border px-3 py-2 text-sm">
          <option value="">Select mailbox…</option>
          {mailboxes.map((m: any) => <option key={m.id} value={m.id}>{m.email}</option>)}
        </select>
      </div>

      <div className="mt-6 flex gap-6 border-b border-border font-mono text-[11px] uppercase tracking-widest">
        {(["compose", "recipients", "followups", "send"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 transition ${tab === t ? "border-b border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "compose" && <ComposeTab campaign={campaign} />}
      {tab === "recipients" && <RecipientsTab campaignId={id} />}
      {tab === "followups" && <FollowUpsTab campaignId={id} steps={steps} />}
      {tab === "send" && <SendTab campaign={campaign} stepOf={stepOf} />}
    </div>
  );
}

function usePatch(qc: any, campaignId: string) {
  const updateFn = useServerFn(updateAutomationCampaign);
  return useMutation({
    mutationFn: (p: Record<string, unknown>) => updateFn({ data: { id: campaignId, patch: p } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["automation-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function ComposeTab({ campaign }: { campaign: any }) {
  const qc = useQueryClient();
  const patch = usePatch(qc, campaign.id);
  const [subject, setSubject] = useState(campaign.subject ?? "");
  const [body, setBody] = useState(campaign.body_html ?? "");
  const [fromName, setFromName] = useState(campaign.from_name ?? "");
  const [defaultCc, setDefaultCc] = useState(campaign.default_cc ?? "");
  const [defaultBcc, setDefaultBcc] = useState(campaign.default_bcc ?? "");
  const [attachments, setAttachments] = useState<any[]>(campaign.attachments ?? []);

  const save = () => patch.mutate({ subject, body_html: body, from_name: fromName || null, default_cc: defaultCc || null, default_bcc: defaultBcc || null, attachments });

  const addFiles = async (files: FileList) => {
    const out: any[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 15 * 1024 * 1024) { toast.error(`${f.name} is over 15 MB`); continue; }
      const dataBase64 = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.readAsDataURL(f); });
      out.push({ filename: f.name, contentType: f.type || "application/octet-stream", dataBase64 });
    }
    setAttachments((a) => [...a, ...out].slice(0, 5));
  };

  return (
    <div className="mt-8 max-w-3xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">From name</span>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your name"
            className="mt-1 w-full border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Subject (supports {"{{name}}"}, {"{{company}}"})</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Default CC (comma separated)</span>
          <input value={defaultCc} onChange={(e) => setDefaultCc(e.target.value)} placeholder="Used when a contact has no own CC"
            className="mt-1 w-full border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block text-sm">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Default BCC</span>
          <input value={defaultBcc} onChange={(e) => setDefaultBcc(e.target.value)}
            className="mt-1 w-full border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
        </label>
      </div>
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email body</span>
        <div className="mt-1 border border-border"><RichEditor value={body} onChange={setBody} /></div>
      </div>
      <div className="text-sm">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Attachments</span>
        <input type="file" multiple onChange={(e) => e.target.files && addFiles(e.target.files)} className="mt-1 block text-sm" />
        {attachments.length > 0 && (
          <ul className="mt-2 text-xs text-muted-foreground">
            {attachments.map((a: any, i: number) => (
              <li key={i}>{a.filename} <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))} className="text-destructive hover:underline">remove</button></li>
            ))}
          </ul>
        )}
      </div>
      <button onClick={save} disabled={patch.isPending}
        className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">Save email</button>
    </div>
  );
}

// ============= Recipients =============

const CONTACT_COLS = [
  { key: "email", label: "Email" }, { key: "name", label: "Name" }, { key: "first_name", label: "First name" },
  { key: "name2", label: "Name 2" }, { key: "company", label: "Company" }, { key: "role", label: "Role" },
  { key: "cc", label: "CC" }, { key: "bcc", label: "BCC" }, { key: "followup_cc", label: "FU CC" }, { key: "status", label: "Status" },
] as const;

function RecipientsTab({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAutomationContacts);
  const upsertFn = useServerFn(upsertAutomationContact);
  const delFn = useServerFn(deleteAutomationContact);
  const importFn = useServerFn(importAutomationContacts);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const { data } = useQuery({ queryKey: ["automation-contacts", campaignId, page], queryFn: () => listFn({ data: { campaignId, page, pageSize } }) });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["automation-contacts", campaignId] });
    qc.invalidateQueries({ queryKey: ["automation-campaigns"] });
  };
  const del = useMutation({ mutationFn: (cid: string) => delFn({ data: { campaignId, contactId: cid } }), onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });

  // CSV import (client-side parse, server maps + validates).
  const [importOpen, setImportOpen] = useState(false);
  const onFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { toast.error("CSV needs a header row and at least one contact"); return; }
    const split = (line: string) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((s) => s.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
    const headers = split(lines[0]);
    const rows = lines.slice(1, 5001).map((l) => {
      const cells = split(l);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      return row;
    });
    const res = await importFn({ data: { campaignId, headers, rows } });
    toast.success(`Imported ${res.imported}${res.duplicates ? `, ${res.duplicates} duplicates skipped` : ""}${res.invalid ? `, ${res.invalid} invalid` : ""}`);
    invalidate();
  };

  const rows = data?.rows ?? [];
  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setImportOpen(true)} className="border border-border px-4 py-2 text-sm hover:bg-muted">Import CSV</button>
        <AddContact campaignId={campaignId} onDone={invalidate} />
      </div>

      {importOpen && (
        <div className="mt-4 border border-border p-4 text-sm">
          <p className="text-muted-foreground">
            Column headers become personalisation variables automatically ({"{{name}}"}, {"{{company}}"}, or any custom column).
            Reserved columns: Email, Name, First Name, Name 2, Company, Role, CC, BCC, Follow-up CC.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="mt-3 text-sm" />
          <button onClick={() => setImportOpen(false)} className="mt-3 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">close</button>
        </div>
      )}

      {!rows.length ? (
        <p className="mt-6 text-sm text-muted-foreground">No recipients yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {CONTACT_COLS.map((c) => <th key={c.key} className="px-3 py-2 font-medium">{c.label}</th>)}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  {CONTACT_COLS.map((c) => (
                    <td key={c.key} className="max-w-[180px] truncate px-3 py-2">
                      {c.key === "followup_cc" ? (r.followup_cc ? "YES" : "no") : c.key === "status" ? <span className="font-mono text-[10px] uppercase tracking-widest">{r.status}</span> : (r[c.key] ?? "")}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => { if (confirm(`Remove ${r.email}?`)) del.mutate(r.id); }} className="font-mono text-[10px] uppercase tracking-widest text-destructive hover:underline">remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > pageSize && (
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>{data.total} contacts</span>
          <div className="flex gap-3">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30">prev</button>
            <span>page {page + 1} / {Math.ceil(data.total / pageSize)}</span>
            <button disabled={(page + 1) * pageSize >= data.total} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30">next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddContact({ campaignId, onDone }: { campaignId: string; onDone: () => void }) {
  const upsertFn = useServerFn(upsertAutomationContact);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", name: "", first_name: "", name2: "", company: "", role: "", cc: "", bcc: "", followup_cc: false });
  const mut = useMutation({
    mutationFn: () => upsertFn({ data: { campaignId, contact: f } }),
    onSuccess: () => { toast.success("Contact added"); setF({ email: "", name: "", first_name: "", name2: "", company: "", role: "", cc: "", bcc: "", followup_cc: false }); setOpen(false); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!open) return <button onClick={() => setOpen(true)} className="border border-border px-4 py-2 text-sm hover:bg-muted">Add contact</button>;
  const fields: [keyof typeof f, string][] = [["email", "Email *"], ["name", "Name"], ["first_name", "First name"], ["name2", "Name 2"], ["company", "Company"], ["role", "Role"], ["cc", "CC (this contact only)"], ["bcc", "BCC"]];
  return (
    <div className="border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([k, label]) => (
          <label key={k} className="block text-sm">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
            <input value={f[k] as string} onChange={(e) => setF({ ...f, [k]: e.target.value })}
              className="mt-1 w-full border border-border px-2 py-1.5 text-sm outline-none focus:border-primary" />
          </label>
        ))}
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" checked={f.followup_cc} onChange={(e) => setF({ ...f, followup_cc: e.target.checked })} />
          <span>Keep CC in follow-ups</span>
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">Save contact</button>
        <button onClick={() => setOpen(false)} className="border border-border px-4 py-2 text-sm hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}

// ============= Follow-up sequence editor =============

function FollowUpsTab({ campaignId, steps }: { campaignId: string; steps: any[] }) {
  return (
    <div className="mt-8 max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Each stage becomes a reply inside the original Gmail thread, scheduled from the previous stage's actual sent time.
        Default mode creates a Gmail draft for your review; nothing sends itself.
      </p>
      {steps.filter((s: any) => s.stage !== "initial").map((s: any) => (
        <StepEditor key={s.id} campaignId={campaignId} step={s} />
      ))}
    </div>
  );
}

function StepEditor({ campaignId, step }: { campaignId: string; step: any }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveAutomationStep);
  const [enabled, setEnabled] = useState(step.enabled);
  const [delay, setDelay] = useState(step.delay_days);
  const [subject, setSubject] = useState(step.subject ?? "");
  const [body, setBody] = useState(step.body_html ?? "");
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: () => saveFn({ data: { campaignId, stage: step.stage, patch: { enabled, delay_days: Number(delay) || 0, subject: subject || null, body_html: body } } }),
    onSuccess: () => { toast.success(`${STAGE_LABEL[step.stage]} saved`); qc.invalidateQueries({ queryKey: ["automation-campaign", campaignId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="border border-border">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm">
        <span className="font-medium">{STAGE_LABEL[step.stage]} <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{enabled ? `after ${delay} days` : "disabled"}</span></span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{open ? "close" : "edit"}</span>
      </button>
      {open && (
        <div className="border-t border-border p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled</label>
            <label className="flex items-center gap-2">Delay days <input type="number" min={0} max={60} value={delay} onChange={(e) => setDelay(Number(e.target.value))} className="w-16 border border-border px-2 py-1" /></label>
            <label className="flex flex-1 items-center gap-2">Subject override <input value={subject} placeholder="(inherit original)" onChange={(e) => setSubject(e.target.value)} className="flex-1 border border-border px-2 py-1.5" /></label>
          </div>
          <div className="mt-3 border border-border"><RichEditor value={body} onChange={setBody} /></div>
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="mt-3 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">Save {STAGE_LABEL[step.stage]}</button>
        </div>
      )}
    </div>
  );
}

// ============= Send workspace (drafts, audit, reconcile, scan) =============

type AuditRow = { contact_id: string; email: string; eligible: boolean; reason?: string; cc: string[]; bcc: string[]; missingVars: string[] };

function SendTab({ campaign, stepOf }: { campaign: any; stepOf: (s: string) => any }) {
  const qc = useQueryClient();
  const auditFn = useServerFn(runAutomationAudit);
  const draftsFn = useServerFn(createAutomationDrafts);
  const testFn = useServerFn(createAutomationTestDraft);
  const reconcileFn = useServerFn(reconcileAutomationSent);
  const scanFn = useServerFn(scanCampaignThreads);
  const genFuFn = useServerFn(generateDueFollowUps);
  const sendFuFn = useServerFn(sendSelectedFollowUps);

  const [audit, setAudit] = useState<{ summary: any; rows: AuditRow[] } | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [fuPreview, setFuPreview] = useState<any>(null);
  const [fuConfirming, setFuConfirming] = useState(false);

  const initialReady = Boolean(campaign.subject?.trim() || campaign.body_html?.trim());
  const mailboxReady = Boolean(campaign.mailbox_id);

  const runAudit = useMutation({
    mutationFn: () => auditFn({ data: { campaignId: campaign.id, stage: "initial" } }),
    onSuccess: (r: any) => { setAudit(r); qc.invalidateQueries({ queryKey: ["automation-events"] }); toast.success(`Audit: ${r.summary.eligible} of ${r.summary.total} ready`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const createDrafts = useMutation({
    mutationFn: () => draftsFn({ data: { campaignId: campaign.id, stage: "initial", batchLimit: 10 } }),
    onSuccess: (r: any) => {
      setLastResult(r);
      qc.invalidateQueries({ queryKey: ["automation-campaigns"] });
      qc.invalidateQueries({ queryKey: ["automation-campaign", campaign.id] });
      qc.invalidateQueries({ queryKey: ["automation-events"] });
      toast.success(`${r.created} Gmail drafts created${r.remaining ? `, ${r.remaining} remaining` : ""}${r.failed ? `, ${r.failed} failed` : ""}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const testDraft = useMutation({
    mutationFn: () => testFn({ data: { campaignId: campaign.id } }),
    onSuccess: (r: any) => toast.success(`Test draft created in your Gmail for ${r.to}`),
    onError: (e: Error) => toast.error(e.message),
  });
  const reconcile = useMutation({
    mutationFn: () => reconcileFn({ data: { campaignId: campaign.id } }),
    onSuccess: (r: any) => { setReconcileResult(r); qc.invalidateQueries({ queryKey: ["automation-campaigns"] }); qc.invalidateQueries({ queryKey: ["automation-events"] }); toast.success(`${r.reconciled} marked as sent, ${r.ambiguous} ambiguous`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const scan = useMutation({
    mutationFn: () => scanFn({ data: { campaignId: campaign.id, batchLimit: 25 } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["automation-campaigns"] }); qc.invalidateQueries({ queryKey: ["automation-events"] }); toast.success(`Scanned ${r.scanned} threads: ${r.replies} replies, ${r.bounces} bounces, ${r.manual} manual`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const genFu = useMutation({
    mutationFn: () => genFuFn({ data: { campaignId: campaign.id, batchLimit: 10 } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["automation-campaign", campaign.id] }); qc.invalidateQueries({ queryKey: ["automation-events"] }); toast.success(`${r.generated} follow-up drafts generated`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendFu = useMutation({
    mutationFn: (confirm: boolean) => sendFuFn({ data: { campaignId: campaign.id, contactIds: fuPreview?.preview.filter((p: any) => p.status === "eligible").map((p: any) => p.contact_id ?? p.email) ?? [], confirm } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const eligibleCount = audit?.summary.eligible ?? 0;

  return (
    <div className="mt-8 space-y-8">
      <section className="border border-border p-5">
        <h2 className="text-sm font-medium">Initial emails: Gmail drafts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Carrot Mails creates one personalised Gmail draft per contact (row CC overrides the campaign default CC).
          You review and send them from Gmail; drafts are never sent automatically. Duplicate drafts are prevented.
        </p>
        {!mailboxReady && <p className="mt-3 text-sm text-destructive">Select a mailbox above before creating drafts.</p>}
        {!initialReady && <p className="mt-3 text-sm text-destructive">Compose the email first.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => runAudit.mutate()} disabled={runAudit.isPending || !initialReady} className="border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
            {runAudit.isPending ? "Auditing…" : "Dry run / validate recipients"}
          </button>
          <button onClick={() => { if (confirm(`Create up to 10 Gmail drafts for eligible contacts?\nNo email is sent.`)) createDrafts.mutate(); }}
            disabled={createDrafts.isPending || !initialReady || !mailboxReady} className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {createDrafts.isPending ? "Creating drafts…" : "Create Gmail drafts (batch of 10)"}
          </button>
          <button onClick={() => { if (confirm("Create one test draft addressed only to your own mailbox?")) testDraft.mutate(); }}
            disabled={testDraft.isPending || !mailboxReady} className="border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Create test draft</button>
        </div>
        {audit && (
          <div className="mt-4 text-sm">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Audit {new Date(audit.summary.created_at).toLocaleTimeString()}: {audit.summary.eligible} eligible / {audit.summary.blocked} blocked
            </div>
            {audit.rows.filter((r) => !r.eligible).length > 0 && (
              <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-muted-foreground">
                {audit.rows.filter((r) => !r.eligible).map((r) => (
                  <li key={r.contact_id}><span className="text-foreground">{r.email}</span> · {r.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {lastResult && (
          <div className="mt-4 text-xs">
            {lastResult.results.map((r: any, i: number) => (
              <div key={i} className={r.ok ? "text-muted-foreground" : "text-destructive"}>
                {r.ok ? `✓ ${r.email}` : `✕ ${r.email}: ${r.error}`}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border border-border p-5">
        <h2 className="text-sm font-medium">After you send from Gmail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reconcile marks drafts you manually sent as sent (matched by recipient and subject in Gmail Sent) and schedules the next follow-up
          from the real send time. The thread scan picks up replies, out-of-offices and bounces, and stops sequences when a human replies or a hard bounce arrives.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => reconcile.mutate()} disabled={reconcile.isPending} className="border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
            {reconcile.isPending ? "Reconciling…" : "Reconcile manually sent drafts"}
          </button>
          <button onClick={() => scan.mutate()} disabled={scan.isPending} className="border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
            {scan.isPending ? "Scanning…" : "Scan for replies & bounces"}
          </button>
        </div>
        {reconcileResult && (
          <ul className="mt-4 max-h-40 overflow-y-auto text-xs text-muted-foreground">
            {reconcileResult.results.map((r: any, i: number) => <li key={i}>{r.email} ({r.stage}): {r.status}</li>)}
          </ul>
        )}
      </section>

      <section className="border border-border p-5">
        <h2 className="text-sm font-medium">Follow-ups</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mode A (default): create reply drafts in the thread for you to send. Mode B: explicitly select and send from here,
          with a dry-run preview and a fresh safety recheck right before every send.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => genFu.mutate()} disabled={genFu.isPending} className="border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
            {genFu.isPending ? "Generating…" : "Create due follow-up drafts"}
          </button>
          <button onClick={() => sendFu.mutate(false)} disabled={!mailboxReady}
            className="border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Preview eligible follow-ups (dry run)</button>
          {fuPreview?.mode === "dry_run" && fuPreview.eligibleCount > 0 && !fuConfirming && (
            <button onClick={() => setFuConfirming(true)} className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Send {fuPreview.eligibleCount} follow-up(s)
            </button>
          )}
          {fuConfirming && (
            <button onClick={() => { sendFu.mutate(true); setFuConfirming(false); }} disabled={sendFu.isPending}
              className="bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90">
              Confirm: really send now
            </button>
          )}
        </div>
        {fuPreview && (
          <ul className="mt-4 max-h-40 overflow-y-auto text-xs text-muted-foreground">
            {fuPreview.preview.map((p: any, i: number) => <li key={i} className={p.status === "eligible" ? "" : "text-destructive"}>{p.email}: {p.status}{p.reason ? ` (${p.reason})` : ""}</li>)}
          </ul>
        )}
        {sendFu.data && sendFu.data.mode === "sent" && (
          <p className="mt-3 text-sm">{sendFu.data.sent} sent, {sendFu.data.failed} failed. Gmail accepted the requests; check each thread for delivery.</p>
        )}
      </section>
    </div>
  );
}
