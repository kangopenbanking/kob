
-- =========================================================
-- BATCH 4: Product Definition & Accrual Engine (Fineract parity)
-- Additive only. Zero breaking changes.
-- =========================================================

-- ---------- 1. GL account mappings on loan_products ----------
ALTER TABLE public.loan_products
  ADD COLUMN IF NOT EXISTS gl_fund_source_account_id           uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_loan_portfolio_account_id        uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_interest_receivable_account_id   uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_interest_income_account_id       uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_fee_income_account_id            uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_penalty_income_account_id        uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_write_off_expense_account_id     uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_overpayment_liability_account_id uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS accounting_rule                     text NOT NULL DEFAULT 'none'
    CHECK (accounting_rule IN ('none','cash','accrual_periodic','accrual_upfront')),
  ADD COLUMN IF NOT EXISTS repayment_strategy                  text NOT NULL DEFAULT 'penalties_fees_interest_principal'
    CHECK (repayment_strategy IN (
      'penalties_fees_interest_principal',
      'principal_interest_penalties_fees',
      'interest_principal_penalties_fees',
      'due_date_order',
      'overdue_due_order'
    )),
  ADD COLUMN IF NOT EXISTS amortization_type                   text NOT NULL DEFAULT 'equal_installments'
    CHECK (amortization_type IN ('equal_installments','equal_principal')),
  ADD COLUMN IF NOT EXISTS grace_on_principal_periods          integer NOT NULL DEFAULT 0 CHECK (grace_on_principal_periods >= 0),
  ADD COLUMN IF NOT EXISTS grace_on_interest_periods           integer NOT NULL DEFAULT 0 CHECK (grace_on_interest_periods >= 0),
  ADD COLUMN IF NOT EXISTS grace_on_arrears_ageing_days        integer NOT NULL DEFAULT 0 CHECK (grace_on_arrears_ageing_days >= 0),
  ADD COLUMN IF NOT EXISTS days_in_year_type                   text NOT NULL DEFAULT '365'
    CHECK (days_in_year_type IN ('360','365','actual')),
  ADD COLUMN IF NOT EXISTS days_in_month_type                  text NOT NULL DEFAULT 'actual'
    CHECK (days_in_month_type IN ('30','actual'));

-- ---------- 2. GL account mappings on savings_products ----------
ALTER TABLE public.savings_products
  ADD COLUMN IF NOT EXISTS gl_savings_reference_account_id     uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_savings_control_account_id       uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_interest_on_savings_account_id   uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_interest_payable_account_id      uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_fee_income_account_id            uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_penalty_income_account_id        uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_overdraft_portfolio_account_id   uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS gl_overdraft_interest_income_id     uuid REFERENCES public.ledger_accounts(id),
  ADD COLUMN IF NOT EXISTS accounting_rule                     text NOT NULL DEFAULT 'none'
    CHECK (accounting_rule IN ('none','cash','accrual_periodic'));

-- ---------- 3. Product Charges (Fineract-style) ----------
CREATE TABLE IF NOT EXISTS public.product_charges (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid,
  charge_code           text NOT NULL,
  charge_name           text NOT NULL,
  applies_to            text NOT NULL CHECK (applies_to IN ('loan','savings','client')),
  charge_time_type      text NOT NULL CHECK (charge_time_type IN (
    'disbursement','specified_due_date','installment_fee',
    'overdue_installment','savings_activation','withdrawal_fee',
    'annual_fee','monthly_fee','deposit_fee'
  )),
  charge_calculation_type text NOT NULL CHECK (charge_calculation_type IN (
    'flat','percent_of_amount','percent_of_amount_and_interest',
    'percent_of_interest','percent_of_installment'
  )),
  amount                numeric(20,4) NOT NULL CHECK (amount >= 0),
  currency              text NOT NULL DEFAULT 'XAF',
  is_penalty            boolean NOT NULL DEFAULT false,
  is_active             boolean NOT NULL DEFAULT true,
  gl_income_account_id  uuid REFERENCES public.ledger_accounts(id),
  min_cap               numeric(20,4),
  max_cap               numeric(20,4),
  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, charge_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_charges TO authenticated;
GRANT ALL ON public.product_charges TO service_role;
ALTER TABLE public.product_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all product_charges"
  ON public.product_charges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Institution staff view own product_charges"
  ON public.product_charges FOR SELECT TO authenticated
  USING (
    institution_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments s
      WHERE s.user_id = auth.uid() AND s.institution_id = product_charges.institution_id
    )
  );

CREATE INDEX IF NOT EXISTS product_charges_inst_idx ON public.product_charges (institution_id, applies_to, is_active);

-- ---------- 4. Link tables product ↔ charges ----------
CREATE TABLE IF NOT EXISTS public.loan_product_charges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_product_id  uuid NOT NULL REFERENCES public.loan_products(id) ON DELETE CASCADE,
  charge_id        uuid NOT NULL REFERENCES public.product_charges(id) ON DELETE RESTRICT,
  is_mandatory     boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_product_id, charge_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_product_charges TO authenticated;
