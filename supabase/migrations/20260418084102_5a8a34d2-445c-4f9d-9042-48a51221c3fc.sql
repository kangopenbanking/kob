-- Pending inbound transfers held until recipient activates their account
CREATE TABLE public.pending_inbound_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_user_id UUID NOT NULL,
  sender_name TEXT,
  recipient_user_id UUID NOT NULL,
  recipient_phone TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  source_transaction_id UUID,
  status TEXT NOT NULL DEFAULT 'pending_activation',
  notes TEXT,
  released_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Status validation trigger (avoid CHECK with mutable refs)
CREATE OR REPLACE FUNCTION public.validate_pending_inbound_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending_activation','released','expired','refunded') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pending_inbound_validate
BEFORE INSERT OR UPDATE ON public.pending_inbound_transfers
FOR EACH ROW EXECUTE FUNCTION public.validate_pending_inbound_status();

CREATE INDEX idx_pending_inbound_recipient_status
  ON public.pending_inbound_transfers (recipient_user_id, status);
CREATE INDEX idx_pending_inbound_sender
  ON public.pending_inbound_transfers (sender_user_id);

ALTER TABLE public.pending_inbound_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients view their pending inbound"
  ON public.pending_inbound_transfers FOR SELECT
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Senders view their pending outbound"
  ON public.pending_inbound_transfers FOR SELECT
  USING (auth.uid() = sender_user_id);

CREATE POLICY "Admins view all pending inbound"
  ON public.pending_inbound_transfers FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
