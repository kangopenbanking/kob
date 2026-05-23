
-- ============================================================
-- Round-Up Savings: settings, transactions ledger, events log
-- ============================================================

-- 1. SETTINGS -------------------------------------------------
CREATE TABLE public.roundup_settings (
  consumer_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  threshold integer NOT NULL DEFAULT 100 CHECK (threshold IN (10, 50, 100, 500, 1000)),
  min_save integer NOT NULL DEFAULT 10 CHECK (min_save >= 0),
  max_save integer NOT NULL DEFAULT 2000 CHECK (max_save >= 0),
  daily_cap integer NOT NULL DEFAULT 5000 CHECK (daily_cap >= 0),
  min_balance_floor integer NOT NULL DEFAULT 0 CHECK (min_balance_floor >= 0),
  default_goal_id uuid REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  paused_until timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roundup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_roundup_settings" ON public.roundup_settings
  FOR SELECT USING (consumer_id = auth.uid());
CREATE POLICY "owner_insert_roundup_settings" ON public.roundup_settings
  FOR INSERT WITH CHECK (consumer_id = auth.uid());
CREATE POLICY "owner_update_roundup_settings" ON public.roundup_settings
  FOR UPDATE USING (consumer_id = auth.uid()) WITH CHECK (consumer_id = auth.uid());

CREATE TRIGGER trg_roundup_settings_updated
  BEFORE UPDATE ON public.roundup_settings
  FOR EACH ROW EXECUTE FUNCTION public.budget_set_updated_at();

-- 2. TRANSACTIONS LEDGER -------------------------------------
CREATE TABLE public.roundup_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL,
  source_tx_id text NOT NULL,
  goal_id uuid REFERENCES public.savings_goals(id) ON DELETE SET NULL,
  original_amount numeric(14,2) NOT NULL CHECK (original_amount >= 0),
  rounded_amount numeric(14,2) NOT NULL CHECK (rounded_amount >= 0),
  roundup_amount numeric(14,2) NOT NULL CHECK (roundup_amount >= 0),
  threshold_used integer NOT NULL,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','processing','successful','failed','reversed','skipped')),
  skip_reason text,
  idempotency_key text NOT NULL,
  retry_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consumer_id, source_tx_id),
  UNIQUE (idempotency_key)
);

CREATE INDEX idx_roundup_tx_consumer_state
  ON public.roundup_transactions (consumer_id, state, created_at DESC);
CREATE INDEX idx_roundup_tx_retry
  ON public.roundup_transactions (next_retry_at)
  WHERE state = 'failed';

ALTER TABLE public.roundup_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_roundup_tx" ON public.roundup_transactions
  FOR SELECT USING (consumer_id = auth.uid());

CREATE TRIGGER trg_roundup_tx_updated
  BEFORE UPDATE ON public.roundup_transactions
  FOR EACH ROW EXECUTE FUNCTION public.budget_set_updated_at();

-- 3. EVENTS (append-only) ------------------------------------
CREATE TABLE public.roundup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id uuid NOT NULL,
  transaction_id uuid REFERENCES public.roundup_transactions(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'TRANSACTION_DETECTED',
      'ROUNDUP_CALCULATED',
      'SAVE_PENDING',
      'SAVE_SUCCESS',
      'SAVE_FAILED',
      'LOW_BALANCE_SKIPPED',
      'DAILY_CAP_SKIPPED',
      'BELOW_MIN_SKIPPED',
      'PAUSED'
    )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roundup_events_consumer
  ON public.roundup_events (consumer_id, created_at DESC);

ALTER TABLE public.roundup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_roundup_events" ON public.roundup_events
  FOR SELECT USING (consumer_id = auth.uid());