GRANT ALL ON public.loan_product_charges TO service_role;
ALTER TABLE public.loan_product_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage loan_product_charges"
  ON public.loan_product_charges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view loan_product_charges"
  ON public.loan_product_charges FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.savings_product_charges (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_product_id  uuid NOT NULL REFERENCES public.savings_products(id) ON DELETE CASCADE,
  charge_id           uuid NOT NULL REFERENCES public.product_charges(id) ON DELETE RESTRICT,
  is_mandatory        boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (savings_product_id, charge_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_product_charges TO authenticated;
GRANT ALL ON public.savings_product_charges TO service_role;
ALTER TABLE public.savings_product_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage savings_product_charges"
  ON public.savings_product_charges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated view savings_product_charges"
  ON public.savings_product_charges FOR SELECT TO authenticated USING (true);

-- ---------- 5. Accrual Runs (interest accrual job tracker) ----------
CREATE TABLE IF NOT EXISTS public.accrual_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id        uuid,
  run_type              text NOT NULL CHECK (run_type IN ('loan_interest','loan_penalty','savings_interest','fee')),
  accrual_date          date NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','partial')),
  accounts_processed    integer NOT NULL DEFAULT 0,
  accounts_failed       integer NOT NULL DEFAULT 0,
  total_accrued         numeric(20,4) NOT NULL DEFAULT 0,
  currency              text NOT NULL DEFAULT 'XAF',
  journal_entry_ids     uuid[] NOT NULL DEFAULT '{}',
  idempotency_key       text NOT NULL,
  error_message         text,
  started_at            timestamptz,
  completed_at          timestamptz,
  triggered_by          uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, run_type, accrual_date, idempotency_key)
);

GRANT SELECT, INSERT, UPDATE ON public.accrual_runs TO authenticated;
GRANT ALL ON public.accrual_runs TO service_role;
ALTER TABLE public.accrual_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all accrual_runs"
  ON public.accrual_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Institution staff view own accrual_runs"
  ON public.accrual_runs FOR SELECT TO authenticated
  USING (
    institution_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments s
      WHERE s.user_id = auth.uid() AND s.institution_id = accrual_runs.institution_id
    )
  );

CREATE INDEX IF NOT EXISTS accrual_runs_date_idx ON public.accrual_runs (accrual_date DESC, run_type, status);

-- ---------- 6. Timestamp update triggers ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_product_charges_updated_at ON public.product_charges;
CREATE TRIGGER trg_product_charges_updated_at
  BEFORE UPDATE ON public.product_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_accrual_runs_updated_at ON public.accrual_runs;
CREATE TRIGGER trg_accrual_runs_updated_at
  BEFORE UPDATE ON public.accrual_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 7. Guard: GL accounts required when accounting_rule is set ----------
CREATE OR REPLACE FUNCTION public.enforce_loan_product_gl_mapping()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.accounting_rule IN ('cash','accrual_periodic','accrual_upfront') THEN
    IF NEW.gl_fund_source_account_id IS NULL
       OR NEW.gl_loan_portfolio_account_id IS NULL
       OR NEW.gl_interest_income_account_id IS NULL THEN
      RAISE EXCEPTION 'loan_products (%): fund_source, loan_portfolio, and interest_income GL accounts are required when accounting_rule=%',
        NEW.id, NEW.accounting_rule USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.accounting_rule IN ('accrual_periodic','accrual_upfront')
       AND NEW.gl_interest_receivable_account_id IS NULL THEN
      RAISE EXCEPTION 'loan_products (%): interest_receivable GL account required for accrual accounting',
        NEW.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_products_gl ON public.loan_products;
CREATE TRIGGER trg_loan_products_gl
  BEFORE INSERT OR UPDATE ON public.loan_products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_loan_product_gl_mapping();

CREATE OR REPLACE FUNCTION public.enforce_savings_product_gl_mapping()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.accounting_rule IN ('cash','accrual_periodic') THEN
    IF NEW.gl_savings_reference_account_id IS NULL
       OR NEW.gl_savings_control_account_id IS NULL
       OR NEW.gl_interest_on_savings_account_id IS NULL THEN
      RAISE EXCEPTION 'savings_products (%): savings_reference, savings_control, and interest_on_savings GL accounts are required when accounting_rule=%',
        NEW.id, NEW.accounting_rule USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.accounting_rule = 'accrual_periodic'
       AND NEW.gl_interest_payable_account_id IS NULL THEN
      RAISE EXCEPTION 'savings_products (%): interest_payable GL account required for accrual accounting',
        NEW.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_savings_products_gl ON public.savings_products;
CREATE TRIGGER trg_savings_products_gl
  BEFORE INSERT OR UPDATE ON public.savings_products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_savings_product_gl_mapping();
