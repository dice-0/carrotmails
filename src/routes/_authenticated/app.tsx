import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

const NAV: { to: "/app" | "/app/campaigns" | "/app/templates" | "/app/lists" | "/app/mailboxes"; label: string; end?: boolean }[] = [
  { to: "/app", label: "Compose", end: true },
  { to: "/app/campaigns", label: "Campaigns" },
  { to: "/app/templates", label: "Templates" },
  { to: "/app/lists", label: "Lists" },
  { to: "/app/mailboxes", label: "Mailboxes" },
];

function AppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border p-6 md:flex">
          <Link to="/app" className="mb-10 text-lg font-semibold tracking-tight">
            Quill
          </Link>
          <nav className="flex flex-col gap-1 font-mono text-xs uppercase tracking-widest">
            {NAV.map((n) => {
              const active = n.end ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-2 py-1.5 transition ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-2 pt-6 font-mono text-[11px] text-muted-foreground">
            <div className="truncate">{email}</div>
            <button onClick={signOut} className="hover:text-foreground">sign out →</button>
          </div>
        </aside>
        <main className="min-h-screen flex-1">
          <div className="border-b border-border p-4 font-mono text-xs uppercase tracking-widest md:hidden">
            <Link to="/app" className="text-foreground">Quill</Link>
            <span className="text-muted-foreground"> · {email}</span>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}