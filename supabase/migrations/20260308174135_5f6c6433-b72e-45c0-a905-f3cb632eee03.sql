ALTER TABLE pos_subscription_plans ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'standard';
UPDATE pos_subscription_plans SET tier = 'enterprise' WHERE name ILIKE '%enterprise%';
ALTER TABLE pos_store_profiles 
  ADD COLUMN IF NOT EXISTS custom_brand_json jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sla_tier text DEFAULT null,
  ADD COLUMN IF NOT EXISTS account_manager_id uuid DEFAULT null,
  ADD COLUMN IF NOT EXISTS api_access_enabled boolean DEFAULT false;