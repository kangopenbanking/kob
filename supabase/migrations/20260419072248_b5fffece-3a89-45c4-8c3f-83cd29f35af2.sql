-- Fee Management E2E hardening:
-- 1) Deactivate duplicate / inferior platform fee_structures rows (keep the richer hybrid one)
-- 2) Seed missing platform fees for banking, lending, remittance and FX
-- Idempotent and additive — no destructive deletes.

-- 1A) Deactivate the legacy zero-priced bank_transfer percentage row
UPDATE public.fee_structures
SET is_active = false, updated_at = now()
WHERE fee_scope = 'platform'
  AND transaction_type = 'bank_transfer'
  AND is_active = true
  AND fee_model = 'percentage'
  AND fixed_amount = 0
  AND percentage_rate = 0;

-- 1B) Deactivate inferior duplicates for travel categories — keep the richer hybrid row
UPDATE public.fee_structures f
SET is_active = false, updated_at = now()
WHERE f.fee_scope = 'platform'
  AND f.is_active = true
  AND f.transaction_type IN ('hotel_booking','flight_booking','tour_booking','travel_booking')
  AND f.fee_model = 'fixed'
  AND EXISTS (
    SELECT 1 FROM public.fee_structures g
    WHERE g.fee_scope = 'platform'
      AND g.is_active = true
      AND g.transaction_type = f.transaction_type
      AND g.fee_model = 'hybrid'
      AND g.id <> f.id
  );

-- 1C) Deactivate inter_bank_transfer percentage duplicate (keep hybrid 200 + 0.5%)
UPDATE public.fee_structures
SET is_active = false, updated_at = now()
WHERE fee_scope = 'platform'
  AND transaction_type = 'inter_bank_transfer'
  AND is_active = true
  AND fee_model = 'percentage';

-- 1D) Deactivate the zero-priced intra_bank_transfer duplicate (keep 100 XAF fixed)
UPDATE public.fee_structures
SET is_active = false, updated_at = now()
WHERE fee_scope = 'platform'
  AND transaction_type = 'intra_bank_transfer'
  AND is_active = true
  AND fee_model = 'fixed'
  AND fixed_amount = 0;

-- 2) Seed missing platform-scope fee rows
INSERT INTO public.fee_structures (
  fee_scope, transaction_type, fee_model, fixed_amount, percentage_rate,
  min_fee_amount, max_fee_amount, max_charge_cap,
  effective_from, is_active
)
SELECT v.fee_scope, v.transaction_type, v.fee_model, v.fixed_amount, v.percentage_rate,
       v.min_fee_amount, v.max_fee_amount, v.max_charge_cap, CURRENT_DATE, true
FROM (VALUES
  ('platform','fx_conversion',           'hybrid', 0,    1.5, 0, 0, -1),
  ('platform','overdraft_fee',           'hybrid', 200,  5.0, 0, 0, 5000),
  ('platform','overdraft_interest',      'percentage', 0, 8.0, 0, 0, -1),
  ('platform','overdraft_setup_fee',     'fixed', 1000,  0.0, 0, 0, 1000),
  ('platform','overdraft_renewal_fee',   'fixed',  500,  0.0, 0, 0,  500),
  ('platform','loan_processing_fee',     'hybrid', 500,  2.0, 0, 0, -1),
  ('platform','atm_withdrawal',          'fixed',  150,  0.0, 0, 0,  150),
  ('platform','standing_order',          'fixed',  100,  0.0, 0, 0,  100),
  ('platform','dormancy_fee',            'fixed',  500,  0.0, 0, 0,  500),
  ('platform','remittance_inbound',      'hybrid', 100,  2.0, 0, 0, -1),
  ('platform','remittance_bank_credit',  'hybrid',  75,  1.5, 0, 0, -1),
  ('platform','remittance_wallet_credit','hybrid',  50,  1.0, 0, 0, -1),
  ('platform','remittance_bill_payment', 'hybrid', 100,  2.0, 0, 0, -1),
  ('platform','remittance_fx_markup',    'percentage', 0, 1.5, 0, 0, -1)
) AS v(fee_scope, transaction_type, fee_model, fixed_amount, percentage_rate, min_fee_amount, max_fee_amount, max_charge_cap)
WHERE NOT EXISTS (
  SELECT 1 FROM public.fee_structures f
  WHERE f.fee_scope = v.fee_scope
    AND f.transaction_type = v.transaction_type
    AND f.is_active = true
);