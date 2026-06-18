import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getPublicForm, submitPublicForm } from "@/lib/forms-public.functions";

export const Route = createFileRoute("/f/$slug")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} | Carrot Mails` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicForm,
});

type Field = { id: string; label: string; type: "email" | "text" | "tel" | "url"; required: boolean };

function PublicForm() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getPublicForm);
  const submit = useServerFn(submitPublicForm);
  const embed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "1";

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-form", slug],
    queryFn: () => get({ data: { slug } }),
    retry: false,
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await submit({ data: { slug, values } });
      if (res.redirect) {
        window.location.assign(res.redirect);
        return;
      }
      setDone(true);
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-background p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-8">
        <p className="text-sm text-muted-foreground">Form not found.</p>
      </div>
    );
  }
  const fields = (data.fields as Field[]) ?? [];

  const shell = (
    <div className={embed ? "p-5" : "mx-auto max-w-md p-8"}>
      <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
      {done ? (
        <p className="mt-6 border border-border bg-card p-4 text-sm">{data.success_message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {fields.map((f) => (
            <label key={f.id} className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{f.label}{f.required ? " *" : ""}</span>
              <input
                type={f.type}
                required={f.required}
                value={values[f.id] ?? ""}
                onChange={(e) => setValues({ ...values, [f.id]: e.target.value })}
                className="mt-1 w-full border-b border-border bg-transparent py-2 outline-none focus:border-foreground"
              />
            </label>
          ))}
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button type="submit" disabled={submitting} className="bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {submitting ? "Submitting…" : "Subscribe"}
          </button>
        </form>
      )}
      {!embed && (
        <p className="mt-10 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Powered by Carrot Mails
        </p>
      )}
    </div>
  );

  if (embed) return <div className="min-h-screen bg-background text-foreground">{shell}</div>;
  // Ensure unused navigate doesn't lint
  void navigate;
  return <div className="min-h-screen bg-background text-foreground">{shell}</div>;
}
