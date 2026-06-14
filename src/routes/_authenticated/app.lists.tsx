import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/lists")({
  head: () => ({ meta: [{ title: "Lists — Quill" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Contact lists</h1>
      <p className="mt-2 text-sm text-muted-foreground">Upload CSVs, auto-dedupe, validate emails, filter suppressions. Coming next.</p>
    </div>
  ),
});