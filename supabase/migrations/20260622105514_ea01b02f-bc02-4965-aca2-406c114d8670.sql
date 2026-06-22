
-- email_send_log: drop public-scoped service_role policies, add service_role-only ones
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "Service role manages send log"
  ON public.email_send_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- email_send_state
DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role manages send state"
  ON public.email_send_state FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- email_unsubscribe_tokens
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role manages unsubscribe tokens"
  ON public.email_unsubscribe_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- suppressed_emails
DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role manages suppressed emails"
  ON public.suppressed_emails FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- form_submissions: allow anonymous public submissions
CREATE POLICY "Anyone can submit form responses"
  ON public.form_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (true);
GRANT INSERT ON public.form_submissions TO anon;

-- RLS-enabled-no-policy: add explicit service_role-only policies
CREATE POLICY "Service role manages mailbox connections"
  ON public.mailbox_connections FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages billing offers"
  ON public.billing_offers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- function_search_path_mutable: pin search_path on forms_set_updated_at (already set, ensure others)
ALTER FUNCTION public.forms_set_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
