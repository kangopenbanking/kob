
CREATE TABLE IF NOT EXISTS public.card_fee_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid REFERENCES public.virtual_cards(id) ON DELETE SET NULL,
  fee_type text NOT NULL CHECK (fee_type IN ('card_issuance_fee','card_maintenance_fee','card_transaction_fee')),
  amount numeric(15,2) NOT NULL,
  currency text NOT NULL DEFAULT 'XAF',
  wallet_account_id uuid,
  idempotency_key text NOT NULL,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key, fee_type)
);

GRANT SELECT ON public.card_fee_events TO authenticated;
GRANT ALL ON public.card_fee_events TO service_role;

ALTER TABLE public.card_fee_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own card fee events"
  ON public.card_fee_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_card_fee_events_user ON public.card_fee_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_fee_events_card ON public.card_fee_events(card_id);
CREATE INDEX IF NOT EXISTS idx_card_fee_events_type ON public.card_fee_events(fee_type, created_at DESC);
