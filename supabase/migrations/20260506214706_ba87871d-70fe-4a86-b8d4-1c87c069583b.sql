
ALTER TABLE public.gateway_merchants
  ADD COLUMN IF NOT EXISTS live_mode_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_mode_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_mode_enabled_by uuid;

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS live_mode_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_mode_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_mode_enabled_by uuid,
  ADD COLUMN IF NOT EXISTS kyb_status text NOT NULL DEFAULT 'not_submitted';

ALTER TABLE public.developer_orgs
  ADD COLUMN IF NOT EXISTS kyb_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS kyb_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyb_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyb_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS kyb_documents jsonb,
  ADD COLUMN IF NOT EXISTS kyb_rejection_reason text,
  ADD COLUMN IF NOT EXISTS live_mode_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_mode_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_mode_enabled_by uuid;
