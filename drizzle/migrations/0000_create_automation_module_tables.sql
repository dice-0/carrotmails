create type public.automation_campaign_status as enum ('draft','preparing','active','paused','completed','archived');
create type public.automation_contact_status as enum ('pending','draft_created','sent','replied','bounced','suppressed','failed','skipped','paused_review','fu_pending','completed');
create type public.automation_event_type as enum ('draft_created','email_manually_sent','followup_generated','followup_sent','reply_received','bounce_detected','contact_suppressed','contact_resumed','duplicate_prevented','invalid_recipient','error','ooo_detected','manual_outreach_detected','campaign_created','audit_run');
create type public.automation_stage as enum ('initial','fu1','fu2','fu3','fu4','test');
create type public.automation_suppression_reason as enum ('hard_bounce','manual','unsubscribe','invalid');

create table public.automation_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mailbox_id uuid references public.mailbox_connections(id),
  name text not null,
  status public.automation_campaign_status not null default 'draft',
  from_name text,
  subject text not null default '',
  body_html text not null default '',
  default_cc text,
  default_bcc text,
  attachments jsonb not null default '[]'::jsonb,
  consent_confirmed boolean not null default false,
  consent_source text,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid not null references public.automation_campaigns(id) on delete cascade,
  email text not null,
  name text,
  first_name text,
  name2 text,
  company text,
  role text,
  cc text,
  bcc text,
  followup_cc boolean not null default false,
  status public.automation_contact_status not null default 'pending',
  custom jsonb not null default '{}'::jsonb,
  gmail_thread_id text,
  last_stage public.automation_stage,
  last_sent_at timestamptz,
  next_followup_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create table public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid not null references public.automation_campaigns(id) on delete cascade,
  stage public.automation_stage not null check (stage in ('initial','fu1','fu2','fu3','fu4')),
  enabled boolean not null default true,
  delay_days integer not null default 3 check (delay_days >= 0),
  subject text,
  body_html text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  delivery_mode text not null default 'draft' check (delivery_mode in ('draft','send')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, stage)
);

create table public.automation_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid not null references public.automation_campaigns(id) on delete cascade,
  contact_id uuid not null references public.automation_contacts(id) on delete cascade,
  stage public.automation_stage not null,
  gmail_draft_id text,
  gmail_message_id text,
  thread_id text,
  expected_cc text,
  cc_verified boolean not null default false,
  status text not null default 'created' check (status in ('created','regenerated','sent','discarded','error')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (campaign_id, contact_id, stage)
);

create table public.automation_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid references public.automation_campaigns(id) on delete cascade,
  contact_id uuid references public.automation_contacts(id) on delete cascade,
  gmail_message_id text not null,
  thread_id text,
  direction text not null check (direction in ('out','in')),
  kind text not null,
  sent_at timestamptz,
  headers jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create table public.automation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid references public.automation_campaigns(id) on delete cascade,
  contact_id uuid references public.automation_contacts(id) on delete set null,
  event_type public.automation_event_type not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.automation_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  reason public.automation_suppression_reason not null,
  campaign_id uuid references public.automation_campaigns(id) on delete set null,
  source_message_id text,
  note text,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (user_id, email)
);

create table public.automation_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid not null references public.automation_campaigns(id) on delete cascade,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.mailbox_sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mailbox_id uuid not null references public.mailbox_connections(id) on delete cascade,
  history_id text,
  last_sync_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (mailbox_id)
);

create index automation_campaigns_user_idx on public.automation_campaigns(user_id);
create index automation_contacts_campaign_idx on public.automation_contacts(campaign_id, status);
create index automation_contacts_next_fu_idx on public.automation_contacts(user_id, next_followup_at) where next_followup_at is not null;
create index automation_drafts_campaign_idx on public.automation_drafts(campaign_id, stage);
create index automation_messages_campaign_idx on public.automation_messages(campaign_id, direction, kind);
create index automation_messages_thread_idx on public.automation_messages(thread_id);
create index automation_events_campaign_idx on public.automation_events(campaign_id, created_at desc);
create index automation_events_user_idx on public.automation_events(user_id, created_at desc);
create index automation_suppressions_user_idx on public.automation_suppressions(user_id) where removed_at is null;
create index automation_audits_campaign_idx on public.automation_audits(campaign_id, created_at desc);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_suppressions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_audits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mailbox_sync_state TO authenticated;
GRANT ALL ON public.automation_campaigns TO service_role;
GRANT ALL ON public.automation_contacts TO service_role;
GRANT ALL ON public.automation_steps TO service_role;
GRANT ALL ON public.automation_drafts TO service_role;
GRANT ALL ON public.automation_messages TO service_role;
GRANT ALL ON public.automation_events TO service_role;
GRANT ALL ON public.automation_suppressions TO service_role;
GRANT ALL ON public.automation_audits TO service_role;
GRANT ALL ON public.mailbox_sync_state TO service_role;

ALTER TABLE public.automation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mailbox_sync_state ENABLE ROW LEVEL SECURITY;

create policy "own automation campaigns" on public.automation_campaigns for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation contacts" on public.automation_contacts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation steps" on public.automation_steps for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation drafts" on public.automation_drafts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation messages" on public.automation_messages for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation events" on public.automation_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation suppressions" on public.automation_suppressions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own automation audits" on public.automation_audits for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own mailbox sync state" on public.mailbox_sync_state for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);