
-- ============================================================
-- BATCH 5: Cross-Module Ledger Bridge (Gateway ↔ Ledger)
-- ============================================================

-- 1. Seed default GL accounts for gateway ops (institution-agnostic)
INSERT INTO public.ledger_accounts (account_code, account_name, account_type, account_class, normal_balance, currency, description)
VALUES
  ('1020', 'Gateway Suspense',           'asset',     'ASSET'::ledger_account_class,     'D', 'XAF', 'In-flight gateway funds pending settlement'),
  ('2300', 'Merchant Payable Balances',  'liability', 'LIABILITY'::ledger_account_class, 'C', 'XAF', 'Amounts owed to merchants (unpaid balances)'),
  ('2400', 'Gateway Refunds Payable',    'liability', 'LIABILITY'::ledger_account_class, 'C', 'XAF', 'Refund obligations to end customers'),
  ('4110', 'Gateway Fee Income',         'revenue',   'INCOME'::ledger_account_class,    'C', 'XAF', 'Platform fee income from gateway charges'),
  ('5110', 'Gateway Processing Costs',   'expense',   'EXPENSE'::ledger_account_class,   'D', 'XAF', 'Provider-side processing costs (PSP fees)')
ON CONFLICT (account_code) DO NOTHING;

-- 2. Helper: resolve default CoA account by code
CREATE OR REPLACE FUNCTION public.gw_ledger_account(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.ledger_accounts
   WHERE account_code = _code AND institution_id IS NULL
   ORDER BY created_at ASC
   LIMIT 1
$$;

-- 3. Core balanced-posting helper (idempotent via ledger_posting_refs)
CREATE OR REPLACE FUNCTION public.gw_post_journal(
  _reference_type text,
  _reference_id   text,
  _description    text,
  _lines          jsonb,
  _metadata       jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_entry_no text;
  v_line     jsonb;
  v_acct_id  uuid;
  v_existing uuid;
  v_total_dr numeric := 0;
  v_total_cr numeric := 0;
BEGIN
  SELECT journal_entry_id INTO v_existing
    FROM public.ledger_posting_refs
   WHERE reference_type = _reference_type
     AND reference_id   = _reference_id
     AND domain         = 'gateway'
   LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_total_dr := v_total_dr + COALESCE((v_line->>'debit')::numeric,  0);
    v_total_cr := v_total_cr + COALESCE((v_line->>'credit')::numeric, 0);
  END LOOP;

  IF v_total_dr <> v_total_cr OR v_total_dr = 0 THEN
    RAISE EXCEPTION 'gw_post_journal: unbalanced entry (dr=%, cr=%)', v_total_dr, v_total_cr;
  END IF;

  v_entry_no := 'GW-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference_type, reference_id, idempotency_key, metadata)
  VALUES (v_entry_no, CURRENT_DATE, _description, _reference_type,
          NULLIF(_reference_id,'')::uuid,
          'gw:' || _reference_type || ':' || _reference_id,
          _metadata)
  RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    v_acct_id := public.gw_ledger_account(v_line->>'account_code');
    IF v_acct_id IS NULL THEN
      RAISE EXCEPTION 'gw_post_journal: unknown ledger account code %', v_line->>'account_code';
    END IF;
    INSERT INTO public.journal_lines (journal_entry_id, ledger_account_id, debit, credit)
    VALUES (v_entry_id, v_acct_id,
            COALESCE((v_line->>'debit')::numeric,  0),
            COALESCE((v_line->>'credit')::numeric, 0));
  END LOOP;

  INSERT INTO public.ledger_posting_refs (reference_type, reference_id, domain, journal_entry_id, idempotency_key)
  VALUES (_reference_type, _reference_id, 'gateway', v_entry_id, 'gw:' || _reference_type || ':' || _reference_id);

  RETURN v_entry_id;
END;
$$;

-- 4. Reversal helper
CREATE OR REPLACE FUNCTION public.gw_reverse_journal(
  _reference_type text,
  _reference_id   text,
  _reason         text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original uuid;
  v_reversal uuid;
  v_entry_no text;
  v_key      text := 'gw-rev:' || _reference_type || ':' || _reference_id;
  v_existing uuid;
BEGIN
  SELECT journal_entry_id INTO v_original
    FROM public.ledger_posting_refs
   WHERE reference_type = _reference_type
     AND reference_id   = _reference_id
     AND domain         = 'gateway'
   LIMIT 1;
  IF v_original IS NULL THEN RETURN NULL; END IF;

  SELECT journal_entry_id INTO v_existing
    FROM public.ledger_posting_refs
   WHERE reference_type = _reference_type || '.reversal'
     AND reference_id   = _reference_id
     AND domain         = 'gateway'
   LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_entry_no := 'GW-REV-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference_type, reference_id, reversal_of, idempotency_key, metadata)
  VALUES (v_entry_no, CURRENT_DATE, 'Reversal: ' || _reason,
          _reference_type || '.reversal', NULLIF(_reference_id,'')::uuid, v_original,
          v_key, jsonb_build_object('reversal_of', v_original, 'reason', _reason))
  RETURNING id INTO v_reversal;

  INSERT INTO public.journal_lines (journal_entry_id, ledger_account_id, debit, credit)
  SELECT v_reversal, ledger_account_id, credit, debit
    FROM public.journal_lines
   WHERE journal_entry_id = v_original;

  INSERT INTO public.ledger_posting_refs (reference_type, reference_id, domain, journal_entry_id, idempotency_key)
  VALUES (_reference_type || '.reversal', _reference_id, 'gateway', v_reversal, v_key);

  RETURN v_reversal;
END;
$$;

-- 5. Domain posters
CREATE OR REPLACE FUNCTION public.gw_post_charge_success(_charge_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD; v_lines jsonb; v_fee numeric; v_net numeric;
BEGIN
  SELECT id, amount, fee_amount, net_amount, merchant_id, currency, provider, tx_ref
    INTO c FROM public.gateway_charges WHERE id = _charge_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_fee := COALESCE(c.fee_amount, 0);
  v_net := COALESCE(c.net_amount, c.amount - v_fee);

  IF v_fee = 0 THEN
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code','1020','debit', c.amount, 'credit', 0),
      jsonb_build_object('account_code','2300','debit', 0,        'credit', c.amount)
    );
  ELSE
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code','1020','debit', c.amount, 'credit', 0),
      jsonb_build_object('account_code','2300','debit', 0,        'credit', v_net),
      jsonb_build_object('account_code','4110','debit', 0,        'credit', v_fee)
    );
  END IF;

  RETURN public.gw_post_journal(
    'gateway_charge', c.id::text,
    format('Gateway charge %s (%s %s) via %s', c.tx_ref, c.amount, c.currency, c.provider),
    v_lines,
    jsonb_build_object('merchant_id', c.merchant_id, 'currency', c.currency, 'provider', c.provider, 'tx_ref', c.tx_ref)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.gw_post_refund_success(_refund_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  SELECT id, amount, currency, merchant_id, charge_id, provider
    INTO r FROM public.gateway_refunds WHERE id = _refund_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN public.gw_post_journal(
    'gateway_refund', r.id::text,
    format('Refund %s of charge %s (%s %s)', r.id, r.charge_id, r.amount, r.currency),
    jsonb_build_array(
      jsonb_build_object('account_code','2300','debit', r.amount, 'credit', 0),
      jsonb_build_object('account_code','1020','debit', 0,        'credit', r.amount)
    ),
    jsonb_build_object('merchant_id', r.merchant_id, 'charge_id', r.charge_id, 'provider', r.provider)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.gw_post_payout_success(_payout_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p RECORD; v_lines jsonb; v_fee numeric;
BEGIN
  SELECT id, amount, fee_amount, currency, merchant_id, provider, tx_ref
    INTO p FROM public.gateway_payouts WHERE id = _payout_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_fee := COALESCE(p.fee_amount, 0);

  IF v_fee = 0 THEN
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code','2300','debit', p.amount, 'credit', 0),
      jsonb_build_object('account_code','1000','debit', 0,        'credit', p.amount)
    );
  ELSE
    v_lines := jsonb_build_array(
      jsonb_build_object('account_code','2300','debit', p.amount,         'credit', 0),
      jsonb_build_object('account_code','1000','debit', 0,                'credit', p.amount - v_fee),
      jsonb_build_object('account_code','4110','debit', 0,                'credit', v_fee)
    );
  END IF;

  RETURN public.gw_post_journal(
    'gateway_payout', p.id::text,
    format('Payout %s (%s %s) via %s', p.tx_ref, p.amount, p.currency, p.provider),
    v_lines,
    jsonb_build_object('merchant_id', p.merchant_id, 'currency', p.currency, 'provider', p.provider, 'tx_ref', p.tx_ref)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.gw_post_settlement_success(_settlement_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s RECORD;
BEGIN
  SELECT id, merchant_id, amount, fees_total, net_amount, currency
    INTO s FROM public.gateway_settlements WHERE id = _settlement_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN public.gw_post_journal(
    'gateway_settlement', s.id::text,
    format('Settlement %s (%s %s)', s.id, s.amount, s.currency),
    jsonb_build_array(
      jsonb_build_object('account_code','1000','debit', s.amount, 'credit', 0),
      jsonb_build_object('account_code','1020','debit', 0,        'credit', s.amount)
    ),
    jsonb_build_object('merchant_id', s.merchant_id, 'currency', s.currency, 'net_amount', s.net_amount, 'fees_total', s.fees_total)
  );
END; $$;

-- 6. Bridge triggers
CREATE OR REPLACE FUNCTION public.trg_gateway_charge_ledger_bridge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('successful','completed','succeeded','captured') THEN
      PERFORM public.gw_post_charge_success(NEW.id);
    ELSIF NEW.status IN ('reversed','refunded','failed','voided')
      AND OLD.status IN ('successful','completed','succeeded','captured') THEN
      PERFORM public.gw_reverse_journal('gateway_charge', NEW.id::text, 'charge status → ' || NEW.status);
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.status IN ('successful','completed','succeeded','captured') THEN
    PERFORM public.gw_post_charge_success(NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_gateway_charge_ledger_bridge ON public.gateway_charges;
CREATE TRIGGER trg_gateway_charge_ledger_bridge
AFTER INSERT OR UPDATE OF status ON public.gateway_charges
FOR EACH ROW EXECUTE FUNCTION public.trg_gateway_charge_ledger_bridge();

CREATE OR REPLACE FUNCTION public.trg_gateway_refund_ledger_bridge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('successful','completed','succeeded','refunded') THEN
      PERFORM public.gw_post_refund_success(NEW.id);
    ELSIF NEW.status IN ('reversed','failed')
      AND OLD.status IN ('successful','completed','succeeded','refunded') THEN
      PERFORM public.gw_reverse_journal('gateway_refund', NEW.id::text, 'refund status → ' || NEW.status);
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.status IN ('successful','completed','succeeded','refunded') THEN
    PERFORM public.gw_post_refund_success(NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_gateway_refund_ledger_bridge ON public.gateway_refunds;
CREATE TRIGGER trg_gateway_refund_ledger_bridge
AFTER INSERT OR UPDATE OF status ON public.gateway_refunds
FOR EACH ROW EXECUTE FUNCTION public.trg_gateway_refund_ledger_bridge();

CREATE OR REPLACE FUNCTION public.trg_gateway_payout_ledger_bridge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('successful','completed','succeeded','paid') THEN
      PERFORM public.gw_post_payout_success(NEW.id);
    ELSIF NEW.status IN ('reversed','failed','returned')
      AND OLD.status IN ('successful','completed','succeeded','paid') THEN
      PERFORM public.gw_reverse_journal('gateway_payout', NEW.id::text, 'payout status → ' || NEW.status);
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.status IN ('successful','completed','succeeded','paid') THEN
    PERFORM public.gw_post_payout_success(NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_gateway_payout_ledger_bridge ON public.gateway_payouts;
CREATE TRIGGER trg_gateway_payout_ledger_bridge
AFTER INSERT OR UPDATE OF status ON public.gateway_payouts
FOR EACH ROW EXECUTE FUNCTION public.trg_gateway_payout_ledger_bridge();

CREATE OR REPLACE FUNCTION public.trg_gateway_settlement_ledger_bridge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('settled','completed','successful','paid') THEN
      PERFORM public.gw_post_settlement_success(NEW.id);
    ELSIF NEW.status IN ('reversed','failed')
      AND OLD.status IN ('settled','completed','successful','paid') THEN
      PERFORM public.gw_reverse_journal('gateway_settlement', NEW.id::text, 'settlement status → ' || NEW.status);
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.status IN ('settled','completed','successful','paid') THEN
    PERFORM public.gw_post_settlement_success(NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_gateway_settlement_ledger_bridge ON public.gateway_settlements;
CREATE TRIGGER trg_gateway_settlement_ledger_bridge
AFTER INSERT OR UPDATE OF status ON public.gateway_settlements
FOR EACH ROW EXECUTE FUNCTION public.trg_gateway_settlement_ledger_bridge();

-- 7. Reconciliation view
CREATE OR REPLACE VIEW public.v_gateway_ledger_bridge AS
SELECT
  r.reference_type,
  r.reference_id,
  r.domain,
  r.journal_entry_id,
  je.entry_number,
  je.entry_date,
  je.is_reversed,
  je.description,
  r.created_at AS posted_at
FROM public.ledger_posting_refs r
LEFT JOIN public.journal_entries je ON je.id = r.journal_entry_id
WHERE r.domain = 'gateway';

REVOKE ALL ON public.v_gateway_ledger_bridge FROM PUBLIC;
GRANT SELECT ON public.v_gateway_ledger_bridge TO authenticated, service_role;

-- 8. Function grants
GRANT EXECUTE ON FUNCTION public.gw_ledger_account(text)                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gw_post_journal(text,text,text,jsonb,jsonb)   TO service_role;
GRANT EXECUTE ON FUNCTION public.gw_reverse_journal(text,text,text)            TO service_role;
GRANT EXECUTE ON FUNCTION public.gw_post_charge_success(uuid)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.gw_post_refund_success(uuid)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.gw_post_payout_success(uuid)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.gw_post_settlement_success(uuid)              TO service_role;
