REVOKE SELECT ON public.mailbox_connections FROM authenticated;
GRANT SELECT (id, user_id, provider, email, display_name, expires_at, scopes,
              daily_sent_count, daily_sent_date, daily_cap, warmup_started_on,
              status, last_history_id, created_at, updated_at)
  ON public.mailbox_connections TO authenticated;

DROP POLICY IF EXISTS "Anyone can view billing offers" ON public.billing_offers;
REVOKE SELECT ON public.billing_offers FROM anon, authenticated;
GRANT SELECT (name, price_cents, currency, active) ON public.billing_offers TO authenticated;
CREATE POLICY "Authenticated can view offer summary" ON public.billing_offers
  FOR SELECT TO authenticated USING (true);