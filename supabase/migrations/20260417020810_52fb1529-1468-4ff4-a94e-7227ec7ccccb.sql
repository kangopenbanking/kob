-- Extend fee_structures CHECK to support BYO routing fees
ALTER TABLE public.fee_structures DROP CONSTRAINT IF EXISTS fee_structures_transaction_type_check;

ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_transaction_type_check CHECK (transaction_type = ANY (ARRAY[
  'transfer','payment','bill_payment','mobile_money_transfer','mobile_money_charge',
  'withdrawal','deposit','piggybank','njangi','rent','international_transfer','card_payment','p2p','cashout',
  'bank_transfer','ussd_payment','account_funding','paypal_payment','virtual_card_topup','gateway_charge','gateway_payout',
  'fx_conversion','api_request','qr_payment','loan_disbursement','loan_repayment','savings_deposit','savings_withdrawal',
  'njangi_contribution','njangi_payout','piggybank_deposit','piggybank_withdrawal','rent_payment','escrow_payment',
  'mobile_recharge','invoice_create','credit_report_purchase','overdraft_fee','loan_processing_fee','atm_withdrawal',
  'standing_order','dormancy_fee','remittance_inbound','remittance_outbound','remittance_bank_credit',
  'remittance_wallet_credit','remittance_bill_payment','remittance_fx_markup','overdraft_interest','overdraft_setup_fee',
  'overdraft_renewal_fee',
  'byo_mobile_money_routing','byo_fallback_charge'
]));

COMMENT ON CONSTRAINT fee_structures_transaction_type_check ON public.fee_structures IS
  'Includes byo_mobile_money_routing (thin platform fee on direct BYO MTN/Orange charges) and byo_fallback_charge (fee when Flutterwave fallback rescues a BYO charge).';