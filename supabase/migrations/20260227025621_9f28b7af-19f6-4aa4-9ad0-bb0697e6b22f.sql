
-- Funding Intents: canonical table for account funding lifecycle
CREATE TABLE public.funding_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  user_id uuid NOT NULL,
  institution_id uuid REFERENCES public.institutions(id),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'XAF',
  method text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'created',
  reference text,
  idempotency_key text,
  provider_reference text,
  provider_payload jsonb DEFAULT '{}',
  failure_code text,
  failure_message text,
  fee_amount numeric DEFAULT 0,
  net_amount numeric DEFAULT 0,
  next_action jsonb,
  return_url text,
  metadata jsonb DEFAULT '{}',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique idempotency per account
CREATE UNIQUE INDEX idx_funding_intents_idempotency ON public.funding_intents (account_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_funding_intents_user ON public.funding_intents (user_id);
CREATE INDEX idx_funding_intents_status ON public.funding_intents (status);
CREATE INDEX idx_funding_intents_provider_ref ON public.funding_intents (provider_reference) WHERE provider_reference IS NOT NULL;

-- Funding Events: immutable history
CREATE TABLE public.funding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_intent_id uuid NOT NULL REFERENCES public.funding_intents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_funding_events_intent ON public.funding_events (funding_intent_id);

-- Auto-update updated_at trigger
CREATE TRIGGER update_funding_intents_updated_at
  BEFORE UPDATE ON public.funding_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for funding_intents
ALTER TABLE public.funding_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own funding intents" ON public.funding_intents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own funding intents" ON public.funding_intents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access funding intents" ON public.funding_intents
  FOR ALL USING (true) WITH CHECK (true);

-- RLS for funding_events
ALTER TABLE public.funding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own funding events" ON public.funding_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.funding_intents fi WHERE fi.id = funding_intent_id AND fi.user_id = auth.uid())
  );

CREATE POLICY "Service role full access funding events" ON public.funding_events
  FOR ALL USING (true) WITH CHECK (true);
