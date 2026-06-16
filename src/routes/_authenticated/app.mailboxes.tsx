import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { getGoogleAuthUrl, listMailboxes, deleteMailbox } from "@/lib/mailboxes.functions";

type Search = { connected?: string; error?: string };

export const Route = createFileRoute("/_authenticated/app/mailboxes")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    connected: typeof s.connected === "string" ? s.connected : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  head: () => ({ meta: [{ title: "Mailboxes | Carrot Mails" }, { name: "robots", content: "noindex" }] }),
  component: MailboxesPage,
});

function MailboxesPage() {
  const search = useSearch({ from: "/_authenticated/app/mailboxes" });
  const qc = useQueryClient();
  const list = useServerFn(listMailboxes);
  const getUrl = useServerFn(getGoogleAuthUrl);
  const del = useServerFn(deleteMailbox);

  const { data: mailboxes = [], isLoading } = useQuery({
    queryKey: ["mailboxes"],
    queryFn: () => list(),
  });

  useEffect(() => {
    if (search.connected) toast.success(`Connected ${search.connected}`);
    if (search.error) toast.error(`Couldn't connect: ${search.error.replace(/_/g, " ")}`);
  }, [search.connected, search.error]);

  const connect = useMutation({
    mutationFn: async () => getUrl(),
    onSuccess: (r) => {
      window.location.href = r.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mailboxes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Mailboxes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Connect your Gmail account. Carrot Mails never sees your password. Google handles sign-in, and you can revoke access at any time.
      </p>

      <div className="mt-8 space-y-3">
        <button
          onClick={() => connect.mutate()}
          disabled={connect.isPending}
          className="flex w-full items-center justify-between border border-border px-4 py-3 text-left text-sm transition hover:bg-muted disabled:opacity-50"
        >
          <span className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.55-.21-2.27H12v4.3h5.9a5.04 5.04 0 0 1-2.19 3.31v2.75h3.54c2.07-1.9 3.25-4.72 3.25-8.09Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.88 0-5.31-1.94-6.18-4.55H2.18v2.85A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.82 14.09a6.6 6.6 0 0 1 0-4.18V7.06H2.18a11 11 0 0 0 0 9.88l3.64-2.85Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.1 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.64 2.85C6.69 7.32 9.12 5.38 12 5.38Z"/></svg>
            <span>Connect Gmail</span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {connect.isPending ? "redirecting…" : "google oauth"}
          </span>
        </button>
        <button
          disabled
          className="flex w-full items-center justify-between border border-border px-4 py-3 text-left text-sm opacity-50"
        >
          <span>Connect Outlook</span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">soon</span>
        </button>
      </div>

      <div className="mt-12">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Connected</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : mailboxes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No mailboxes yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border border-border">
            {mailboxes.map((m) => {
              const today = new Date().toISOString().slice(0, 10);
              const sentToday = m.daily_sent_date === today ? m.daily_sent_count : 0;
              return (
                <li key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{m.email}</div>
                    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {m.provider} · {m.status} · {sentToday}/{m.daily_cap} today
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Disconnect ${m.email}?`)) remove.mutate(m.id);
                    }}
                    className="font-mono text-[11px] uppercase tracking-widest text-destructive hover:underline"
                  >
                    disconnect
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Scopes requested: gmail.send, gmail.readonly, gmail.modify. We only read to detect replies on threads you started from Carrot Mails.
      </p>
    </div>
  );
}