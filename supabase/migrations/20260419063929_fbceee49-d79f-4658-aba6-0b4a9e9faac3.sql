-- 1) Allow new travel fee types
ALTER TABLE public.fee_structures DROP CONSTRAINT IF EXISTS fee_structures_transaction_type_check;
ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_transaction_type_check
  CHECK (transaction_type = ANY (ARRAY[
    'transfer','payment','bill_payment','mobile_money_transfer','mobile_money_charge','withdrawal','deposit',
    'piggybank','njangi','rent','international_transfer','card_payment','p2p','cashout','bank_transfer',
    'ussd_payment','account_funding','paypal_payment','virtual_card_topup','gateway_charge','gateway_payout',
    'fx_conversion','api_request','qr_payment','loan_disbursement','loan_repayment','savings_deposit','savings_withdrawal',
    'njangi_contribution','njangi_payout','piggybank_deposit','piggybank_withdrawal','rent_payment','escrow_payment',
    'mobile_recharge','invoice_create','credit_report_purchase','overdraft_fee','loan_processing_fee','atm_withdrawal',
    'standing_order','dormancy_fee','remittance_inbound','remittance_outbound','remittance_bank_credit',
    'remittance_wallet_credit','remittance_bill_payment','remittance_fx_markup','overdraft_interest',
    'overdraft_setup_fee','overdraft_renewal_fee','byo_mobile_money_routing','byo_fallback_charge',
    'credit_score_inquiry','credit_report_inquiry','credit_premium_subscription',
    'travel_booking','travel_cancellation_fee'
  ]));

-- 2) Booking columns for cancellation/audit
ALTER TABLE public.travel_bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0;

-- 3) RLS: users can cancel their own bookings
DROP POLICY IF EXISTS "Users can cancel own bookings" ON public.travel_bookings;
CREATE POLICY "Users can cancel own bookings" ON public.travel_bookings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4) Atomic refund helper (race-safe credit)
CREATE OR REPLACE FUNCTION public.atomic_credit_balance(_account_id uuid, _amount numeric, _currency text DEFAULT 'XAF')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid; v_new numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be > 0'; END IF;
  SELECT id INTO v_id FROM public.account_balances
   WHERE account_id = _account_id AND balance_type = 'ClosingAvailable' AND credit_debit_indicator = 'Credit'
   FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.account_balances(account_id, amount, balance_datetime, balance_type, credit_debit_indicator, currency)
    VALUES (_account_id, _amount, now(), 'ClosingAvailable', 'Credit', _currency)
    RETURNING id, amount INTO v_id, v_new;
  ELSE
    UPDATE public.account_balances SET amount = amount + _amount, balance_datetime = now(), updated_at = now()
    WHERE id = v_id RETURNING amount INTO v_new;
  END IF;
  RETURN jsonb_build_object('success', true, 'balance_id', v_id, 'new_amount', v_new, 'credited', _amount);
END; $$;