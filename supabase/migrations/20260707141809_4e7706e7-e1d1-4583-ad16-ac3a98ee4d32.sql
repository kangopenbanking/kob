ALTER TABLE public.giveting_campaigns DROP CONSTRAINT IF EXISTS giveting_campaigns_status_check;
ALTER TABLE public.giveting_campaigns ADD CONSTRAINT giveting_campaigns_status_check CHECK (status IN ('draft','pending','active','paused','blocked','completed','archived'));
ALTER TABLE public.giveting_campaigns ADD COLUMN IF NOT EXISTS moderation_notes TEXT;
ALTER TABLE public.giveting_campaigns ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.giveting_campaigns ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;