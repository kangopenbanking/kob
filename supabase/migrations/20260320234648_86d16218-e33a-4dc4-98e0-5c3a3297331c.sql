
-- =============================================
-- REMITTANCE-AS-A-SERVICE (RaaS) Phase 1
-- 8 tables + indexes + triggers + RLS
-- =============================================

-- 1. remittance_partners
CREATE TABLE public.remittance_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive',
  webhook_secret_hash TEXT,
  public_key TEXT,
  supported_corridors JSONB DEFAULT '[]',
  api_base_url TEXT,
  auth_method TEXT DEFAULT 'api_key',
  auth_config_encrypted JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.remittance_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on remittance_partners"
  ON public.remittance_partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read active partners"
  ON public.remittance_partners FOR SELECT TO authenticated
  USING (status = 'active');

-- 2. remittance_corridors
CREATE TABLE public.remittance_corridors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.remittance_partners(id) ON DELETE CASCADE,
  from_country TEXT NOT NULL,
  to_country TEXT NOT NULL DEFAULT 'CM',
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL DEFAULT 'XAF',
  min_amount NUMERIC NOT NULL DEFAULT 1,
  max_amount NUMERIC NOT NULL DEFAULT 5000000,
  est_delivery_seconds INTEGER DEFAULT 3600,
  fees_model JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id, from_country, from_currency)
);

ALTER TABLE public.remittance_corridors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on remittance_corridors"
  ON public.remittance_corridors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read active corridors"
  ON public.remittance_corridors FOR SELECT TO authenticated
  USING (is_active = true);

-- 3. remittance_quotes
CREATE TABLE public.remittance_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.remittance_partners(id),
  corridor_id UUID REFERENCES public.remittance_corridors(id),
  amount_in NUMERIC NOT NULL,
  currency_in TEXT NOT NULL,
  amount_out NUMERIC NOT NULL,
  currency_out TEXT NOT NULL DEFAULT 'XAF',
  fee_total NUMERIC NOT NULL DEFAULT 0,
  fx_rate NUMERIC NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  quote_raw JSONB DEFAULT '{}',
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.remittance_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full on remittance_quotes"
  ON public.remittance_quotes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users read own quotes"
  ON public.remittance_quotes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin read all quotes"
  ON public.remittance_quotes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. remittances (core object)
CREATE TABLE public.remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL DEFAULT 'inbound',
  partner_id UUID NOT NULL REFERENCES public.remittance_partners(id),
  partner_reference TEXT NOT NULL,
  quote_id UUID REFERENCES public.remittance_quotes(id),
  corridor_id UUID REFERENCES public.remittance_corridors(id),
  sender_name TEXT,
  sender_country TEXT,
  sender_phone TEXT,
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT,
  receiver_user_id UUID,
  receiver_institution_id UUID REFERENCES public.institutions(id),
  amount_in NUMERIC NOT NULL,
  currency_in TEXT NOT NULL,
  amount_out NUMERIC NOT NULL,
  currency_out TEXT NOT NULL DEFAULT 'XAF',
  fee_total NUMERIC NOT NULL DEFAULT 0,
  fx_rate NUMERIC NOT NULL DEFAULT 1,
  purpose_code TEXT,
  narration TEXT,
  destination_type TEXT NOT NULL DEFAULT 'kob_wallet',
  destination_ref TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  correlation_id TEXT DEFAULT gen_random_uuid()::text,
  trace_id TEXT,
  compliance_status TEXT DEFAULT 'pending',
  received_at TIMESTAMPTZ,
  credited_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id, partner_reference)
);

ALTER TABLE public.remittances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full on remittances"
  ON public.remittances FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users read own remittances"
  ON public.remittances FOR SELECT TO authenticated
  USING (receiver_user_id = auth.uid());

CREATE POLICY "Admin full on remittances"
  ON public.remittances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. remittance_events
CREATE TABLE public.remittance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id UUID NOT NULL REFERENCES public.remittances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  provider_event_id TEXT,
  payload_raw JSONB DEFAULT '{}',
  signature_valid BOOLEAN DEFAULT true,
  actor_id UUID,
  actor_type TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.remittance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full on remittance_events"
  ON public.remittance_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users read own remittance events"
  ON public.remittance_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.remittances r
    WHERE r.id = remittance_id AND r.receiver_user_id = auth.uid()
  ));

CREATE POLICY "Admin read all remittance events"
  ON public.remittance_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. remittance_ledger_links
CREATE TABLE public.remittance_ledger_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_id UUID NOT NULL REFERENCES public.remittances(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id),
  posting_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.remittance_ledger_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full on remittance_ledger_links"
  ON public.remittance_ledger_links FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admin read remittance_ledger_links"
  ON public.remittance_ledger_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. remittance_settlements
