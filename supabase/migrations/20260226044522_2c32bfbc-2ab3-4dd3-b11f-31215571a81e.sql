
-- ═══════════════════════════════════════════════════════════════
-- ATOMIC WALLET OPERATIONS: Wraps charge status + wallet update
-- in a single transaction to prevent race conditions
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.atomic_charge_wallet_credit(
  _charge_id UUID,
  _new_status TEXT,
  _provider_raw JSONB DEFAULT NULL,
  _merchant_id UUID DEFAULT NULL,
  _currency TEXT DEFAULT 'XAF',
  _credit_amount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  -- Step 1: Update charge status
  UPDATE gateway_charges
  SET status = _new_status,
      provider_raw = COALESCE(_provider_raw, provider_raw),
      updated_at = now()
  WHERE id = _charge_id;

  -- Step 2: Credit merchant wallet if successful and amount > 0
  IF _new_status = 'successful' AND _merchant_id IS NOT NULL AND _credit_amount > 0 THEN
    INSERT INTO gateway_merchant_wallets (merchant_id, currency, available_balance, pending_balance, ledger_balance)
    VALUES (_merchant_id, _currency, 0, _credit_amount, _credit_amount)
    ON CONFLICT (merchant_id, currency)
    DO UPDATE SET
      pending_balance = gateway_merchant_wallets.pending_balance + _credit_amount,
      ledger_balance = gateway_merchant_wallets.ledger_balance + _credit_amount,
      updated_at = now();
  END IF;

  v_result := jsonb_build_object(
    'charge_id', _charge_id,
    'status', _new_status,
    'wallet_credited', (_new_status = 'successful' AND _credit_amount > 0),
    'credit_amount', _credit_amount
  );

  RETURN v_result;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- ATOMIC REFUND WALLET DEBIT: Wraps refund status + wallet debit
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.atomic_refund_wallet_debit(
  _refund_id UUID,
  _new_status TEXT,
  _provider_raw JSONB DEFAULT NULL,
  _merchant_id UUID DEFAULT NULL,
  _currency TEXT DEFAULT 'XAF',
  _debit_amount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  -- Step 1: Update refund status
  UPDATE gateway_refunds
  SET status = _new_status,
      provider_raw = COALESCE(_provider_raw, provider_raw),
      updated_at = now()
  WHERE id = _refund_id;

  -- Step 2: Debit merchant wallet if refund successful
  IF _new_status = 'successful' AND _merchant_id IS NOT NULL AND _debit_amount > 0 THEN
    INSERT INTO gateway_merchant_wallets (merchant_id, currency, available_balance, pending_balance, ledger_balance)
    VALUES (_merchant_id, _currency, 0, 0, 0)
    ON CONFLICT (merchant_id, currency)
    DO UPDATE SET
      available_balance = gateway_merchant_wallets.available_balance - _debit_amount,
      ledger_balance = gateway_merchant_wallets.ledger_balance - _debit_amount,
      updated_at = now();
  END IF;

  v_result := jsonb_build_object(
    'refund_id', _refund_id,
    'status', _new_status,
    'wallet_debited', (_new_status = 'successful' AND _debit_amount > 0),
    'debit_amount', _debit_amount
  );

  RETURN v_result;
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- ATOMIC DISPUTE WALLET DEBIT: Wraps dispute insert + wallet debit
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.atomic_dispute_wallet_adjust(
  _merchant_id UUID,
  _currency TEXT,
  _amount NUMERIC,
  _direction TEXT DEFAULT 'debit'  -- 'debit' on creation, 'credit' on won
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_delta NUMERIC;
BEGIN
  v_delta := CASE WHEN _direction = 'debit' THEN -_amount ELSE _amount END;

  INSERT INTO gateway_merchant_wallets (merchant_id, currency, available_balance, pending_balance, ledger_balance)
  VALUES (_merchant_id, _currency, GREATEST(v_delta, 0), 0, GREATEST(v_delta, 0))
  ON CONFLICT (merchant_id, currency)
  DO UPDATE SET
    available_balance = gateway_merchant_wallets.available_balance + v_delta,
    ledger_balance = gateway_merchant_wallets.ledger_balance + v_delta,
    updated_at = now();

  RETURN jsonb_build_object(
    'merchant_id', _merchant_id,
    'currency', _currency,
    'direction', _direction,
    'amount', _amount
  );
END;
$function$;

-- ═══════════════════════════════════════════════════════════════
-- WEBHOOK RATE LIMITING: 100 req/min per provider
-- Uses existing check_rate_limit() + rate_limits table
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_webhook_rate_limit(
  _provider TEXT,
  _max_requests INTEGER DEFAULT 100,
  _window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delegate to existing rate limit infrastructure
  RETURN public.check_rate_limit(
    _provider,
    'webhook_inbound',
    _max_requests,
    _window_minutes
  );
END;
$function$;
