import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutSchema = z.object({ plan: z.enum(["pro", "lifetime"]) });

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];

export const getBillingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [entitlementsResult, subscriptionsResult, purchasesResult, offerResult] = await Promise.all([
      context.supabase
        .from("billing_entitlements")
        .select("entitlement, active, expires_at")
        .eq("user_id", context.userId),
      context.supabase
        .from("billing_subscriptions")
        .select("status, current_period_end, cancel_at_period_end")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1),
      context.supabase
        .from("billing_purchases")
        .select("status, completed_at")
        .eq("user_id", context.userId)
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
      (item) => item.active && (!item.expires_at || new Date(item.expires_at).getTime() > now),
    );
    const subscription = subscriptionsResult.data?.[0] ?? null;
    const purchase = purchasesResult.data?.[0] ?? null;
    const offer = offerResult.data;
    if (!offer) throw new Error("Lifetime offer is not configured");

    return {
      hasPaidAccess,
      tier: entitlements.some((item) => item.active && item.entitlement === "lifetime")
        ? "lifetime"
        : subscription && ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status)
          ? "pro"
          : "none",
      subscription,
      purchase,
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
  });

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