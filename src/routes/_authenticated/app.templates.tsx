import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/templates")({
  head: () => ({ meta: [{ title: "Templates — Quill" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
      <p className="mt-2 text-sm text-muted-foreground">Saved drafts you can reuse across campaigns. Coming online next.</p>
    </div>
  ),
});