-- Pharmacy capabilities + verification details for daily_needs_stores
ALTER TABLE public.daily_needs_stores
  ADD COLUMN IF NOT EXISTS pharmacy_license_number TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_license_url TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_license_expires_on DATE,
  ADD COLUMN IF NOT EXISTS pharmacist_in_charge_name TEXT,
  ADD COLUMN IF NOT EXISTS pharmacist_in_charge_license TEXT,
  ADD COLUMN IF NOT EXISTS pharmacist_in_charge_phone TEXT,
  ADD COLUMN IF NOT EXISTS controlled_substances_allowed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS otc_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rx_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cold_chain_capable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_modes TEXT[] NOT NULL DEFAULT ARRAY['delivery']::TEXT[],
  ADD COLUMN IF NOT EXISTS service_areas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected','needs_info')),
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS onboarding_step INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dn_stores_verification ON public.daily_needs_stores(verification_status);