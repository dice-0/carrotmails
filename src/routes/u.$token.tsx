import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { unsubscribeByToken } from "@/lib/campaigns.functions";

export const Route = createFileRoute("/u/$token")({
  head: () => ({ meta: [{ title: "Unsubscribe | Carrot Mails" }, { name: "robots", content: "noindex" }] }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = Route.useParams();
  const unsub = useServerFn(unsubscribeByToken);
  const [state, setState] = useState<{ ok: boolean; email: string | null; done: boolean; error?: string }>({
    ok: false, email: null, done: false,
  });

  useEffect(() => {
    let cancelled = false;
    unsub({ data: { token } })
      .then((r) => { if (!cancelled) setState({ ok: r.ok, email: r.email, done: true }); })
      .catch((e: Error) => { if (!cancelled) setState({ ok: false, email: null, done: true, error: e.message }); });
    return () => { cancelled = true; };
  }, [token, unsub]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Unsubscribe</h1>
        {!state.done ? (
          <p className="mt-4 text-sm text-muted-foreground">Processing your request…</p>
        ) : state.ok ? (
          <>
            <p className="mt-4 text-sm">
              <span className="font-medium">{state.email}</span> has been removed.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">You won't receive further messages from this sender.</p>
          </>
        ) : (
          <p className="mt-4 text-sm text-destructive">{state.error ?? "We couldn't find that unsubscribe link."}</p>
        )}
      </div>
    </div>
  );
}
