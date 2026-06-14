CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.profiles (id UUID PRIMARY KEY, email TEXT, display_name TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TYPE public.mail_provider AS ENUM ('gmail','outlook');
CREATE TABLE public.mailbox_connections (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, provider public.mail_provider NOT NULL, email TEXT NOT NULL, display_name TEXT, access_token TEXT, refresh_token TEXT, expires_at TIMESTAMPTZ, scopes TEXT, daily_sent_count INT NOT NULL DEFAULT 0, daily_sent_date DATE NOT NULL DEFAULT CURRENT_DATE, daily_cap INT NOT NULL DEFAULT 200, warmup_started_on DATE, status TEXT NOT NULL DEFAULT 'active', last_history_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (user_id, provider, email));
GRANT SELECT, DELETE, UPDATE ON public.mailbox_connections TO authenticated; GRANT ALL ON public.mailbox_connections TO service_role;
ALTER TABLE public.mailbox_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mailbox read meta" ON public.mailbox_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own mailbox delete" ON public.mailbox_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own mailbox update cap" ON public.mailbox_connections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER mailbox_touch BEFORE UPDATE ON public.mailbox_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, name TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '', body_html TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated; GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own templates" ON public.templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER templates_touch BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.contact_lists (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, name TEXT NOT NULL, contact_count INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_lists TO authenticated; GRANT ALL ON public.contact_lists TO service_role;
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lists" ON public.contact_lists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER lists_touch BEFORE UPDATE ON public.contact_lists FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, list_id UUID NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE, email TEXT NOT NULL, vars JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (list_id, email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated; GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts" ON public.contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX contacts_list_idx ON public.contacts(list_id);

CREATE TYPE public.suppression_reason AS ENUM ('unsubscribe','bounce','complaint','manual','invalid');
CREATE TABLE public.suppressions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, email TEXT NOT NULL, reason public.suppression_reason NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (user_id, email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppressions TO authenticated; GRANT ALL ON public.suppressions TO service_role;
ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own suppressions" ON public.suppressions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TYPE public.campaign_status AS ENUM ('draft','scheduled','sending','paused','done','failed');
CREATE TABLE public.campaigns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, mailbox_id UUID REFERENCES public.mailbox_connections(id) ON DELETE SET NULL, list_id UUID REFERENCES public.contact_lists(id) ON DELETE SET NULL, name TEXT NOT NULL DEFAULT 'Untitled', from_name TEXT, subject TEXT NOT NULL DEFAULT '', body_html TEXT NOT NULL DEFAULT '', status public.campaign_status NOT NULL DEFAULT 'draft', scheduled_for TIMESTAMPTZ, throttle_seconds INT NOT NULL DEFAULT 8, daily_cap INT NOT NULL DEFAULT 200, total_count INT NOT NULL DEFAULT 0, sent_count INT NOT NULL DEFAULT 0, failed_count INT NOT NULL DEFAULT 0, replied_count INT NOT NULL DEFAULT 0, unsubscribed_count INT NOT NULL DEFAULT 0, next_dispatch_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated; GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.campaigns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER campaigns_touch BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TYPE public.recipient_status AS ENUM ('pending','sent','failed','replied','unsubscribed','skipped');
CREATE TABLE public.campaign_recipients (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE, user_id UUID NOT NULL, email TEXT NOT NULL, vars JSONB NOT NULL DEFAULT '{}'::jsonb, status public.recipient_status NOT NULL DEFAULT 'pending', sent_at TIMESTAMPTZ, error TEXT, message_id TEXT, thread_id TEXT, unsubscribe_token TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_recipients TO authenticated; GRANT ALL ON public.campaign_recipients TO service_role;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaign recipients" ON public.campaign_recipients FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX cr_campaign_idx ON public.campaign_recipients(campaign_id);
CREATE INDEX cr_pending_idx ON public.campaign_recipients(campaign_id, status) WHERE status = 'pending';

REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;