
-- ============================================================================
-- Nium Integration — Foundation Migration (Step 1 of 9)
-- Additive only (Standing Order 4). Existing rows preserved.
-- ============================================================================

-- 1) Expand currency check on nium_global_accounts to 17 currencies
ALTER TABLE public.nium_global_accounts
  DROP CONSTRAINT IF EXISTS nium_global_accounts_currency_check;

ALTER TABLE public.nium_global_accounts
  ADD CONSTRAINT nium_global_accounts_currency_check
  CHECK (currency = ANY (ARRAY[
    'USD','EUR','GBP','AUD','CAD','SGD','AED','JPY','INR',
    'ZAR','HKD','CHF','NZD','SEK','NOK','DKK','CNY'
  ]));

-- 2) Split Virtual vs Global accounts (kind column, default 'virtual')
ALTER TABLE public.nium_global_accounts
  ADD COLUMN IF NOT EXISTS account_kind text NOT NULL DEFAULT 'virtual';

ALTER TABLE public.nium_global_accounts
  DROP CONSTRAINT IF EXISTS nium_global_accounts_account_kind_check;

ALTER TABLE public.nium_global_accounts
  ADD CONSTRAINT nium_global_accounts_account_kind_check
  CHECK (account_kind = ANY (ARRAY['virtual','global']));

CREATE INDEX IF NOT EXISTS idx_nium_global_accounts_kind
  ON public.nium_global_accounts (account_kind);

-- 3) Generic updated_at trigger helper (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4) nium_beneficiaries
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.nium_beneficiaries (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nium_beneficiary_hash_id    text UNIQUE,
  beneficiary_name            text NOT NULL,
  beneficiary_account_number  text NOT NULL,
  beneficiary_bank_name       text,
  beneficiary_bank_code       text,
  beneficiary_country         text NOT NULL,
  destination_currency        text NOT NULL,
  routing_type                text NOT NULL DEFAULT 'SWIFT',
  verification_status         text NOT NULL DEFAULT 'pending',
  mode                        text NOT NULL DEFAULT 'stub',
  metadata                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nium_beneficiaries_currency_check CHECK (destination_currency = ANY (ARRAY[
    'USD','EUR','GBP','AUD','CAD','SGD','AED','JPY','INR',
    'ZAR','HKD','CHF','NZD','SEK','NOK','DKK','CNY','XAF'
  ])),
  CONSTRAINT nium_beneficiaries_verification_status_check
    CHECK (verification_status = ANY (ARRAY['pending','verified','rejected'])),
  CONSTRAINT nium_beneficiaries_mode_check
    CHECK (mode = ANY (ARRAY['stub','sandbox','live']))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nium_beneficiaries TO authenticated;
GRANT ALL ON public.nium_beneficiaries TO service_role;
ALTER TABLE public.nium_beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own beneficiaries"
  ON public.nium_beneficiaries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own beneficiaries"
  ON public.nium_beneficiaries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own beneficiaries"
  ON public.nium_beneficiaries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins manage beneficiaries"
  ON public.nium_beneficiaries FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_officer'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_officer'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_nium_beneficiaries_user ON public.nium_beneficiaries (user_id);
CREATE INDEX IF NOT EXISTS idx_nium_beneficiaries_currency ON public.nium_beneficiaries (destination_currency);

CREATE TRIGGER trg_nium_beneficiaries_updated_at
  BEFORE UPDATE ON public.nium_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5) nium_payouts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.nium_payouts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beneficiary_id           uuid NOT NULL REFERENCES public.nium_beneficiaries(id) ON DELETE RESTRICT,
  source_account_id        uuid REFERENCES public.nium_global_accounts(id) ON DELETE RESTRICT,
  nium_transfer_id         text UNIQUE,
  idempotency_key          uuid NOT NULL UNIQUE,
  source_currency          text NOT NULL,
  source_amount            numeric(20,2) NOT NULL CHECK (source_amount > 0),
  destination_currency     text NOT NULL,
  destination_amount       numeric(20,2),
  fx_rate                  numeric(20,8),
  fx_spread_bps            integer,
  pop_code                 text NOT NULL DEFAULT 'Software/Digital Services',
  purpose_description      text,
  status                   text NOT NULL DEFAULT 'pending',
  failure_reason           text,
  mode                     text NOT NULL DEFAULT 'stub',
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at             timestamptz,
  completed_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nium_payouts_source_currency_check CHECK (source_currency = ANY (ARRAY[
    'USD','EUR','GBP','AUD','CAD','SGD','AED','JPY','INR',
    'ZAR','HKD','CHF','NZD','SEK','NOK','DKK','CNY','XAF'
  ])),
  CONSTRAINT nium_payouts_destination_currency_check CHECK (destination_currency = ANY (ARRAY[
    'USD','EUR','GBP','AUD','CAD','SGD','AED','JPY','INR',
    'ZAR','HKD','CHF','NZD','SEK','NOK','DKK','CNY','XAF'
  ])),
  CONSTRAINT nium_payouts_status_check CHECK (status = ANY (ARRAY[
    'pending','submitted','processing','completed','failed','cancelled','returned'
  ])),
  CONSTRAINT nium_payouts_pop_code_check
    CHECK (pop_code = ANY (ARRAY['Software/Digital Services','Royalties'])),
  CONSTRAINT nium_payouts_mode_check
    CHECK (mode = ANY (ARRAY['stub','sandbox','live']))
);

