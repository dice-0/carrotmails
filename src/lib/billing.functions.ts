import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutSchema = z.object({ plan: z.enum(["pro", "lifetime"]) });

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];
// Growth (formerly "Pro") gives 5000 sends per billing period.
export const GROWTH_QUOTA = 5000;

async function computeSendsThisPeriod(
  supabase: any,
  userId: string,
  periodStart: string | null,
): Promise<number> {
  const since = periodStart ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("email_send_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("sent_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function loadBillingSnapshot(supabase: any, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [entitlementsResult, subscriptionsResult, purchasesResult, offerResult] = await Promise.all([
    supabase
      .from("billing_entitlements")
      .select("entitlement, active, expires_at, updated_at")
      .eq("user_id", userId),
    supabase
      .from("billing_subscriptions")
      .select("status, current_period_end, cancel_at_period_end, updated_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("billing_purchases")
      .select("status, completed_at")
      .eq("user_id", userId)
      .eq("product", "lifetime")
      .order("created_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("billing_offers")
      .select("price_cents, currency, max_redemptions, redemption_count, active")
      .eq("code", "lifetime-launch")
      .single(),
  ]);

  const queryError = entitlementsResult.error ?? subscriptionsResult.error ?? purchasesResult.error ?? offerResult.error;
  if (queryError) throw new Error(queryError.message);

  const now = Date.now();
  const entitlements = entitlementsResult.data ?? [];
  const hasPaidAccess = entitlements.some(
    (item: any) => item.active && (!item.expires_at || new Date(item.expires_at).getTime() > now),
  );
  const isLifetime = entitlements.some((i: any) => i.active && i.entitlement === "lifetime");
  const subscription = subscriptionsResult.data?.[0] ?? null;
  const purchase = purchasesResult.data?.[0] ?? null;
  const offer = offerResult.data;
  if (!offer) throw new Error("Lifetime offer is not configured");

  // Growth quota window: from start of current subscription period (approx period_end - 30d).
  let periodStart: string | null = null;
  let periodEnd: string | null = subscription?.current_period_end ?? null;
  if (subscription?.current_period_end) {
    periodStart = new Date(new Date(subscription.current_period_end).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const tier: "lifetime" | "growth" | "none" = isLifetime
    ? "lifetime"
    : subscription && ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status)
      ? "growth"
      : "none";

  let sentThisPeriod = 0;
  let quota = 0;
  let quotaRemaining = 0;
  let unlimited = false;
  if (tier === "growth") {
    sentThisPeriod = await computeSendsThisPeriod(supabase, userId, periodStart);
    quota = GROWTH_QUOTA;
    quotaRemaining = Math.max(0, quota - sentThisPeriod);
  } else if (tier === "lifetime") {
    unlimited = true;
  }

  return {
    hasPaidAccess,
    tier,
    subscription,
    purchase,
    sentThisPeriod,
    quota,
    quotaRemaining,
    unlimited,
    periodEnd,
    offer: {
      ...offer,
      remaining: Math.max(0, offer.max_redemptions - offer.redemption_count),
      available: offer.active && offer.redemption_count < offer.max_redemptions,
    },
    checkoutConfigured: Boolean(
      process.env.DODO_PAYMENTS_API_KEY &&
        process.env.DODO_PRO_PRODUCT_ID &&
        process.env.DODO_LIFETIME_PRODUCT_ID,
    ),
  };
}

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadBillingSnapshot(context.supabase, context.userId));

export const createBillingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    const productId = data.plan === "pro" ? process.env.DODO_PRO_PRODUCT_ID : process.env.DODO_LIFETIME_PRODUCT_ID;
    if (!apiKey || !productId) throw new Error("Payments are not configured yet");

    if (data.plan === "lifetime") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: offer, error } = await supabaseAdmin
        .from("billing_offers")
        .select("active, max_redemptions, redemption_count")
        .eq("code", "lifetime-launch")
        .single();
      if (error) throw new Error(error.message);
      if (!offer.active || offer.redemption_count >= offer.max_redemptions) {
        throw new Error("The Lifetime Launch offer is sold out");
      }
    }

    const request = getRequest();
    const origin = new URL(request.url).origin;
    const email = typeof context.claims.email === "string" ? context.claims.email : undefined;
    const response = await fetch("https://live.dodopayments.com/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: email ? { email } : undefined,
        metadata: { user_id: context.userId, plan: data.plan },
        return_url: `${origin}/app/billing?checkout=success`,
      }),
    });
    const payload = (await response.json()) as { checkout_url?: string; message?: string };
    if (!response.ok || !payload.checkout_url) {
      throw new Error(payload.message ?? "Unable to start checkout");
    }
    return { url: payload.checkout_url };
  });

