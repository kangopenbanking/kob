-- Phase 9 — Advanced fulfillment rules for Daily Needs delivery settings
ALTER TABLE public.ddn_merchant_delivery_settings
  ADD COLUMN IF NOT EXISTS max_radius_km numeric NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS min_fee_xaf integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_fee_xaf integer,
  ADD COLUMN IF NOT EXISTS surge_multiplier numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS operating_hours jsonb NOT NULL DEFAULT '{"mon":{"open":"08:00","close":"22:00"},"tue":{"open":"08:00","close":"22:00"},"wed":{"open":"08:00","close":"22:00"},"thu":{"open":"08:00","close":"22:00"},"fri":{"open":"08:00","close":"22:00"},"sat":{"open":"08:00","close":"22:00"},"sun":{"open":"08:00","close":"22:00"}}'::jsonb,
  ADD COLUMN IF NOT EXISTS accept_outside_hours boolean NOT NULL DEFAULT false;

-- Sanity bounds
ALTER TABLE public.ddn_merchant_delivery_settings
  DROP CONSTRAINT IF EXISTS ddn_settings_surge_chk,
  ADD CONSTRAINT ddn_settings_surge_chk CHECK (surge_multiplier >= 0.5 AND surge_multiplier <= 5.0);

ALTER TABLE public.ddn_merchant_delivery_settings
  DROP CONSTRAINT IF EXISTS ddn_settings_max_radius_chk,
  ADD CONSTRAINT ddn_settings_max_radius_chk CHECK (max_radius_km > 0 AND max_radius_km <= 50);