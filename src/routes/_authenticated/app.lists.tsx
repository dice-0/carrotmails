import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppPage } from "@/components/AppPage";
import { Button } from "@/components/ui/button";
import { deleteContactList, importContactList, listContactLists } from "@/lib/lists.functions";

export const Route = createFileRoute("/_authenticated/app/lists")({
  head: () => ({ meta: [{ title: "Lists — Quill" }, { name: "robots", content: "noindex" }] }),
  component: ListsPage,
});

type Contact = { email: string; vars: Record<string, string> };

function parseCsv(raw: string) {
  const rows = raw.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    const cells: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if ((char === "," || char === "\t") && !quoted) { cells.push(value.trim()); value = ""; }
      else value += char;
    }
    cells.push(value.trim());
    return cells;
  });
  if (rows.length < 2) return { headers: rows[0] ?? [], contacts: [] as Contact[], invalid: 0, duplicates: 0 };
  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
  const emailIndex = headers.indexOf("email");
  if (emailIndex < 0) return { headers, contacts: [] as Contact[], invalid: rows.length - 1, duplicates: 0, error: "Your CSV needs an email column." };
  const seen = new Set<string>();
  const contacts: Contact[] = [];
  let invalid = 0;
  let duplicates = 0;
  rows.slice(1).forEach((row) => {
    const email = (row[emailIndex] ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { invalid += 1; return; }
    if (seen.has(email)) { duplicates += 1; return; }
    seen.add(email);
    const vars: Record<string, string> = {};
    headers.forEach((header, index) => { if (header && header !== "email" && row[index]) vars[header] = row[index]; });
    contacts.push({ email, vars });
  });
  return { headers, contacts, invalid, duplicates };
}

function ListsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const list = useServerFn(listContactLists);
  const importList = useServerFn(importContactList);
  const remove = useServerFn(deleteContactList);
  const [name, setName] = useState("");
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState("");
  const [showImport, setShowImport] = useState(false);
  const parsed = useMemo(() => parseCsv(raw), [raw]);
  const { data: lists = [], isLoading } = useQuery({ queryKey: ["contact-lists"], queryFn: () => list() });
  const importMutation = useMutation({
    mutationFn: () => importList({ data: { name, contacts: parsed.contacts } }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["contact-lists"] });
      setShowImport(false); setRaw(""); setName(""); setFileName("");
      toast.success(`Imported ${result.report.imported} clean contacts`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({ mutationFn: (id: string) => remove({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-lists"] }), onError: (error: Error) => toast.error(error.message) });

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("CSV files must be under 5 MB"); return; }
    setFileName(file.name);
    setName(file.name.replace(/\.(csv|tsv|txt)$/i, ""));
    setRaw(await file.text());
  }

  return (
    <AppPage eyebrow="Audience" title="Contact lists" description="Import a clean audience once. Every upload is normalized, deduplicated, validated, and checked against your suppression list." action={<Button onClick={() => setShowImport(true)}>Import CSV</Button>}>
      {showImport && (
        <section className="mb-10 border-y border-border py-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-5">
              <label className="block"><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">List name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="June prospects" className="mt-2 w-full border-b border-border bg-transparent py-2 outline-none focus:border-foreground" /></label>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Source file</p>
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-2 flex min-h-28 w-full flex-col items-center justify-center border border-dashed border-border px-6 text-center transition hover:bg-muted">
                  <span className="text-sm font-medium">{fileName || "Choose a CSV or TSV file"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">First row must contain headers, including email</span>
                </button>
                <input ref={inputRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" className="hidden" onChange={(event) => readFile(event.target.files?.[0])} />
              </div>
              {raw && <div className="grid grid-cols-3 divide-x divide-border border-y border-border py-4 text-center"><Metric value={parsed.contacts.length} label="clean" /><Metric value={parsed.duplicates} label="duplicates" /><Metric value={parsed.invalid} label="invalid" /></div>}
              {parsed.error && <p className="text-sm text-destructive">{parsed.error}</p>}
              <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowImport(false)}>Cancel</Button><Button disabled={!name.trim() || parsed.contacts.length === 0 || importMutation.isPending} onClick={() => importMutation.mutate()}>{importMutation.isPending ? "Running hygiene…" : `Import ${parsed.contacts.length}`}</Button></div>
            </div>
            <aside className="border-l border-border pl-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hygiene pipeline</p>
              <ol className="mt-4 space-y-4 text-sm"><HygieneStep number="01" text="Normalize casing and whitespace" /><HygieneStep number="02" text="Remove malformed addresses" /><HygieneStep number="03" text="Dedupe within the upload" /><HygieneStep number="04" text="Exclude suppressed contacts" /></ol>
            </aside>
          </div>
        </section>
      )}
      <div className="mb-4 flex items-center justify-between"><h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Saved lists</h2><span className="font-mono text-[10px] text-muted-foreground">{lists.length} total</span></div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading lists…</p> : lists.length === 0 ? <div className="border-y border-border py-14 text-center"><h2 className="text-lg font-medium">No lists yet</h2><p className="mt-2 text-sm text-muted-foreground">Import your first clean contact list to get started.</p></div> : <div className="divide-y divide-border border-y border-border">{lists.map((item) => <article key={item.id} className="flex items-center justify-between gap-6 py-5"><div><h3 className="font-medium">{item.name}</h3><p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{item.contact_count} clean contacts · {new Date(item.updated_at).toLocaleDateString()}</p></div><Button variant="ghost" size="sm" className="text-destructive" onClick={() => confirm(`Delete ${item.name}?`) && deleteMutation.mutate(item.id)}>Delete</Button></article>)}</div>}
    </AppPage>
  );
}

function Metric({ value, label }: { value: number; label: string }) { return <div><div className="text-xl font-semibold">{value}</div><div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div></div>; }
function HygieneStep({ number, text }: { number: string; text: string }) { return <li className="flex gap-3"><span className="font-mono text-[10px] text-muted-foreground">{number}</span><span>{text}</span></li>; }