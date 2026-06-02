ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_dismissed
  ON public.app_notifications (user_id, dismissed_at) WHERE dismissed_at IS NULL;