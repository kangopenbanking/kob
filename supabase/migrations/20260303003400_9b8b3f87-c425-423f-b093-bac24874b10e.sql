-- GAP 5: Add app_context column to user_active_sessions for cross-app session isolation
ALTER TABLE public.user_active_sessions ADD COLUMN app_context text NOT NULL DEFAULT 'customer';

-- Update unique constraint to scope per app_context instead of globally per user
-- First check existing constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_active_sessions_user_app ON public.user_active_sessions (user_id, app_context);
