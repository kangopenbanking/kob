ALTER TABLE public.support_agents
  ADD COLUMN IF NOT EXISTS password_reset_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS invited_by uuid;