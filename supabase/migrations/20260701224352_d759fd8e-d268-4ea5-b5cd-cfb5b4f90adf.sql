
-- Extend transaction_type check constraint to support card-specific fees.
ALTER TABLE public.fee_structures DROP CONSTRAINT IF EXISTS fee_structures_transaction_type_check;
ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_transaction_type_check
CHECK (transaction_type = ANY (ARRAY[
  'transfer','payment','bill_payment','mobile_money_transfer','mobile_money_charge',
  'withdrawal','deposit','piggybank','njangi','rent','international_transfer',
  'card_payment','p2p','cashout','bank_transfer','intra_bank_transfer','inter_bank_transfer',
  'ussd_payment','account_funding','paypal_payment','virtual_card_topup','gateway_charge',
  'gateway_payout','fx_conversion','api_request','qr_payment','loan_disbursement',
  'loan_repayment','savings_deposit','savings_withdrawal','njangi_contribution','njangi_payout',
  'piggybank_deposit','piggybank_withdrawal','rent_payment','escrow_payment','mobile_recharge',
  'invoice_create','credit_report_purchase','overdraft_fee','loan_processing_fee',
  'atm_withdrawal','standing_order','dormancy_fee','remittance_inbound','remittance_outbound',
  'remittance_bank_credit','remittance_wallet_credit','remittance_bill_payment','remittance_fx_markup',
  'overdraft_interest','overdraft_setup_fee','overdraft_renewal_fee','byo_mobile_money_routing',
  'byo_fallback_charge','credit_score_inquiry','credit_report_inquiry','credit_premium_subscription',
  'travel_booking','travel_cancellation_fee','hotel_booking','flight_booking','tour_booking',
  'woocommerce_transaction','enterprise_subscription_starter','enterprise_subscription_growth',
  'enterprise_subscription_scale','statement_download_consumer','statement_download_banking',
  'nium_withdrawal','nium_fx_spread',
  -- NEW card fees:
  'card_issuance_fee','card_maintenance_fee','card_transaction_fee'
]));

-- Seed platform defaults (admin-editable in /admin/fee-management).
INSERT INTO public.fee_structures (transaction_type, fee_model, fixed_amount, percentage_rate, fee_scope, is_active, effective_from)
VALUES
  ('card_issuance_fee',    'fixed',      2500, 0,      'platform', true, CURRENT_DATE),
  ('card_maintenance_fee', 'fixed',      500,  0,      'platform', true, CURRENT_DATE),
  ('card_transaction_fee', 'percentage', 0,    0.0150, 'platform', true, CURRENT_DATE)
ON CONFLICT DO NOTHING;
