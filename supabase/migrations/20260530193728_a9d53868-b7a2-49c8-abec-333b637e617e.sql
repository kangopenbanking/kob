
CREATE TABLE IF NOT EXISTS public.firebase_phone_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  failed_attempts integer NOT NULL DEFAULT 0,
  last_failure_at timestamptz,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.firebase_phone_lockouts TO authenticated;
GRANT ALL ON public.firebase_phone_lockouts TO service_role;

ALTER TABLE public.firebase_phone_lockouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read firebase phone lockouts"
ON public.firebase_phone_lockouts
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.firebase_token_replay_guard (
  token_hash text PRIMARY KEY,
  user_id uuid,
  phone_number text,
  used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);

GRANT SELECT ON public.firebase_token_replay_guard TO authenticated;
GRANT ALL ON public.firebase_token_replay_guard TO service_role;

ALTER TABLE public.firebase_token_replay_guard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read firebase token replay guard"
ON public.firebase_token_replay_guard
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_fb_token_replay_expires
ON public.firebase_token_replay_guard (expires_at);

CREATE INDEX IF NOT EXISTS idx_fb_phone_lockouts_locked_until
ON public.firebase_phone_lockouts (locked_until);
