CREATE TABLE public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'dodo' CHECK (provider = 'dodo'),
  provider_customer_id TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own billing customer" ON public.billing_customers FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider_subscription_id TEXT NOT NULL UNIQUE,
  provider_product_id TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'pro' CHECK (plan = 'pro'),
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_subscriptions TO authenticated;
GRANT ALL ON public.billing_subscriptions TO service_role;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON public.billing_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.billing_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider_payment_id TEXT NOT NULL UNIQUE,
  provider_product_id TEXT NOT NULL,
  product TEXT NOT NULL CHECK (product = 'lifetime'),
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_purchases TO authenticated;
GRANT ALL ON public.billing_purchases TO service_role;
ALTER TABLE public.billing_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own purchases" ON public.billing_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.billing_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entitlement TEXT NOT NULL CHECK (entitlement IN ('pro', 'lifetime')),
  source_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entitlement)
);
GRANT SELECT ON public.billing_entitlements TO authenticated;
GRANT ALL ON public.billing_entitlements TO service_role;
ALTER TABLE public.billing_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own entitlements" ON public.billing_entitlements FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.billing_webhook_events TO service_role;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.billing_offers (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  max_redemptions INTEGER NOT NULL CHECK (max_redemptions > 0),
  redemption_count INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (redemption_count <= max_redemptions)
);
GRANT SELECT ON public.billing_offers TO anon, authenticated;
GRANT ALL ON public.billing_offers TO service_role;
ALTER TABLE public.billing_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view billing offers" ON public.billing_offers FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.billing_offers (code, name, price_cents, currency, max_redemptions)
VALUES ('lifetime-launch', 'Lifetime Launch', 999, 'USD', 100);

CREATE TRIGGER touch_billing_customers_updated_at BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_billing_subscriptions_updated_at BEFORE UPDATE ON public.billing_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_billing_purchases_updated_at BEFORE UPDATE ON public.billing_purchases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_billing_entitlements_updated_at BEFORE UPDATE ON public.billing_entitlements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_billing_offers_updated_at BEFORE UPDATE ON public.billing_offers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();