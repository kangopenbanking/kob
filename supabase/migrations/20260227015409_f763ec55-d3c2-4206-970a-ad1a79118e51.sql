
-- Create user_active_sessions table for single session enforcement
CREATE TABLE public.user_active_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id text NOT NULL UNIQUE,
  device_info text,
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now()
);

-- Index on user_id for fast lookups
CREATE INDEX idx_user_active_sessions_user_id ON public.user_active_sessions(user_id);

-- Enable RLS
ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions
CREATE POLICY "Users can read own sessions" ON public.user_active_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions" ON public.user_active_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can do everything (for the edge function)
CREATE POLICY "Service role full access" ON public.user_active_sessions
  FOR ALL USING (auth.role() = 'service_role');
