import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppPage } from "@/components/AppPage";
import { Button } from "@/components/ui/button";
import { deleteForm, listForms, saveForm } from "@/lib/forms.functions";

export const Route = createFileRoute("/_authenticated/app/forms")({
  head: () => ({ meta: [{ title: "Forms | Carrot Mails" }, { name: "robots", content: "noindex" }] }),
  component: FormsPage,
});

type Field = { id: string; label: string; type: "email" | "text" | "tel" | "url"; required: boolean };
type Draft = {
  id?: string;
  name: string;
  fields: Field[];
  successMessage: string;
  redirectUrl: string;
};

const emptyDraft: Draft = {
  name: "",
  fields: [
    { id: "email", label: "Email", type: "email", required: true },
    { id: "name", label: "Name", type: "text", required: false },
  ],
  successMessage: "Thanks, you're subscribed.",
  redirectUrl: "",
};

function FormsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listForms);
  const save = useServerFn(saveForm);
  const remove = useServerFn(deleteForm);
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data: forms = [], isLoading } = useQuery({ queryKey: ["forms"], queryFn: () => list() });
  const saveMutation = useMutation({
    mutationFn: (value: Draft) => save({ data: value }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["forms"] });
      setDraft(null);
      toast.success("Form saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forms"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppPage
      eyebrow="Capture"
      title="Signup forms"
      description="Hosted forms and one-line embed snippets that send subscribers straight into your lists."
      action={!draft ? <Button onClick={() => setDraft({ ...emptyDraft })}>New form</Button> : undefined}
    >
      {draft ? (
        <FormEditor
          draft={draft}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={() => saveMutation.mutate(draft)}
          saving={saveMutation.isPending}
        />
      ) : isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading forms…</p>
      ) : forms.length === 0 ? (
        <div className="border-y border-border py-14 text-center">
          <h2 className="text-lg font-medium">No forms yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create a signup form and embed it on your site, or share the hosted link.</p>
          <Button className="mt-6" onClick={() => setDraft({ ...emptyDraft })}>Create a form</Button>
        </div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {forms.map((f) => {
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const hostedUrl = `${origin}/f/${f.slug}`;
            return (
              <article key={f.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <h3 className="font-medium">{f.name}</h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    <Link to="/f/$slug" params={{ slug: f.slug }} target="_blank" className="hover:underline">{hostedUrl}</Link>
                    <span className="mx-2">·</span>
                    <span>{f.submission_count} submission{f.submission_count === 1 ? "" : "s"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Button variant="ghost" size="sm" onClick={() => {
                    navigator.clipboard.writeText(hostedUrl);
                    toast.success("Hosted URL copied");
                  }}>copy url</Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const snippet = `<iframe src="${hostedUrl}?embed=1" style="width:100%;max-width:480px;border:0;height:420px" loading="lazy"></iframe>`;
                    navigator.clipboard.writeText(snippet);
                    toast.success("Embed code copied");
                  }}>embed</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDraft({
                    id: f.id,
                    name: f.name,
                    fields: (f.fields as Field[]) ?? emptyDraft.fields,
                    successMessage: f.success_message,
                    redirectUrl: f.redirect_url ?? "",
                  })}>edit</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => confirm(`Delete ${f.name}?`) && delMutation.mutate(f.id)}>delete</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppPage>
  );
}

function FormEditor({ draft, onChange, onCancel, onSave, saving }: { draft: Draft; onChange: (d: Draft) => void; onCancel: () => void; onSave: () => void; saving: boolean }) {
  function updateField(i: number, patch: Partial<Field>) {
    const next = draft.fields.map((f, idx) => idx === i ? { ...f, ...patch } : f);
    onChange({ ...draft, fields: next });
  }
  function addField() {
    onChange({ ...draft, fields: [...draft.fields, { id: `field_${draft.fields.length + 1}`, label: "New field", type: "text", required: false }] });
  }
  function removeField(i: number) {
    onChange({ ...draft, fields: draft.fields.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-6">
      <Labeled label="Form name">
        <input value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Website signup" className="w-full border-b border-border bg-transparent py-2 outline-none focus:border-foreground" />
      </Labeled>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Fields</label>
          <Button variant="ghost" size="sm" onClick={addField}>+ field</Button>
        </div>
        <div className="divide-y divide-border border border-border">
          {draft.fields.map((f, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 px-3 py-2 text-sm">
              <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} className="bg-transparent outline-none" />
              <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as Field["type"] })} className="bg-transparent font-mono text-xs">
                <option value="email">email</option><option value="text">text</option><option value="tel">tel</option><option value="url">url</option>
              </select>
              <label className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> req
              </label>
              <button type="button" className="text-destructive font-mono text-[10px] uppercase tracking-widest" onClick={() => removeField(i)} disabled={f.id === "email"}>×</button>
            </div>
          ))}
        </div>
      </div>

      <Labeled label="Success message">
        <input value={draft.successMessage} onChange={(e) => onChange({ ...draft, successMessage: e.target.value })} className="w-full border-b border-border bg-transparent py-2 outline-none focus:border-foreground" />
      </Labeled>

      <Labeled label="Redirect URL (optional)">
        <input value={draft.redirectUrl} onChange={(e) => onChange({ ...draft, redirectUrl: e.target.value })} placeholder="https://your-site.com/thanks" className="w-full border-b border-border bg-transparent py-2 outline-none focus:border-foreground" />
      </Labeled>

      <div className="flex justify-end gap-2 border-t border-border pt-5">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={!draft.name.trim() || saving}>{saving ? "Saving…" : "Save form"}</Button>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
