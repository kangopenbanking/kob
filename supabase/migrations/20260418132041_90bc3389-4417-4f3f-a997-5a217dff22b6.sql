-- ============================================================
-- CrediQ monetization (v2): bank inquiry billing + consumer premium
-- ============================================================

-- 1. Extend allowed transaction types on fee_structures
ALTER TABLE public.fee_structures
  DROP CONSTRAINT IF EXISTS fee_structures_transaction_type_check;

ALTER TABLE public.fee_structures
  ADD CONSTRAINT fee_structures_transaction_type_check CHECK (
    transaction_type = ANY (ARRAY[
      'transfer','payment','bill_payment','mobile_money_transfer','mobile_money_charge',
      'withdrawal','deposit','piggybank','njangi','rent','international_transfer',
      'card_payment','p2p','cashout','bank_transfer','ussd_payment','account_funding',
      'paypal_payment','virtual_card_topup','gateway_charge','gateway_payout',
      'fx_conversion','api_request','qr_payment','loan_disbursement','loan_repayment',
      'savings_deposit','savings_withdrawal','njangi_contribution','njangi_payout',
      'piggybank_deposit','piggybank_withdrawal','rent_payment','escrow_payment',
      'mobile_recharge','invoice_create','credit_report_purchase','overdraft_fee',
      'loan_processing_fee','atm_withdrawal','standing_order','dormancy_fee',
      'remittance_inbound','remittance_outbound','remittance_bank_credit',
      'remittance_wallet_credit','remittance_bill_payment','remittance_fx_markup',
      'overdraft_interest','overdraft_setup_fee','overdraft_renewal_fee',
      'byo_mobile_money_routing','byo_fallback_charge',
      -- New CrediQ entries
      'credit_score_inquiry','credit_report_inquiry','credit_premium_subscription'
    ])
  );

-- 2. Seed platform-wide fee structures for the new credit types
INSERT INTO public.fee_structures
  (fee_scope, transaction_type, fee_model, fixed_amount, percentage_rate,
   min_fee_amount, max_fee_amount, max_charge_cap, effective_from, is_active)
VALUES
  ('platform','credit_score_inquiry','fixed', 500, 0, 0, 500, 500, CURRENT_DATE, true),
  ('platform','credit_report_inquiry','fixed', 2500, 0, 0, 2500, 2500, CURRENT_DATE, true),
  ('platform','credit_premium_subscription','fixed', 1500, 0, 0, 1500, 1500, CURRENT_DATE, true)
ON CONFLICT (institution_id, transaction_type, effective_from) DO NOTHING;

-- 3. Bank pricing tiers
CREATE TABLE IF NOT EXISTS public.credit_api_pricing_tiers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name       text NOT NULL UNIQUE,
  monthly_base_fee numeric(12,2) NOT NULL DEFAULT 0,
  included_queries integer       NOT NULL DEFAULT 0,
  per_query_score_fee  numeric(10,2) NOT NULL DEFAULT 500,
  per_query_report_fee numeric(10,2) NOT NULL DEFAULT 2500,
  monthly_query_cap    integer,
  currency        text NOT NULL DEFAULT 'XAF',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_api_pricing_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage pricing tiers" ON public.credit_api_pricing_tiers;
CREATE POLICY "Admins manage pricing tiers" ON public.credit_api_pricing_tiers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Authenticated read pricing tiers" ON public.credit_api_pricing_tiers;
CREATE POLICY "Authenticated read pricing tiers" ON public.credit_api_pricing_tiers
  FOR SELECT TO authenticated USING (is_active);

INSERT INTO public.credit_api_pricing_tiers
  (tier_name, monthly_base_fee, included_queries, per_query_score_fee, per_query_report_fee, monthly_query_cap)
VALUES
  ('standard',   0,       0,    500,  2500,  NULL),
  ('premium',    25000,  100,   400,  2000,  5000),
  ('enterprise', 150000, 1000,  300,  1500,  NULL)
ON CONFLICT (tier_name) DO NOTHING;

-- 4. Monthly usage rollup
CREATE TABLE IF NOT EXISTS public.credit_api_monthly_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.credit_api_clients(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  score_queries  integer NOT NULL DEFAULT 0,
  report_queries integer NOT NULL DEFAULT 0,
  total_billed   numeric(12,2) NOT NULL DEFAULT 0,
  currency       text NOT NULL DEFAULT 'XAF',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, period_month)
);
CREATE INDEX IF NOT EXISTS idx_credit_api_monthly_usage_client_period
  ON public.credit_api_monthly_usage (client_id, period_month DESC);

ALTER TABLE public.credit_api_monthly_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read monthly usage" ON public.credit_api_monthly_usage;
CREATE POLICY "Admins read monthly usage" ON public.credit_api_monthly_usage
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Service role manages monthly usage" ON public.credit_api_monthly_usage;
CREATE POLICY "Service role manages monthly usage" ON public.credit_api_monthly_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Institution owners read own client usage" ON public.credit_api_monthly_usage;
CREATE POLICY "Institution owners read own client usage"
  ON public.credit_api_monthly_usage FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.credit_api_clients c
    JOIN public.institutions i ON i.id = c.institution_id
    WHERE c.id = credit_api_monthly_usage.client_id AND i.user_id = auth.uid()
  ));

