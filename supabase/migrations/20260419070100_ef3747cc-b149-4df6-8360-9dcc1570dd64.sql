-- Extend fee_structures transaction_type CHECK to include intra/inter bank transfers
ALTER TABLE public.fee_structures DROP CONSTRAINT IF EXISTS fee_structures_transaction_type_check;

ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_transaction_type_check
CHECK (transaction_type = ANY (ARRAY[
  'transfer','payment','bill_payment','mobile_money_transfer','mobile_money_charge',
  'withdrawal','deposit','piggybank','njangi','rent','international_transfer',
  'card_payment','p2p','cashout','bank_transfer','intra_bank_transfer','inter_bank_transfer',
  'ussd_payment','account_funding','paypal_payment','virtual_card_topup',
  'gateway_charge','gateway_payout','fx_conversion','api_request','qr_payment',
  'loan_disbursement','loan_repayment','savings_deposit','savings_withdrawal',
  'njangi_contribution','njangi_payout','piggybank_deposit','piggybank_withdrawal',
  'rent_payment','escrow_payment','mobile_recharge','invoice_create',
  'credit_report_purchase','overdraft_fee','loan_processing_fee','atm_withdrawal',
  'standing_order','dormancy_fee','remittance_inbound','remittance_outbound',
  'remittance_bank_credit','remittance_wallet_credit','remittance_bill_payment',
  'remittance_fx_markup','overdraft_interest','overdraft_setup_fee','overdraft_renewal_fee',
  'byo_mobile_money_routing','byo_fallback_charge',
  'credit_score_inquiry','credit_report_inquiry','credit_premium_subscription',
  'travel_booking','travel_cancellation_fee',
  'hotel_booking','flight_booking','tour_booking'
]));

-- Seed sensible platform defaults for intra-bank and inter-bank transfers
INSERT INTO public.fee_structures (
  fee_scope, transaction_type, fee_model, fixed_amount, percentage_rate,
  min_fee_amount, max_fee_amount, max_charge_cap,
  effective_from, is_active
) VALUES
  ('platform','intra_bank_transfer','fixed', 100, 0,    0, 500,  500,  CURRENT_DATE, true),
  ('platform','inter_bank_transfer','hybrid', 200, 0.5, 0, 2500, 2500, CURRENT_DATE, true)
ON CONFLICT DO NOTHING;

-- Refresh the underpriced platform bank_transfer row to a reasonable hybrid baseline
UPDATE public.fee_structures
SET fee_model = 'hybrid',
    fixed_amount = 150,
    percentage_rate = 0.3,
    max_charge_cap = 2000,
    updated_at = now()
WHERE fee_scope = 'platform'
  AND transaction_type = 'bank_transfer'
  AND is_active = true
  AND fixed_amount = 0
  AND percentage_rate = 0;

-- Ensure travel_booking platform row exists (already added per prior audit, idempotent insert)
INSERT INTO public.fee_structures (
  fee_scope, transaction_type, fee_model, fixed_amount, percentage_rate,
  effective_from, is_active
)
SELECT 'platform','hotel_booking','hybrid', 50, 1.5, CURRENT_DATE, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.fee_structures
  WHERE fee_scope='platform' AND transaction_type='hotel_booking' AND is_active=true
);

INSERT INTO public.fee_structures (
  fee_scope, transaction_type, fee_model, fixed_amount, percentage_rate,
  effective_from, is_active
)
SELECT 'platform','flight_booking','hybrid', 100, 2.0, CURRENT_DATE, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.fee_structures
  WHERE fee_scope='platform' AND transaction_type='flight_booking' AND is_active=true
);

INSERT INTO public.fee_structures (
  fee_scope, transaction_type, fee_model, fixed_amount, percentage_rate,
  effective_from, is_active
)
SELECT 'platform','tour_booking','hybrid', 50, 1.5, CURRENT_DATE, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.fee_structures
  WHERE fee_scope='platform' AND transaction_type='tour_booking' AND is_active=true
);