CREATE TABLE public.remittance_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.remittance_partners(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  gross_in NUMERIC NOT NULL DEFAULT 0,
  fees NUMERIC NOT NULL DEFAULT 0,
  net_settlement NUMERIC NOT NULL DEFAULT 0,
  remittance_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  statement_raw JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.remittance_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full on remittance_settlements"
  ON public.remittance_settlements FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admin full on remittance_settlements"
  ON public.remittance_settlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. remittance_reconciliation_items
CREATE TABLE public.remittance_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES public.remittance_settlements(id) ON DELETE CASCADE,
  remittance_id UUID REFERENCES public.remittances(id),
  partner_reference TEXT NOT NULL,
  expected_amount NUMERIC NOT NULL,
  actual_amount NUMERIC,
  mismatch_reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.remittance_reconciliation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full on remittance_reconciliation_items"
  ON public.remittance_reconciliation_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admin full on remittance_reconciliation_items"
  ON public.remittance_reconciliation_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_remittances_partner_ref ON public.remittances(partner_id, partner_reference);
CREATE INDEX idx_remittances_receiver ON public.remittances(receiver_user_id, status);
CREATE INDEX idx_remittances_status ON public.remittances(status, created_at);
CREATE INDEX idx_remittances_institution ON public.remittances(receiver_institution_id, status);
CREATE INDEX idx_remittance_events_remittance ON public.remittance_events(remittance_id, created_at);
CREATE INDEX idx_recon_items_settlement ON public.remittance_reconciliation_items(settlement_id, status);
CREATE INDEX idx_remittance_corridors_lookup ON public.remittance_corridors(to_country, to_currency, is_active);

-- =============================================
-- STATE MACHINE TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_remittance_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  CASE OLD.status
    WHEN 'created' THEN
      IF NEW.status NOT IN ('pending', 'failed') THEN
        RAISE EXCEPTION 'Invalid remittance transition: created → %', NEW.status;
      END IF;
    WHEN 'pending' THEN
      IF NEW.status NOT IN ('received', 'failed') THEN
        RAISE EXCEPTION 'Invalid remittance transition: pending → %', NEW.status;
      END IF;
    WHEN 'received' THEN
      IF NEW.status NOT IN ('credited', 'failed') THEN
        RAISE EXCEPTION 'Invalid remittance transition: received → %', NEW.status;
      END IF;
    WHEN 'credited' THEN
      IF NEW.status NOT IN ('settled', 'reversed') THEN
        RAISE EXCEPTION 'Invalid remittance transition: credited → %', NEW.status;
      END IF;
    WHEN 'settled' THEN
      IF NEW.status != 'reversed' THEN
        RAISE EXCEPTION 'Cannot transition from settled to %', NEW.status;
      END IF;
    WHEN 'failed' THEN
      RAISE EXCEPTION 'Cannot transition from failed status';
    WHEN 'reversed' THEN
      RAISE EXCEPTION 'Cannot transition from reversed status';
    ELSE NULL;
  END CASE;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_remittance_status_transition
BEFORE UPDATE OF status ON public.remittances
FOR EACH ROW EXECUTE FUNCTION public.validate_remittance_status_transition();

-- =============================================
-- RECEIVER AUTO-RESOLVE BY PHONE
-- =============================================
CREATE OR REPLACE FUNCTION public.resolve_remittance_receiver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.receiver_user_id IS NULL AND NEW.receiver_phone IS NOT NULL THEN
    SELECT id INTO NEW.receiver_user_id
    FROM public.profiles WHERE phone = NEW.receiver_phone LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_remittance_receiver
BEFORE INSERT ON public.remittances
FOR EACH ROW EXECUTE FUNCTION public.resolve_remittance_receiver();

-- =============================================
-- NOTIFICATION TRIGGER ON STATUS CHANGE
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_remittance_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_notif_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.receiver_user_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'received' THEN
      v_notif_type := 'info';
      v_title := 'Remittance Received';
      v_message := format('%s %s from %s is being processed.', NEW.currency_out, TO_CHAR(NEW.amount_out, 'FM999,999,999'), COALESCE(NEW.sender_name, 'sender'));
    WHEN 'credited' THEN
      v_notif_type := 'success';
      v_title := 'Remittance Credited';
      v_message := format('%s %s from %s has been credited to your %s.', NEW.currency_out, TO_CHAR(NEW.amount_out, 'FM999,999,999'), COALESCE(NEW.sender_name, 'sender'), COALESCE(NEW.destination_type, 'account'));
    WHEN 'failed' THEN
      v_notif_type := 'warning';
      v_title := 'Remittance Failed';
      v_message := format('%s %s remittance failed. %s', NEW.currency_out, TO_CHAR(NEW.amount_out, 'FM999,999,999'), COALESCE(NEW.failure_reason, 'Contact support.'));
    WHEN 'settled' THEN
      v_notif_type := 'success';
      v_title := 'Remittance Settled';
      v_message := format('%s %s remittance from %s has been fully settled.', NEW.currency_out, TO_CHAR(NEW.amount_out, 'FM999,999,999'), COALESCE(NEW.sender_name, 'sender'));
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
  VALUES (
    NEW.receiver_user_id,
    v_notif_type,
    v_title,
    v_message,
    'remittance',
    jsonb_build_object('remittance_id', NEW.id, 'amount', NEW.amount_out, 'currency', NEW.currency_out, 'status', NEW.status, 'sender', NEW.sender_name)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_remittance_status
AFTER UPDATE OF status ON public.remittances
FOR EACH ROW EXECUTE FUNCTION public.notify_remittance_status_change();
