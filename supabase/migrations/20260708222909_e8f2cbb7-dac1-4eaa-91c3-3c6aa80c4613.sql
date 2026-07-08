
-- 1. kang_chat_sessions
CREATE TABLE public.kang_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kang_chat_sessions TO authenticated;
GRANT ALL ON public.kang_chat_sessions TO service_role;
ALTER TABLE public.kang_chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own kang sessions" ON public.kang_chat_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_kang_chat_sessions_user ON public.kang_chat_sessions(user_id, updated_at DESC);

-- 2. kang_messages
CREATE TABLE public.kang_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.kang_chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kang_messages TO authenticated;
GRANT ALL ON public.kang_messages TO service_role;
ALTER TABLE public.kang_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own kang messages" ON public.kang_messages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_kang_messages_session ON public.kang_messages(session_id, created_at);

-- 3. kang_subscriptions
CREATE TABLE public.kang_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','suspended')),
  questions_asked_count INTEGER NOT NULL DEFAULT 0,
  free_questions_limit INTEGER NOT NULL DEFAULT 5,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  last_payment_status TEXT NOT NULL DEFAULT 'none' CHECK (last_payment_status IN ('none','success','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kang_subscriptions TO authenticated;
GRANT ALL ON public.kang_subscriptions TO service_role;
ALTER TABLE public.kang_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own kang subscription" ON public.kang_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. credit_score_ledger
CREATE TABLE public.credit_score_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_score_ledger TO authenticated;
GRANT ALL ON public.credit_score_ledger TO service_role;
ALTER TABLE public.credit_score_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own credit score ledger" ON public.credit_score_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_credit_score_ledger_user ON public.credit_score_ledger(user_id, created_at DESC);

-- 5. profiles.credit_score column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_score INTEGER NOT NULL DEFAULT 500;

-- 6. updated_at trigger (reuse if exists)
CREATE OR REPLACE FUNCTION public.kang_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_kang_chat_sessions_updated
  BEFORE UPDATE ON public.kang_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.kang_set_updated_at();

CREATE TRIGGER trg_kang_subscriptions_updated
  BEFORE UPDATE ON public.kang_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.kang_set_updated_at();
