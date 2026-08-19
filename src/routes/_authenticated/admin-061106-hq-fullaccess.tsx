import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { claimHqAccess, getAdminAccess } from "@/lib/admin.functions";
import { HQ_ACCESS_KEY } from "@/lib/admin-access";
import { CarrotLogo } from "@/components/CarrotLogo";


export const Route = createFileRoute("/_authenticated/admin-061106-hq-fullaccess")({
  head: () => ({
    meta: [
      { title: "HQ Full Access | Carrot Mails" },
      { name: "description", content: "Internal Carrot Mails HQ console." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminHq,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function AdminHq() {
  const fetchAccess = useServerFn(getAdminAccess);
  const claim = useServerFn(claimHqAccess);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-access"],
    queryFn: async () => {
      // Anyone who reaches this hidden link is granted HQ full access.
      await claim({ data: { key: HQ_ACCESS_KEY } });
      return fetchAccess();
    },
  });


  if (isLoading) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Checking access…</p>
      </main>
    );
  }

  if (!data?.isAdmin) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page doesn&apos;t exist for your account.
          </p>
          <Link to="/app" className="mt-6 inline-block font-mono text-xs uppercase tracking-widest text-primary">
            ← Back to app
          </Link>
        </div>
      </main>
    );
  }

  const mailbox = data.mailbox as { email: string; display_name: string | null; status: string } | null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <header className="mb-10 border-b border-border pb-6">
          <CarrotLogo size={44} />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">HQ Full Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal console. Unlimited sending with the compliance layer disabled for this account.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Account" value={data.email ?? "unknown"} />
          <Stat label="Plan" value="HQ · unlimited" />
          <Stat label="Mailbox" value={mailbox ? `${mailbox.email} · ${mailbox.status}` : "not connected"} />
          <Stat label="Sent (last 30 days)" value={data.sentThisPeriod.toLocaleString()} />
        </div>

        <section className="mt-10 border border-primary/40 bg-primary/5 p-5">
          <h2 className="text-sm font-semibold">What is unlocked</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li>· Unlimited sends, no Premium or Lifetime plan required</li>
            <li>· No consent attestation required before sending</li>
            <li>· No unsubscribe footer and no List-Unsubscribe headers added</li>
            <li>· Quota meters and billing gates bypassed</li>
          </ul>
        </section>

        {!mailbox && (
          <p className="mt-6 text-sm text-destructive">
            Connect a Gmail mailbox before sending.{" "}
            <Link to="/app/mailboxes" className="underline">
              Connect mailbox
            </Link>
          </p>
        )}

        <div className="mt-10 flex gap-4 font-mono text-xs uppercase tracking-widest">
          <Link to="/app" className="text-primary">
            Open composer →
          </Link>
          <Link to="/app/mailboxes" className="text-muted-foreground hover:text-foreground">
            Mailboxes
          </Link>
          <Link to="/app/campaigns" className="text-muted-foreground hover:text-foreground">
            Campaigns
          </Link>
        </div>
      </div>
    </main>
  );
}
