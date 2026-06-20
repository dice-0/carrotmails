import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CarrotLogo } from "@/components/CarrotLogo";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

const NAV: { to: "/app" | "/app/campaigns" | "/app/templates" | "/app/lists" | "/app/forms" | "/app/mailboxes" | "/app/billing"; label: string; end?: boolean }[] = [
  { to: "/app", label: "Compose", end: true },
  { to: "/app/campaigns", label: "Campaigns" },
  { to: "/app/templates", label: "Templates" },
  { to: "/app/lists", label: "Lists" },
  { to: "/app/forms", label: "Forms" },
  { to: "/app/mailboxes", label: "Mailboxes" },
  { to: "/app/billing", label: "Billing" },
];

const SOON: { label: string; note: string }[] = [
  { label: "Automation", note: "Pro · Soon" },
];

function AppShell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const stored = window.localStorage.getItem("quill-theme");
    const enabled = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", enabled);
    setDark(enabled);
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("quill-theme", next ? "dark" : "light");
    setDark(next);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-[90rem]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border px-6 py-7 md:flex">
          <div className="mb-10 flex items-center justify-between">
            <Link to="/app" aria-label="Carrot Mails home"><CarrotLogo size={38} /></Link>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={dark ? "Use light mode" : "Use dark mode"} title={dark ? "Light mode" : "Dark mode"}>{dark ? "☀" : "◐"}</Button>
          </div>
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
            {SOON.map((s) => (
              <div
                key={s.label}
                aria-disabled="true"
                title="Coming soon for Pro subscribers"
                className="flex cursor-not-allowed items-center justify-between px-2 py-1.5 text-muted-foreground/60"
              >
                <span>{s.label}</span>
                <span className="ml-2 text-[9px] tracking-widest text-muted-foreground/70">{s.note}</span>
              </div>
            ))}
          </nav>
          <div className="mt-auto border-t border-border pt-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div className="truncate">{email}</div>
            <Button variant="ghost" size="sm" onClick={signOut} className="mt-2 -ml-3 h-7 font-mono text-[10px] uppercase tracking-widest">Sign out →</Button>
          </div>
        </aside>
        <main className="min-h-screen flex-1">
          <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center justify-between"><Link to="/app" aria-label="Carrot Mails home"><CarrotLogo size={30} /></Link><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={dark ? "Use light mode" : "Use dark mode"}>{dark ? "☀" : "◐"}</Button></div>
            <nav className="mt-3 flex gap-4 overflow-x-auto pb-1 font-mono text-[10px] uppercase tracking-widest">
              {NAV.map((n) => { const active = n.end ? pathname === n.to : pathname.startsWith(n.to); return <Link key={n.to} to={n.to} className={active ? "text-foreground" : "text-muted-foreground"}>{n.label}</Link>; })}
            </nav>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}