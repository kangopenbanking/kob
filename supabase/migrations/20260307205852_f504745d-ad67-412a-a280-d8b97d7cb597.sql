
-- Add limits, commissions, and merchant surcharge columns to fee_structures
ALTER TABLE public.fee_structures
  ADD COLUMN IF NOT EXISTS daily_limit numeric DEFAULT -1,
  ADD COLUMN IF NOT EXISTS monthly_limit numeric DEFAULT -1,
  ADD COLUMN IF NOT EXISTS max_charge_cap numeric DEFAULT -1,
  ADD COLUMN IF NOT EXISTS agent_commission_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_commission_fixed numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_percent_commission numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_fixed_commission numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merchant_percent_charge numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merchant_fixed_charge numeric DEFAULT 0;

-- Migrate data from fee_limits_charges into matching fee_structures rows where possible
-- For each fee_limits_charges category, update matching platform-scope fee_structures rows
UPDATE public.fee_structures fs
SET
  daily_limit = COALESCE(flc.daily_limit, -1),
  monthly_limit = COALESCE(flc.monthly_limit, -1),
  max_charge_cap = COALESCE(flc.max_charge_cap, -1),
  agent_commission_percent = COALESCE(flc.agent_commission_percent, 0),
  agent_commission_fixed = COALESCE(flc.agent_commission_fixed, 0),
  referral_percent_commission = COALESCE(flc.referral_percent_commission, 0),
  referral_fixed_commission = COALESCE(flc.referral_fixed_commission, 0),
  merchant_percent_charge = COALESCE(flc.merchant_percent_charge, 0),
  merchant_fixed_charge = COALESCE(flc.merchant_fixed_charge, 0)
FROM public.fee_limits_charges flc
WHERE flc.is_active = true
  AND (
    (flc.category = 'send_money' AND fs.transaction_type = 'mobile_money_charge')
    OR (flc.category = 'payment_charges' AND fs.transaction_type = 'card_payment')
    OR (flc.category = 'bank_transfer' AND fs.transaction_type = 'bank_transfer')
    OR (flc.category = 'cash_in' AND fs.transaction_type = 'account_funding')
    OR (flc.category = 'cash_out' AND fs.transaction_type = 'withdrawal')
  )
  AND fs.fee_scope = 'platform'
  AND fs.is_active = true;
