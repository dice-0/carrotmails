
-- Consent tracking: contact lists must be marked as opt-in before use
ALTER TABLE public.contact_lists
  ADD COLUMN IF NOT EXISTS consent_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_confirmed_at timestamptz;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS consent_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_confirmed_at timestamptz;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS consent_confirmed_at timestamptz;
