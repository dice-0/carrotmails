import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppPage } from "@/components/AppPage";
import { RichEditor } from "@/components/RichEditor";
import { Button } from "@/components/ui/button";
import { deleteTemplate, listTemplates, saveTemplate } from "@/lib/templates.functions";

export const Route = createFileRoute("/_authenticated/app/templates")({
  head: () => ({ meta: [{ title: "Templates — Quill" }, { name: "robots", content: "noindex" }] }),
  component: TemplatesPage,
});

type Draft = { id?: string; name: string; subject: string; bodyHtml: string };
const emptyDraft: Draft = { name: "", subject: "", bodyHtml: "<p></p>" };

function TemplatesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listTemplates);
  const save = useServerFn(saveTemplate);
  const remove = useServerFn(deleteTemplate);
  const [draft, setDraft] = useState<Draft | null>(null);
  const { data: templates = [], isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => list() });
  const saveMutation = useMutation({
    mutationFn: (value: Draft) => save({ data: value }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["templates"] });
      setDraft(null);
      toast.success("Template saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppPage
      eyebrow="Library"
      title="Templates"
      description="Keep proven messages in one place, with personalization variables ready for every send."
      action={<Button onClick={() => setDraft({ ...emptyDraft })}>New template</Button>}
    >
      {draft ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="space-y-5">
            <LabeledInput label="Template name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} placeholder="Partner introduction" />
            <LabeledInput label="Subject" value={draft.subject} onChange={(subject) => setDraft({ ...draft, subject })} placeholder="A quick idea for {{company}}" />
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-4">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Message</label>
                <span className="text-xs text-muted-foreground">Use {"{{name}}"} and any list column</span>
              </div>
              <RichEditor value={draft.bodyHtml} onChange={(bodyHtml) => setDraft({ ...draft, bodyHtml })} />
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-5">
              <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button disabled={!draft.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>
                {saveMutation.isPending ? "Saving…" : "Save template"}
              </Button>
            </div>
          </section>
          <aside className="border-l border-border pl-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Template hygiene</p>
            <ul className="mt-4 space-y-3 text-sm leading-5 text-muted-foreground">
              <li>Keep one goal per message.</li>
              <li>Use short, specific subjects.</li>
              <li>Preview variables against a real list before sending.</li>
            </ul>
          </aside>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : templates.length === 0 ? (
        <EmptyState title="No templates yet" body="Save your first reusable message instead of rebuilding each campaign from scratch." action="Create a template" onClick={() => setDraft({ ...emptyDraft })} />
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {templates.map((template) => (
            <article key={template.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <Button variant="ghost" className="h-auto min-w-0 justify-start px-0 py-0 text-left hover:bg-transparent" onClick={() => setDraft({ id: template.id, name: template.name, subject: template.subject, bodyHtml: template.body_html })}>
                <span className="min-w-0">
                <h2 className="font-medium">{template.name}</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">{template.subject || "No subject"}</p>
                </span>
              </Button>
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>{new Date(template.updated_at).toLocaleDateString()}</span>
                <Button variant="ghost" size="sm" onClick={() => setDraft({ id: template.id, name: template.name, subject: template.subject, bodyHtml: template.body_html })}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => confirm(`Delete ${template.name}?`) && deleteMutation.mutate(template.id)}>Delete</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppPage>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full border-b border-border bg-transparent py-2 outline-none focus:border-foreground" /></label>;
}

function EmptyState({ title, body, action, onClick }: { title: string; body: string; action: string; onClick: () => void }) {
  return <div className="border-y border-border py-14 text-center"><h2 className="text-lg font-medium">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p><Button className="mt-6" onClick={onClick}>{action}</Button></div>;
}