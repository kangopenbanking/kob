
-- Credit event types enum
CREATE TYPE public.credit_event_type AS ENUM (
  'LOAN_REPAYMENT_ON_TIME',
  'LOAN_REPAYMENT_LATE',
  'LOAN_INSTALLMENT_MISSED',
  'LOAN_DEFAULTED',
  'LOAN_CLOSED',
  'SAVINGS_DEPOSIT',
  'SAVINGS_WITHDRAWAL',
  'SAVINGS_BALANCE_STABLE'
);

-- Score band enum
CREATE TYPE public.credit_score_band AS ENUM ('A', 'B', 'C', 'D', 'F');

-- Immutable credit events table
CREATE TABLE public.credit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id),
  event_type public.credit_event_type NOT NULL,
  event_time timestamptz NOT NULL DEFAULT now(),
  value_numeric numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_events_user_time ON public.credit_events(user_id, event_time DESC);
CREATE INDEX idx_credit_events_type ON public.credit_events(event_type);

-- Credit profiles table
CREATE TABLE public.credit_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  institution_id uuid REFERENCES public.institutions(id),
  current_score integer NOT NULL DEFAULT 500,
  score_band public.credit_score_band NOT NULL DEFAULT 'C',
  last_computed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Credit score snapshots
CREATE TABLE public.credit_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id),
  score integer NOT NULL,
  score_band public.credit_score_band NOT NULL,
  factors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_snapshots_user ON public.credit_score_snapshots(user_id, computed_at DESC);

-- Credit scoring rules (institution-configurable)
CREATE TABLE public.credit_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.institutions(id),
  rule_key text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add missed_event_created to loan_schedule for dedupe
ALTER TABLE public.loan_schedule ADD COLUMN IF NOT EXISTS missed_event_created boolean NOT NULL DEFAULT false;

-- RLS
ALTER TABLE public.credit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_scoring_rules ENABLE ROW LEVEL SECURITY;

-- Users read own credit_events
CREATE POLICY "Users read own credit events" ON public.credit_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role inserts credit_events
CREATE POLICY "Service role inserts credit events" ON public.credit_events
  FOR INSERT TO service_role WITH CHECK (true);

-- Users read own credit_profiles
CREATE POLICY "Users read own credit profile" ON public.credit_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role manages credit_profiles
CREATE POLICY "Service role manages credit profiles" ON public.credit_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users read own snapshots
CREATE POLICY "Users read own snapshots" ON public.credit_score_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role inserts snapshots
CREATE POLICY "Service role inserts snapshots" ON public.credit_score_snapshots
  FOR INSERT TO service_role WITH CHECK (true);

-- Anyone can read scoring rules
CREATE POLICY "Anyone reads scoring rules" ON public.credit_scoring_rules
  FOR SELECT TO authenticated USING (true);

-- Service role manages scoring rules
CREATE POLICY "Service role manages scoring rules" ON public.credit_scoring_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime on credit_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_events;
