import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppPage } from "@/components/AppPage";
import { Button } from "@/components/ui/button";
import { createBillingCheckout, createCustomerPortal, reconcileMyPurchases } from "@/lib/billing.functions";
import { useBilling, planLabel } from "@/hooks/useEntitlement";

type Search = { checkout?: string };

export const Route = createFileRoute("/_authenticated/app/billing")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    checkout: typeof s.checkout === "string" ? s.checkout : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Billing | Carrot Mails" },
      { name: "description", content: "Manage your Carrot Mails Growth or Lifetime plan and see remaining send quota." },
      { property: "og:title", content: "Billing | Carrot Mails" },
      { property: "og:description", content: "Manage your Growth or Lifetime plan and see remaining send quota." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const search = useSearch({ from: "/_authenticated/app/billing" });
  const startCheckout = useServerFn(createBillingCheckout);
  const openPortal = useServerFn(createCustomerPortal);
  const reconcile = useServerFn(reconcileMyPurchases);
  const [pending, setPending] = useState<"pro" | "lifetime" | "portal" | "reconcile" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: status, isLoading, refetch } = useBilling();

  // After returning from checkout, aggressively reconcile in case the webhook is slow.
  useEffect(() => {
    if (search.checkout !== "success") return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 5; i++) {
        if (cancelled) return;
        try {
          const r = await reconcile();
          if (r.hasPaidAccess) {
            toast.success("Payment confirmed. Sending unlocked.");
            refetch();
            return;
          }
        } catch {
          // ignore and retry
        }
        await new Promise((res) => setTimeout(res, 2500));
      }
      refetch();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.checkout]);

  async function checkout(plan: "pro" | "lifetime") {
    setPending(plan);
    setError(null);
    try {
      const { url } = await startCheckout({ data: { plan } });
      window.location.assign(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start checkout");
      setPending(null);
    }
  }

  async function portal() {
    setPending("portal");
    setError(null);
    try {
      const { url } = await openPortal();
      window.location.assign(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open billing portal");
      setPending(null);
    }
  }

  async function manualReconcile() {
    setPending("reconcile");
    setError(null);
    try {
      const r = await reconcile();
      if (r.hasPaidAccess) toast.success(`Access restored — ${planLabel(r.tier)} unlocked.`);
      else toast.message("No paid subscription found on file for your account email yet.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Restore failed");
    } finally {
      setPending(null);
    }
  }

  const tier = status?.tier ?? "none";
  const remaining = status?.offer.remaining ?? 0;
  const label = planLabel(tier);

  return (
    <AppPage
      eyebrow="Account"
      title="Plans and billing"
      description="Growth is a monthly plan with 5,000 sends. Lifetime is a one-time payment with unlimited sending, capped to the first 100 buyers."
      action={
        tier !== "none" ? (
          <Button variant="outline" onClick={portal} disabled={pending !== null}>{pending === "portal" ? "Opening…" : "Manage billing"}</Button>
        ) : (
          <Button variant="outline" onClick={manualReconcile} disabled={pending !== null}>
            {pending === "reconcile" ? "Checking…" : "Restore purchase"}
          </Button>
        )
      }
    >
      {isLoading ? (
        <p className="font-mono text-xs text-muted-foreground">Loading billing status…</p>
      ) : (
        <>
          {search.checkout === "success" && !status?.hasPaidAccess && (
            <div className="mb-6 border border-primary/40 bg-primary/5 p-4 text-sm">
              We're confirming your payment with the processor. This usually takes a few seconds. If it doesn't unlock in a minute, click <button onClick={manualReconcile} className="underline">Restore purchase</button>.
            </div>
          )}
          {status?.hasPaidAccess && (
            <div className="mb-6 border border-primary/40 bg-primary/5 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Active plan</div>
              <div className="mt-1 text-lg font-medium">{label}</div>
              {status.unlimited ? (
                <div className="mt-2 text-sm text-muted-foreground">Unlimited sending. Forever.</div>
              ) : (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between font-mono text-xs">
                    <span className="text-muted-foreground">Sends this period</span>
                    <span>{status.sentThisPeriod.toLocaleString()} / {status.quota.toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${Math.min(100, Math.round((status.sentThisPeriod / Math.max(1, status.quota)) * 100))}%` }}
                    />
                  </div>
                  {status.periodEnd && (
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Resets {new Date(status.periodEnd).toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mb-8 flex items-center justify-between border-y border-border py-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current access</p>
              <p className="mt-1 text-lg font-medium">{tier === "none" ? "No paid plan" : label}</p>
            </div>
            {status?.subscription?.cancel_at_period_end && <span className="font-mono text-xs text-muted-foreground">Ends after current period</span>}
          </div>

          <div className="grid gap-px bg-border lg:grid-cols-2">
            <section className="flex min-h-96 flex-col bg-background p-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Recurring</p>
              <h2 className="mt-5 text-2xl font-semibold">Growth</h2>
              <div className="mt-3 flex items-end gap-2"><span className="text-4xl font-semibold">$3.50</span><span className="pb-1 text-sm text-muted-foreground">/ month</span></div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-accent">Introductory price · increases over time</p>
              <ul className="mt-8 space-y-3 text-sm">
                <li><span className="font-medium">5,000 emails / month</span> from your own inbox</li>
                <li>Rich composer: fonts, colors, blocks, buttons, cards</li>
                <li>Unlimited templates, lists and signup forms</li>
                <li>Reply detection, suppression and bounce handling</li>
                <li>Cancel anytime</li>
              </ul>
              <Button className="mt-auto" onClick={() => checkout("pro")} disabled={pending !== null || tier !== "none" || !status?.checkoutConfigured}>
                {tier === "growth" ? "Current plan" : pending === "pro" ? "Opening checkout…" : "Choose Growth"}
              </Button>
            </section>

            <section className="relative flex min-h-96 flex-col bg-card p-7">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Limited launch offer</p>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{remaining} left</span>
              </div>
              <h2 className="mt-5 text-2xl font-semibold">Lifetime</h2>
              <div className="mt-3 flex items-end gap-2"><span className="text-4xl font-semibold">$49.50</span><span className="pb-1 text-sm text-muted-foreground">once</span></div>
              <ul className="mt-8 space-y-3 text-sm">
                <li><span className="font-medium">Unlimited emails</span>, forever</li>
                <li>Everything in Growth, plus every future feature</li>
                <li>No recurring software fee</li>
                <li>Available to the first 100 buyers only</li>
              </ul>
              <Button className="mt-auto" onClick={() => checkout("lifetime")} disabled={pending !== null || tier !== "none" || !status?.offer.available || !status?.checkoutConfigured}>
                {tier === "lifetime" ? "Owned forever" : !status?.offer.available ? "Sold out" : pending === "lifetime" ? "Opening checkout…" : "Get lifetime access"}
              </Button>
            </section>
          </div>

          {!status?.checkoutConfigured && <p className="mt-5 border border-border bg-muted p-4 text-sm text-muted-foreground">Checkout will activate after the Dodo payment credentials and product IDs are connected.</p>}
          {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            Already paid but don't see access? <Link to="/app/billing" search={{}} onClick={manualReconcile} className="underline">Restore purchase</Link> and we'll re-sync with the payment processor.
          </p>
        </>
      )}
    </AppPage>
  );
}