export const createCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) throw new Error("Payments are not configured yet");
    const { data: customer, error } = await context.supabase
      .from("billing_customers")
      .select("provider_customer_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("No billing account found");

    const response = await fetch(`https://live.dodopayments.com/customers/${encodeURIComponent(customer.provider_customer_id)}/customer-portal/session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    });
    const payload = (await response.json()) as { link?: string; message?: string };
    if (!response.ok || !payload.link) throw new Error(payload.message ?? "Unable to open billing portal");
    return { url: payload.link };
  });

/**
 * Backfill / recover a paid plan if a webhook was missed or arrived slowly.
 * Queries Dodo for this user's subscriptions and payments and upserts entitlements.
 * Also matches by the account email as a fallback when no billing_customers row exists yet.
 */
export const reconcileMyPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) throw new Error("Payments are not configured yet");
    const proProduct = process.env.DODO_PRO_PRODUCT_ID;
    const lifetimeProduct = process.env.DODO_LIFETIME_PRODUCT_ID;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = typeof context.claims.email === "string" ? context.claims.email : undefined;

    // Fetch existing customer id or discover via email.
    let customerId: string | null = null;
    {
      const { data: existing } = await supabaseAdmin
        .from("billing_customers")
        .select("provider_customer_id")
        .eq("user_id", userId)
        .maybeSingle();
      customerId = existing?.provider_customer_id ?? null;
    }
    if (!customerId && email) {
      // Dodo customers listing supports ?email=
      const res = await fetch(`https://live.dodopayments.com/customers?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { items?: Array<{ customer_id: string; email?: string }>; data?: Array<{ customer_id: string; email?: string }> };
        const items = body.items ?? body.data ?? [];
        const match = items.find((c) => (c.email ?? "").toLowerCase() === email.toLowerCase()) ?? items[0];
        if (match?.customer_id) {
          customerId = match.customer_id;
          await supabaseAdmin.from("billing_customers").upsert(
            { user_id: userId, provider_customer_id: customerId, email },
            { onConflict: "user_id" },
          );
        }
      }
    }

    let changed = false;

    if (customerId) {
      // Pull active subscriptions.
      const subsRes = await fetch(
        `https://live.dodopayments.com/subscriptions?customer_id=${encodeURIComponent(customerId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (subsRes.ok) {
        const subsBody = (await subsRes.json()) as {
          items?: Array<any>;
          data?: Array<any>;
        };
        const items = subsBody.items ?? subsBody.data ?? [];
        // Prefer the most recently created active/trialing subscription so that
        // an older failed/cancelled sub can't overwrite the entitlement row.
        const sorted = [...items].sort((a, b) => {
          const ax = ACTIVE_SUBSCRIPTION_STATUSES.includes(a.status ?? "") ? 1 : 0;
          const bx = ACTIVE_SUBSCRIPTION_STATUSES.includes(b.status ?? "") ? 1 : 0;
          if (ax !== bx) return bx - ax;
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        });
        let entitlementWritten = false;
        for (const s of sorted) {
          const status: string = s.status ?? "active";
          const productId: string | undefined = s.product_id ?? s.product?.product_id;
          const subId: string | undefined = s.subscription_id ?? s.id;
          if (!subId || !productId) continue;
          if (proProduct && productId === proProduct) {
            await supabaseAdmin.from("billing_subscriptions").upsert(
              {
                user_id: userId,
                provider_subscription_id: subId,
                provider_product_id: productId,
                plan: "pro",
                status,
                current_period_end: s.next_billing_date ?? null,
                cancel_at_period_end: Boolean(s.cancel_at_next_billing_date),
              },
              { onConflict: "provider_subscription_id" },
            );
            const active = ACTIVE_SUBSCRIPTION_STATUSES.includes(status);
            if (!entitlementWritten && active) {
              await supabaseAdmin.from("billing_entitlements").upsert(
                {
                  user_id: userId,
                  entitlement: "pro",
                  source_id: subId,
                  active: true,
                  expires_at: s.next_billing_date ?? null,
                },
                { onConflict: "user_id,entitlement" },
              );
              entitlementWritten = true;
            }
            changed = true;
          }
        }
      }

      // Pull payments for lifetime.
      const paysRes = await fetch(
        `https://live.dodopayments.com/payments?customer_id=${encodeURIComponent(customerId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (paysRes.ok) {
        const body = (await paysRes.json()) as { items?: Array<any>; data?: Array<any> };
        const items = body.items ?? body.data ?? [];
        for (const p of items) {
          const status: string = p.status ?? "";
          const paymentId: string | undefined = p.payment_id ?? p.id;
          const productId: string | undefined = p.product_id ?? p.product_cart?.[0]?.product_id;
          if (!paymentId || !productId) continue;
          if (status !== "succeeded" && status !== "success" && status !== "paid") continue;
          if (lifetimeProduct && productId === lifetimeProduct) {
            await supabaseAdmin.from("billing_purchases").upsert(
              {
                user_id: userId,
                provider_payment_id: paymentId,
                provider_product_id: productId,
                product: "lifetime",
                status: "succeeded",
                amount_cents: p.amount ?? 0,
                currency: (p.currency ?? "USD").toUpperCase(),
                completed_at: p.completed_at ?? new Date().toISOString(),
              },
              { onConflict: "provider_payment_id" },
            );
            await supabaseAdmin.from("billing_entitlements").upsert(
              {
                user_id: userId,
                entitlement: "lifetime",
                source_id: paymentId,
                active: true,
                expires_at: null,
              },
              { onConflict: "user_id,entitlement" },
            );
            changed = true;
          }
        }
      }
    }

    const snapshot = await loadBillingSnapshot(context.supabase, userId);
    return { changed, tier: snapshot.tier, hasPaidAccess: snapshot.hasPaidAccess };
  });
