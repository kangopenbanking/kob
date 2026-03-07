
-- Add fee_scope and merchant_id columns
ALTER TABLE public.fee_structures
  ADD COLUMN fee_scope text NOT NULL DEFAULT 'institution',
  ADD COLUMN merchant_id uuid REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  ADD COLUMN target_entity_id uuid;

-- Add scope check constraint
ALTER TABLE public.fee_structures
  ADD CONSTRAINT fee_structures_scope_check CHECK (fee_scope IN ('institution', 'platform', 'merchant', 'api'));

-- Drop old transaction_type check and replace with expanded one
ALTER TABLE public.fee_structures DROP CONSTRAINT IF EXISTS fee_structures_transaction_type_check;

ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_transaction_type_check 
CHECK (transaction_type = ANY (ARRAY[
  'transfer', 'payment', 'bill_payment', 'mobile_money_transfer', 'mobile_money_charge',
  'withdrawal', 'deposit', 'piggybank', 'njangi', 'rent', 'international_transfer',
  'card_payment', 'p2p', 'cashout', 'bank_transfer', 'ussd_payment', 'account_funding',
  'paypal_payment', 'virtual_card_topup', 'gateway_charge', 'gateway_payout',
  'fx_conversion', 'api_request', 'qr_payment', 'loan_disbursement', 'loan_repayment',
  'savings_deposit', 'savings_withdrawal', 'njangi_contribution', 'njangi_payout',
  'piggybank_deposit', 'piggybank_withdrawal', 'rent_payment', 'escrow_payment',
  'mobile_recharge', 'invoice_create'
]));

-- Make institution_id nullable for platform-level fee structures
ALTER TABLE public.fee_structures ALTER COLUMN institution_id DROP NOT NULL;
