import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppPage } from "@/components/AppPage";
import { Button } from "@/components/ui/button";
import { createBillingCheckout, createCustomerPortal, getBillingStatus } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/app/billing")({
  head: () => ({
    meta: [
      { title: "Billing | Carrot Mails" },
      { name: "description", content: "Manage your Carrot Mails plan and billing." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const getStatus = useServerFn(getBillingStatus);
  const startCheckout = useServerFn(createBillingCheckout);
  const openPortal = useServerFn(createCustomerPortal);
  const [pending, setPending] = useState<"pro" | "lifetime" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: status, isLoading } = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => getStatus(),
  });

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

  const tier = status?.tier ?? "none";
  const remaining = status?.offer.remaining ?? 0;

  return (
    <AppPage
      eyebrow="Account"
      title="Plans and billing"
      description="Choose recurring Pro access or lock in feature access with the limited Lifetime Launch offer. Sending usage is metered separately on both plans."
      action={tier !== "none" ? <Button variant="outline" onClick={portal} disabled={pending !== null}>{pending === "portal" ? "Opening…" : "Manage billing"}</Button> : undefined}
    >
      {isLoading ? (
        <p className="font-mono text-xs text-muted-foreground">Loading billing status…</p>
      ) : (
        <>
          <div className="mb-8 flex items-center justify-between border-y border-border py-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current access</p>
              <p className="mt-1 text-lg font-medium capitalize">{tier === "none" ? "No paid plan" : tier}</p>
            </div>
            {status?.subscription?.cancel_at_period_end && <span className="font-mono text-xs text-muted-foreground">Ends after current period</span>}
          </div>

          <div className="grid gap-px bg-border lg:grid-cols-2">
            <section className="flex min-h-96 flex-col bg-background p-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Recurring</p>
              <h2 className="mt-5 text-2xl font-semibold">Pro</h2>
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
                {tier === "pro" ? "Current plan" : pending === "pro" ? "Opening checkout…" : "Choose Pro"}
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
                <li>Everything in Pro, plus every future Pro feature</li>
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
          <p className="mt-6 text-xs leading-5 text-muted-foreground">Prices are in USD. Taxes may be added at checkout. Lifetime access covers Carrot Mails product features, not third-party email delivery or usage costs.</p>
        </>
      )}
    </AppPage>
  );
}