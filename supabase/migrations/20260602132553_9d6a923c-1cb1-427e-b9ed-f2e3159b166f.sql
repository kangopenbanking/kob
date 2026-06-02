
-- Link orders to the escrow wallet that holds their funds
ALTER TABLE public.daily_needs_orders
  ADD COLUMN IF NOT EXISTS escrow_wallet_id uuid REFERENCES public.escrow_wallets(id),
  ADD COLUMN IF NOT EXISTS escrow_funded_at timestamptz,
  ADD COLUMN IF NOT EXISTS escrow_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS escrow_refunded_at timestamptz;

-- Helper: find or create the Daily Needs escrow wallet for a merchant
CREATE OR REPLACE FUNCTION public.dn_get_or_create_escrow_wallet(_merchant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_id uuid;
  _parent_account_id uuid;
BEGIN
  SELECT id INTO _wallet_id
  FROM public.escrow_wallets
  WHERE merchant_id = _merchant_id
    AND escrow_label = 'daily_needs'
    AND status = 'active'
  LIMIT 1;

  IF _wallet_id IS NOT NULL THEN
    RETURN _wallet_id;
  END IF;

  -- Find a parent account for this merchant's owning user (any active KANG- account)
  SELECT a.id INTO _parent_account_id
  FROM public.accounts a
  JOIN public.gateway_merchants gm ON gm.user_id = a.user_id
  WHERE gm.id = _merchant_id
    AND a.is_active = true
    AND a.account_id LIKE 'KANG-%'
  ORDER BY a.created_at ASC
  LIMIT 1;

  IF _parent_account_id IS NULL THEN
    RAISE EXCEPTION 'no_parent_wallet_for_merchant';
  END IF;

  INSERT INTO public.escrow_wallets (merchant_id, parent_wallet_id, escrow_label, currency)
  VALUES (_merchant_id, _parent_account_id, 'daily_needs', 'XAF')
  RETURNING id INTO _wallet_id;

  RETURN _wallet_id;
END;
$$;

-- Fund escrow on order creation
CREATE OR REPLACE FUNCTION public.dn_escrow_fund(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.daily_needs_orders%ROWTYPE;
  _merchant_id uuid;
  _wallet_id uuid;
BEGIN
  SELECT * INTO _order FROM public.daily_needs_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _order.escrow_wallet_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'replayed', true, 'escrow_wallet_id', _order.escrow_wallet_id);
  END IF;

  SELECT merchant_id INTO _merchant_id FROM public.daily_needs_stores WHERE id = _order.store_id;
  _wallet_id := public.dn_get_or_create_escrow_wallet(_merchant_id);

  PERFORM 1 FROM public.escrow_wallets WHERE id = _wallet_id FOR UPDATE;

  UPDATE public.escrow_wallets
  SET held_amount = held_amount + _order.total_xaf,
      updated_at = now()
  WHERE id = _wallet_id;

  INSERT INTO public.escrow_transactions (escrow_wallet_id, transaction_type, amount, currency, reference, description, metadata)
  VALUES (_wallet_id, 'fund', _order.total_xaf, _order.currency,
          'dn_order:' || _order.id::text,
          'Daily Needs order funded',
          jsonb_build_object('order_id', _order.id));

  UPDATE public.daily_needs_orders
  SET escrow_wallet_id = _wallet_id,
      escrow_status = 'held',
      escrow_funded_at = now(),
      updated_at = now()
  WHERE id = _order_id;

  RETURN jsonb_build_object('ok', true, 'escrow_wallet_id', _wallet_id);
END;
$$;

-- Release escrow on delivered
CREATE OR REPLACE FUNCTION public.dn_escrow_release(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.daily_needs_orders%ROWTYPE;
  _merchant_id uuid;
BEGIN
  SELECT * INTO _order FROM public.daily_needs_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _order.escrow_status = 'released' THEN
    RETURN jsonb_build_object('ok', true, 'replayed', true);
  END IF;
  IF _order.escrow_wallet_id IS NULL OR _order.escrow_status <> 'held' THEN
    RAISE EXCEPTION 'escrow_not_held';
  END IF;

  PERFORM 1 FROM public.escrow_wallets WHERE id = _order.escrow_wallet_id FOR UPDATE;

  UPDATE public.escrow_wallets
  SET held_amount = held_amount - _order.total_xaf,
      released_amount = released_amount + _order.total_xaf,
      updated_at = now()
  WHERE id = _order.escrow_wallet_id;

  SELECT merchant_id INTO _merchant_id FROM public.daily_needs_stores WHERE id = _order.store_id;

  -- Credit merchant's available wallet balance (create row if missing)
  INSERT INTO public.gateway_merchant_wallets (merchant_id, currency, available_balance, ledger_balance)
  VALUES (_merchant_id, _order.currency, _order.total_xaf, _order.total_xaf)
  ON CONFLICT (merchant_id, currency) DO UPDATE
  SET available_balance = public.gateway_merchant_wallets.available_balance + EXCLUDED.available_balance,
      ledger_balance    = public.gateway_merchant_wallets.ledger_balance + EXCLUDED.ledger_balance,
      updated_at = now();

  INSERT INTO public.escrow_transactions (escrow_wallet_id, transaction_type, amount, currency, reference, description, metadata)
  VALUES (_order.escrow_wallet_id, 'release', _order.total_xaf, _order.currency,
          'dn_order:' || _order.id::text,
          'Daily Needs order released on delivery',
          jsonb_build_object('order_id', _order.id, 'merchant_id', _merchant_id));

  UPDATE public.daily_needs_orders
  SET escrow_status = 'released',
      escrow_released_at = now(),
      updated_at = now()
  WHERE id = _order_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Refund escrow on cancellation / refund
CREATE OR REPLACE FUNCTION public.dn_escrow_refund(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.daily_needs_orders%ROWTYPE;
BEGIN
  SELECT * INTO _order FROM public.daily_needs_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF _order.escrow_status = 'refunded' THEN
    RETURN jsonb_build_object('ok', true, 'replayed', true);
  END IF;
  IF _order.escrow_wallet_id IS NULL OR _order.escrow_status <> 'held' THEN
    -- Nothing to refund (never funded or already released)
    UPDATE public.daily_needs_orders
    SET escrow_status = 'refunded', escrow_refunded_at = now(), updated_at = now()
    WHERE id = _order_id;
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;

  PERFORM 1 FROM public.escrow_wallets WHERE id = _order.escrow_wallet_id FOR UPDATE;

  UPDATE public.escrow_wallets
  SET held_amount = held_amount - _order.total_xaf,
      refunded_amount = refunded_amount + _order.total_xaf,
      updated_at = now()
  WHERE id = _order.escrow_wallet_id;

  INSERT INTO public.escrow_transactions (escrow_wallet_id, transaction_type, amount, currency, reference, description, metadata)
  VALUES (_order.escrow_wallet_id, 'refund', _order.total_xaf, _order.currency,
          'dn_order:' || _order.id::text,
          'Daily Needs order refunded',
          jsonb_build_object('order_id', _order.id, 'user_id', _order.user_id));

  UPDATE public.daily_needs_orders
  SET escrow_status = 'refunded',
      escrow_refunded_at = now(),
      updated_at = now()
  WHERE id = _order_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dn_get_or_create_escrow_wallet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.dn_escrow_fund(uuid)    TO service_role;
GRANT EXECUTE ON FUNCTION public.dn_escrow_release(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.dn_escrow_refund(uuid)  TO service_role;
