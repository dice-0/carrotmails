
-- 1. Fix form_submissions INSERT policy: force user_id to match form owner, verify form exists
DROP POLICY IF EXISTS "Anyone can submit form responses" ON public.form_submissions;
CREATE POLICY "Anyone can submit form responses"
  ON public.form_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id = (SELECT f.user_id FROM public.forms f WHERE f.id = form_submissions.form_id)
  );

-- 2. Tighten templates policy to explicitly require an authenticated user
DROP POLICY IF EXISTS "own templates" ON public.templates;
CREATE POLICY "own templates"
  ON public.templates
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 3. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated/PUBLIC.
--    These are only called from database triggers / pg_cron / service_role.
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