GRANT SELECT, INSERT, UPDATE ON public.nium_payouts TO authenticated;
GRANT ALL ON public.nium_payouts TO service_role;
ALTER TABLE public.nium_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payouts"
  ON public.nium_payouts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own payouts"
  ON public.nium_payouts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage payouts"
  ON public.nium_payouts FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_officer'::app_role)
    OR public.has_role(auth.uid(), 'support_agent'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_officer'::app_role)
    OR public.has_role(auth.uid(), 'support_agent'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_nium_payouts_user ON public.nium_payouts (user_id);
CREATE INDEX IF NOT EXISTS idx_nium_payouts_status ON public.nium_payouts (status);
CREATE INDEX IF NOT EXISTS idx_nium_payouts_created ON public.nium_payouts (created_at DESC);

CREATE TRIGGER trg_nium_payouts_updated_at
  BEFORE UPDATE ON public.nium_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 6) nium_conversions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.nium_conversions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_account_id        uuid REFERENCES public.nium_global_accounts(id) ON DELETE RESTRICT,
  nium_conversion_id       text UNIQUE,
  idempotency_key          uuid NOT NULL UNIQUE,
  source_currency          text NOT NULL,
  source_amount            numeric(20,2) NOT NULL CHECK (source_amount > 0),
  destination_currency     text NOT NULL,
  destination_amount       numeric(20,2),
  fx_rate                  numeric(20,8),
  fx_spread_bps            integer,
  status                   text NOT NULL DEFAULT 'pending',
  failure_reason           text,
  mode                     text NOT NULL DEFAULT 'stub',
  metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nium_conversions_source_currency_check CHECK (source_currency = ANY (ARRAY[
    'USD','EUR','GBP','AUD','CAD','SGD','AED','JPY','INR',
    'ZAR','HKD','CHF','NZD','SEK','NOK','DKK','CNY','XAF'
  ])),
  CONSTRAINT nium_conversions_destination_currency_check CHECK (destination_currency = ANY (ARRAY[
    'USD','EUR','GBP','AUD','CAD','SGD','AED','JPY','INR',
    'ZAR','HKD','CHF','NZD','SEK','NOK','DKK','CNY','XAF'
  ])),
  CONSTRAINT nium_conversions_status_check CHECK (status = ANY (ARRAY[
    'pending','completed','failed','cancelled'
  ])),
  CONSTRAINT nium_conversions_mode_check
    CHECK (mode = ANY (ARRAY['stub','sandbox','live']))
);

GRANT SELECT, INSERT, UPDATE ON public.nium_conversions TO authenticated;
GRANT ALL ON public.nium_conversions TO service_role;
ALTER TABLE public.nium_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversions"
  ON public.nium_conversions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversions"
  ON public.nium_conversions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage conversions"
  ON public.nium_conversions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_officer'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_officer'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_nium_conversions_user ON public.nium_conversions (user_id);
CREATE INDEX IF NOT EXISTS idx_nium_conversions_status ON public.nium_conversions (status);

CREATE TRIGGER trg_nium_conversions_updated_at
  BEFORE UPDATE ON public.nium_conversions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 7) nium_rfi (Request For Information / KYC remediation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.nium_rfi (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nium_rfi_id         text UNIQUE,
  subject_type        text NOT NULL,
  subject_reference   text,
  rfi_reason          text NOT NULL,
  rfi_details         text,
  status              text NOT NULL DEFAULT 'open',
  due_by              timestamptz,
  responded_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  response_payload    jsonb,
  responded_at        timestamptz,
  resolved_at         timestamptz,
  mode                text NOT NULL DEFAULT 'stub',
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nium_rfi_subject_type_check CHECK (subject_type = ANY (ARRAY[
    'customer','beneficiary','payout','conversion','account'
  ])),
  CONSTRAINT nium_rfi_status_check CHECK (status = ANY (ARRAY[
    'open','responded','resolved','rejected','cancelled'
  ])),
  CONSTRAINT nium_rfi_mode_check
    CHECK (mode = ANY (ARRAY['stub','sandbox','live']))
);

GRANT SELECT ON public.nium_rfi TO authenticated;
GRANT ALL ON public.nium_rfi TO service_role;
ALTER TABLE public.nium_rfi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rfi"
  ON public.nium_rfi FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins manage rfi"
  ON public.nium_rfi FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_officer'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'compliance_officer'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_nium_rfi_user ON public.nium_rfi (user_id);
CREATE INDEX IF NOT EXISTS idx_nium_rfi_status ON public.nium_rfi (status);
CREATE INDEX IF NOT EXISTS idx_nium_rfi_due ON public.nium_rfi (due_by);

CREATE TRIGGER trg_nium_rfi_updated_at
  BEFORE UPDATE ON public.nium_rfi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
