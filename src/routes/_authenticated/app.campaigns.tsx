import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns | Carrot Mails" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
      <p className="mt-2 text-sm text-muted-foreground">Scheduled sends, throttle, per-recipient status, reply detection. Coming next.</p>
    </div>
  ),
});