-- 5. Tier link on credit_api_clients
ALTER TABLE public.credit_api_clients
  ADD COLUMN IF NOT EXISTS pricing_tier_id uuid REFERENCES public.credit_api_pricing_tiers(id),
  ADD COLUMN IF NOT EXISTS monthly_query_cap_override integer;

UPDATE public.credit_api_clients
SET pricing_tier_id = (SELECT id FROM public.credit_api_pricing_tiers WHERE tier_name = 'standard')
WHERE pricing_tier_id IS NULL;

-- 6. Consumer Premium subscriptions
CREATE TABLE IF NOT EXISTS public.crediq_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan            text NOT NULL DEFAULT 'premium' CHECK (plan IN ('premium')),
  status          text NOT NULL DEFAULT 'active'  CHECK (status IN ('active','cancelled','past_due','expired')),
  amount          numeric(10,2) NOT NULL DEFAULT 1500,
  currency        text NOT NULL DEFAULT 'XAF',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end   timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  auto_renew      boolean NOT NULL DEFAULT true,
  cancelled_at    timestamptz,
  last_charge_id  uuid,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crediq_subscriptions_user_active
  ON public.crediq_subscriptions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_crediq_subscriptions_period_end
  ON public.crediq_subscriptions(current_period_end) WHERE status = 'active';

ALTER TABLE public.crediq_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own subscription" ON public.crediq_subscriptions;
CREATE POLICY "Users read own subscription" ON public.crediq_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.crediq_subscriptions;
CREATE POLICY "Service role manages subscriptions" ON public.crediq_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins read all subscriptions" ON public.crediq_subscriptions;
CREATE POLICY "Admins read all subscriptions" ON public.crediq_subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. Reminder log
CREATE TABLE IF NOT EXISTS public.crediq_reminder_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('weekly_digest','monthly_report','score_change','tip_recommendation')),
  period_key   text NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb,
  UNIQUE (user_id, reminder_type, period_key)
);
CREATE INDEX IF NOT EXISTS idx_crediq_reminder_log_user
  ON public.crediq_reminder_log(user_id, sent_at DESC);

ALTER TABLE public.crediq_reminder_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own reminders" ON public.crediq_reminder_log;
CREATE POLICY "Users read own reminders" ON public.crediq_reminder_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role manages reminders" ON public.crediq_reminder_log;
CREATE POLICY "Service role manages reminders" ON public.crediq_reminder_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. updated_at triggers
DROP TRIGGER IF EXISTS trg_credit_api_pricing_tiers_updated ON public.credit_api_pricing_tiers;
CREATE TRIGGER trg_credit_api_pricing_tiers_updated
  BEFORE UPDATE ON public.credit_api_pricing_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_credit_api_monthly_usage_updated ON public.credit_api_monthly_usage;
CREATE TRIGGER trg_credit_api_monthly_usage_updated
  BEFORE UPDATE ON public.credit_api_monthly_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_crediq_subscriptions_updated ON public.crediq_subscriptions;
CREATE TRIGGER trg_crediq_subscriptions_updated
  BEFORE UPDATE ON public.crediq_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Helper: increment monthly usage atomically
CREATE OR REPLACE FUNCTION public.increment_credit_api_usage(
  _client_id uuid,
  _query_kind text,
  _billed_amount numeric,
  _currency text DEFAULT 'XAF'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period date := date_trunc('month', now())::date;
  v_row public.credit_api_monthly_usage%ROWTYPE;
BEGIN
  INSERT INTO public.credit_api_monthly_usage
    (client_id, period_month, score_queries, report_queries, total_billed, currency)
  VALUES (
    _client_id, v_period,
    CASE WHEN _query_kind = 'score'  THEN 1 ELSE 0 END,
    CASE WHEN _query_kind = 'report' THEN 1 ELSE 0 END,
    COALESCE(_billed_amount, 0),
    _currency
  )
  ON CONFLICT (client_id, period_month) DO UPDATE SET
    score_queries  = credit_api_monthly_usage.score_queries  + (CASE WHEN _query_kind = 'score'  THEN 1 ELSE 0 END),
    report_queries = credit_api_monthly_usage.report_queries + (CASE WHEN _query_kind = 'report' THEN 1 ELSE 0 END),
    total_billed   = credit_api_monthly_usage.total_billed   + COALESCE(_billed_amount, 0),
    updated_at     = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'period_month', v_row.period_month,
    'score_queries', v_row.score_queries,
    'report_queries', v_row.report_queries,
    'total_billed', v_row.total_billed,
    'currency', v_row.currency
  );
END;
$$;

-- 10. Helper: active premium check
CREATE OR REPLACE FUNCTION public.has_crediq_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crediq_subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND current_period_end > now()
  );
$$;