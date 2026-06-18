import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppPage } from "@/components/AppPage";
import { RichEditor } from "@/components/RichEditor";
import { Button } from "@/components/ui/button";
import { deleteTemplate, listTemplates, saveTemplate } from "@/lib/templates.functions";

export const Route = createFileRoute("/_authenticated/app/templates")({
  head: () => ({ meta: [{ title: "Templates | Carrot Mails" }, { name: "robots", content: "noindex" }] }),
  component: TemplatesPage,
});

type Draft = { id?: string; name: string; subject: string; bodyHtml: string };
const emptyDraft: Draft = { name: "", subject: "", bodyHtml: "<p></p>" };
const starterTemplates: Draft[] = [
  {
    name: "Warm introduction",
    subject: "A quick introduction, {{name}}",
    bodyHtml: "<p>Hi {{name}},</p><p>I came across {{company}} and wanted to introduce myself. I think there may be a useful way for us to work together.</p><p>Would you be open to a quick conversation next week?</p><p>Best,<br>Your name</p>",
  },
  {
    name: "Friendly follow-up",
    subject: "Following up, {{name}}",
    bodyHtml: "<p>Hi {{name}},</p><p>Just following up on my last note in case it got buried.</p><p>Would a brief conversation be useful, or is there someone else at {{company}} I should speak with?</p><p>Best,<br>Your name</p>",
  },
  {
    name: "Meeting recap",
    subject: "Great speaking today: next steps",
    bodyHtml: "<p>Hi {{name}},</p><p>Thanks for your time today. It was helpful to learn more about {{company}} and what your team is working toward.</p><p>As discussed, the next step is:</p><ul><li>Add your agreed next step here</li></ul><p>I’ll follow up by the date we agreed.</p><p>Best,<br>Your name</p>",
  },
  {
    name: "Re-engagement",
    subject: "Still relevant for {{company}}?",
    bodyHtml: "<p>Hi {{name}},</p><p>It’s been a little while since we last connected. Is this still something your team at {{company}} is considering?</p><p>If priorities have changed, no problem at all. Just let me know and I’ll close the loop.</p><p>Best,<br>Your name</p>",
  },
];

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
      ) : (
        <div className="space-y-12">
          <section>
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-border pb-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Ready to customize</p>
                <h2 className="mt-1 text-lg font-medium">Starter templates</h2>
              </div>
              <span className="text-xs text-muted-foreground">Variables adapt to your list</span>
            </div>
            <div className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-2">
              {starterTemplates.map((template) => (
                <article key={template.name} className="flex min-h-40 flex-col bg-background p-5">
                  <h3 className="font-medium">{template.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{template.subject}</p>
                  <Button variant="outline" size="sm" className="mt-auto self-start" onClick={() => setDraft({ ...template })}>Use template</Button>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 border-b border-border pb-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your library</p>
              <h2 className="mt-1 text-lg font-medium">Saved templates</h2>
            </div>
            {isLoading ? (
              <p className="py-8 text-sm text-muted-foreground">Loading templates…</p>
            ) : templates.length === 0 ? (
              <EmptyState title="No saved templates yet" body="Choose a starter above or create your own reusable message." action="Create a template" onClick={() => setDraft({ ...emptyDraft })} />
            ) : (
              <div className="divide-y divide-border border-b border-border">
                {templates.map((template) => (
                  <article key={template.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
                    <Button variant="ghost" className="h-auto min-w-0 justify-start px-0 py-0 text-left hover:bg-transparent" onClick={() => setDraft({ id: template.id, name: template.name, subject: template.subject, bodyHtml: template.body_html })}>
                      <span className="min-w-0">
                        <h3 className="font-medium">{template.name}</h3>
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
          </section>
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