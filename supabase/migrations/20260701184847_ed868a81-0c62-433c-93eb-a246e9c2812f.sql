
DO $$ BEGIN
  CREATE TYPE card_form_factor AS ENUM ('virtual','digital','physical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE card_shipment_status AS ENUM ('requested','manufacturing','shipped','delivered','returned','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.virtual_cards
  ADD COLUMN IF NOT EXISTS form_factor       card_form_factor  NOT NULL DEFAULT 'virtual',
  ADD COLUMN IF NOT EXISTS wallet_tokens     jsonb             NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nium_card_id      text,
  ADD COLUMN IF NOT EXISTS nium_customer_hash_id text,
  ADD COLUMN IF NOT EXISTS fallback_reason   text;

CREATE UNIQUE INDEX IF NOT EXISTS virtual_cards_nium_card_id_key ON public.virtual_cards(nium_card_id) WHERE nium_card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vc_form_factor ON public.virtual_cards(form_factor);

CREATE TABLE IF NOT EXISTS public.card_shipments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id            uuid NOT NULL REFERENCES public.virtual_cards(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL,
  provider           card_issuer_provider NOT NULL DEFAULT 'nium',
  status             card_shipment_status NOT NULL DEFAULT 'requested',
  recipient_name     text NOT NULL,
  address_line1      text NOT NULL,
  address_line2      text,
  city               text NOT NULL,
  region             text,
  postal_code        text,
  country            text NOT NULL,
  courier            text,
  tracking_number    text,
  requested_at       timestamptz NOT NULL DEFAULT now(),
  shipped_at         timestamptz,
  delivered_at       timestamptz,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_shipments TO authenticated;
GRANT ALL ON public.card_shipments TO service_role;

ALTER TABLE public.card_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "card_shipments_owner_select" ON public.card_shipments;
CREATE POLICY "card_shipments_owner_select" ON public.card_shipments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "card_shipments_admin_manage" ON public.card_shipments;
CREATE POLICY "card_shipments_admin_manage" ON public.card_shipments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_card_shipments_card ON public.card_shipments(card_id);
CREATE INDEX IF NOT EXISTS idx_card_shipments_user ON public.card_shipments(user_id);

CREATE OR REPLACE FUNCTION public.update_card_shipments_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $fn$;

DROP TRIGGER IF EXISTS trg_card_shipments_updated_at ON public.card_shipments;
CREATE TRIGGER trg_card_shipments_updated_at
  BEFORE UPDATE ON public.card_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_card_shipments_updated_at();
