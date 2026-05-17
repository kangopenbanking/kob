ALTER TABLE public.webhook_deliveries  ADD COLUMN IF NOT EXISTS trace_id text;
ALTER TABLE public.gateway_charges     ADD COLUMN IF NOT EXISTS trace_id text;
ALTER TABLE public.safeguarding_ledger ADD COLUMN IF NOT EXISTS trace_id text;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_trace_id  ON public.webhook_deliveries(trace_id)  WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gateway_charges_trace_id     ON public.gateway_charges(trace_id)     WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_safeguarding_ledger_trace_id ON public.safeguarding_ledger(trace_id) WHERE trace_id IS NOT NULL;