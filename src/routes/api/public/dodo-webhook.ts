import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "standardwebhooks";
import { z } from "zod";

const eventSchema = z.object({
  type: z.string().min(1).max(100),
  data: z.object({
    payment_id: z.string().optional(),
    subscription_id: z.string().optional(),
    customer: z.object({ customer_id: z.string().optional(), email: z.string().email().optional() }).optional(),
    customer_id: z.string().optional(),
    product_cart: z.array(z.object({ product_id: z.string() }).passthrough()).optional(),
    product_id: z.string().optional(),
    amount: z.number().int().nonnegative().optional(),
    currency: z.string().optional(),
    status: z.string().optional(),
    next_billing_date: z.string().nullable().optional(),
    cancel_at_next_billing_date: z.boolean().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  }).passthrough(),
});

export const Route = createFileRoute("/api/public/dodo-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const body = await request.text();
        const headers = {
          "webhook-id": request.headers.get("webhook-id") ?? "",
          "webhook-signature": request.headers.get("webhook-signature") ?? "",
          "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
        };

        let event: z.infer<typeof eventSchema>;
        try {
          const verified = new Webhook(secret).verify(body, headers);
          event = eventSchema.parse(verified);
        } catch {
          return new Response("Invalid signature or payload", { status: 401 });
        }

        const eventId = headers["webhook-id"];
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin
          .from("billing_webhook_events")
          .select("id")
          .eq("provider_event_id", eventId)
          .maybeSingle();
        if (existing) return Response.json({ received: true, duplicate: true });

        const userId = event.data.metadata?.user_id;
        const plan = event.data.metadata?.plan;
        if (!userId || !z.string().uuid().safeParse(userId).success || !["pro", "lifetime"].includes(plan ?? "")) {
          return new Response("Missing checkout metadata", { status: 400 });
        }

        const customerId = event.data.customer?.customer_id ?? event.data.customer_id;
        const productId = event.data.product_id ?? event.data.product_cart?.[0]?.product_id;
        const isSuccess = ["payment.succeeded", "subscription.active", "subscription.renewed", "subscription.updated"].includes(event.type);
        const isSubscriptionInactive = ["subscription.cancelled", "subscription.expired", "subscription.failed"].includes(event.type);

        if (customerId) {
          const { error } = await supabaseAdmin.from("billing_customers").upsert({
            user_id: userId,
            provider_customer_id: customerId,
            email: event.data.customer?.email ?? null,
          }, { onConflict: "user_id" });
          if (error) return new Response("Customer sync failed", { status: 500 });
        }

        if (plan === "pro" && event.data.subscription_id && productId) {
          const status = event.data.status ?? event.type.replace("subscription.", "");
          const { error } = await supabaseAdmin.from("billing_subscriptions").upsert({
            user_id: userId,
            provider_subscription_id: event.data.subscription_id,
            provider_product_id: productId,
            plan: "pro",
            status,
            current_period_end: event.data.next_billing_date ?? null,
            cancel_at_period_end: event.data.cancel_at_next_billing_date ?? false,
          }, { onConflict: "provider_subscription_id" });
          if (error) return new Response("Subscription sync failed", { status: 500 });

          const { error: entitlementError } = await supabaseAdmin.from("billing_entitlements").upsert({
            user_id: userId,
            entitlement: "pro",
            source_id: event.data.subscription_id,
            active: isSuccess && !isSubscriptionInactive,
            expires_at: event.data.next_billing_date ?? null,
          }, { onConflict: "user_id,entitlement" });
          if (entitlementError) return new Response("Entitlement sync failed", { status: 500 });
        }

        if (plan === "lifetime" && event.type === "payment.succeeded" && event.data.payment_id && productId) {
          const { data: previous } = await supabaseAdmin
            .from("billing_purchases")
            .select("id")
            .eq("provider_payment_id", event.data.payment_id)
            .maybeSingle();
          const { error: purchaseError } = await supabaseAdmin.from("billing_purchases").upsert({
            user_id: userId,
            provider_payment_id: event.data.payment_id,
            provider_product_id: productId,
            product: "lifetime",
            status: "succeeded",
            amount_cents: event.data.amount ?? 999,
            currency: (event.data.currency ?? "USD").toUpperCase(),
            completed_at: new Date().toISOString(),
          }, { onConflict: "provider_payment_id" });
          if (purchaseError) return new Response("Purchase sync failed", { status: 500 });

          const { error: entitlementError } = await supabaseAdmin.from("billing_entitlements").upsert({
            user_id: userId,
            entitlement: "lifetime",
            source_id: event.data.payment_id,
            active: true,
            expires_at: null,
          }, { onConflict: "user_id,entitlement" });
          if (entitlementError) return new Response("Entitlement sync failed", { status: 500 });

          if (!previous) {
            const { data: offer, error: offerReadError } = await supabaseAdmin
              .from("billing_offers")
              .select("redemption_count, max_redemptions")
              .eq("code", "lifetime-launch")
              .single();
            if (offerReadError || !offer || offer.redemption_count >= offer.max_redemptions) {
              return new Response("Lifetime offer capacity exceeded", { status: 409 });
            }
            const nextCount = offer.redemption_count + 1;
            const { error: offerError } = await supabaseAdmin.from("billing_offers").update({
              redemption_count: nextCount,
              active: nextCount < offer.max_redemptions,
            }).eq("code", "lifetime-launch").eq("redemption_count", offer.redemption_count);
            if (offerError) return new Response("Offer sync failed", { status: 500 });
          }
        }

        const { error: eventError } = await supabaseAdmin.from("billing_webhook_events").insert({
          provider_event_id: eventId,
          event_type: event.type,
        });
        if (eventError) return new Response("Event sync failed", { status: 500 });
        return Response.json({ received: true });
      },
    },
  },
});