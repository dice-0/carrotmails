CREATE TABLE IF NOT EXISTS public.email_send_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mailbox_id uuid REFERENCES public.mailbox_connections(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.email_send_events TO authenticated;
GRANT ALL ON public.email_send_events TO service_role;
ALTER TABLE public.email_send_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own send events" ON public.email_send_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own send events" ON public.email_send_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS email_send_events_user_sent_at_idx ON public.email_send_events (user_id, sent_at DESC);