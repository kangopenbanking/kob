
-- =====================================================================
-- Virtual Card Issuing v2 — Kora middleware foundation
-- Additive only (Standing Order 4: Surgeon Rule). No drops.
-- =====================================================================

-- 1. Provider + tenant enums ------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.card_issuer_provider AS ENUM ('kora', 'cardyfie_legacy', 'stripe_legacy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.card_tenant_type AS ENUM ('bank', 'developer', 'platform');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.card_kyc_level AS ENUM ('none', 'tier1', 'tier2', 'tier3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend virtual_card_programs -------------------------------------
ALTER TABLE public.virtual_card_programs
  ADD COLUMN IF NOT EXISTS issuer_provider public.card_issuer_provider NOT NULL DEFAULT 'kora',
  ADD COLUMN IF NOT EXISTS tenant_type public.card_tenant_type NOT NULL DEFAULT 'bank',
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS kyc_required_level public.card_kyc_level NOT NULL DEFAULT 'tier1',
  ADD COLUMN IF NOT EXISTS default_daily_limit numeric(12,2),
  ADD COLUMN IF NOT EXISTS default_monthly_limit numeric(12,2),
  ADD COLUMN IF NOT EXISTS auto_topup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_vcp_tenant ON public.virtual_card_programs(tenant_type, tenant_id);

-- 3. Extend virtual_cards ---------------------------------------------
ALTER TABLE public.virtual_cards
  ALTER COLUMN stripe_card_id DROP NOT NULL;

ALTER TABLE public.virtual_cards
  ADD COLUMN IF NOT EXISTS provider public.card_issuer_provider NOT NULL DEFAULT 'kora',
  ADD COLUMN IF NOT EXISTS kora_card_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS kora_cardholder_id text,
  ADD COLUMN IF NOT EXISTS tenant_type public.card_tenant_type NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS customer_external_id text,
  ADD COLUMN IF NOT EXISTS issued_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS terminated_at timestamptz,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS idx_vc_tenant ON public.virtual_cards(tenant_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_vc_provider ON public.virtual_cards(provider);
CREATE INDEX IF NOT EXISTS idx_vc_customer_ext ON public.virtual_cards(customer_external_id);

-- 4. Kora cardholders -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kora_cardholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_type public.card_tenant_type NOT NULL,
  tenant_id uuid NOT NULL,
  customer_external_id text NOT NULL,
  kora_cardholder_id text UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  date_of_birth date,
  address_line1 text,
  address_city text,
  address_state text,
  address_country text,
  address_postal_code text,
  kyc_level public.card_kyc_level NOT NULL DEFAULT 'tier1',
  kyc_status text NOT NULL DEFAULT 'pending',
  kyc_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_type, tenant_id, customer_external_id)
);

CREATE INDEX IF NOT EXISTS idx_kch_tenant ON public.kora_cardholders(tenant_type, tenant_id);

ALTER TABLE public.kora_cardholders ENABLE ROW LEVEL SECURITY;

-- 5. Webhook events ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.virtual_card_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider public.card_issuer_provider NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  processing_error text,
  related_card_id uuid REFERENCES public.virtual_cards(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_vcwe_type ON public.virtual_card_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_vcwe_card ON public.virtual_card_webhook_events(related_card_id);

ALTER TABLE public.virtual_card_webhook_events ENABLE ROW LEVEL SECURITY;

-- 6. Audit log --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.virtual_card_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES public.virtual_cards(id) ON DELETE SET NULL,
  tenant_type public.card_tenant_type,
  tenant_id uuid,
  actor_user_id uuid,
  actor_role text,
  action text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  user_agent text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcal_card ON public.virtual_card_audit_log(card_id);
CREATE INDEX IF NOT EXISTS idx_vcal_tenant ON public.virtual_card_audit_log(tenant_type, tenant_id);
CREATE INDEX IF NOT EXISTS idx_vcal_actor ON public.virtual_card_audit_log(actor_user_id);

ALTER TABLE public.virtual_card_audit_log ENABLE ROW LEVEL SECURITY;

-- 7. Tenant-resolution helper (SECURITY DEFINER, search_path locked) --
CREATE OR REPLACE FUNCTION public.is_card_tenant_member(_tenant_type public.card_tenant_type, _tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR _tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(_uid, 'admin'::app_role) THEN
    RETURN true;
  END IF;

  IF _tenant_type = 'bank' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.user_id = _uid
        AND sa.institution_id = _tenant_id
        AND COALESCE(sa.is_active, true) = true
    ) OR EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.user_id = _uid
        AND a.institution_id = _tenant_id
    );
  ELSIF _tenant_type = 'developer' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.kob_api_keys k
      WHERE k.owner_user_id = _uid
        AND k.id = _tenant_id
    ) OR _tenant_id = _uid;
  END IF;

  RETURN false;
END;
$$;

-- 8. RLS policies -----------------------------------------------------
DROP POLICY IF EXISTS "Tenant members read kora cardholders" ON public.kora_cardholders;
CREATE POLICY "Tenant members read kora cardholders"
  ON public.kora_cardholders FOR SELECT
  USING (public.is_card_tenant_member(tenant_type, tenant_id));

DROP POLICY IF EXISTS "Tenant members insert kora cardholders" ON public.kora_cardholders;
CREATE POLICY "Tenant members insert kora cardholders"
  ON public.kora_cardholders FOR INSERT
  WITH CHECK (public.is_card_tenant_member(tenant_type, tenant_id));

DROP POLICY IF EXISTS "Tenant members update kora cardholders" ON public.kora_cardholders;
CREATE POLICY "Tenant members update kora cardholders"
  ON public.kora_cardholders FOR UPDATE
  USING (public.is_card_tenant_member(tenant_type, tenant_id));

DROP POLICY IF EXISTS "Admins read webhook events" ON public.virtual_card_webhook_events;
CREATE POLICY "Admins read webhook events"
  ON public.virtual_card_webhook_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Tenant members read related webhook events" ON public.virtual_card_webhook_events;
CREATE POLICY "Tenant members read related webhook events"
  ON public.virtual_card_webhook_events FOR SELECT
  USING (
    related_card_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.virtual_cards vc
      WHERE vc.id = related_card_id
        AND public.is_card_tenant_member(vc.tenant_type, vc.tenant_id)
    )
  );

DROP POLICY IF EXISTS "Admins read audit log" ON public.virtual_card_audit_log;
CREATE POLICY "Admins read audit log"
  ON public.virtual_card_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Tenant members read own audit log" ON public.virtual_card_audit_log;
CREATE POLICY "Tenant members read own audit log"
  ON public.virtual_card_audit_log FOR SELECT
  USING (public.is_card_tenant_member(tenant_type, tenant_id));

-- Extend virtual_cards RLS so bank/developer staff can read tenant cards
DROP POLICY IF EXISTS "Tenant members can view tenant virtual cards" ON public.virtual_cards;
CREATE POLICY "Tenant members can view tenant virtual cards"
  ON public.virtual_cards FOR SELECT
  USING (public.is_card_tenant_member(tenant_type, tenant_id));

-- 9. Triggers ---------------------------------------------------------
DROP TRIGGER IF EXISTS update_kora_cardholders_updated_at ON public.kora_cardholders;
CREATE TRIGGER update_kora_cardholders_updated_at
  BEFORE UPDATE ON public.kora_cardholders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
