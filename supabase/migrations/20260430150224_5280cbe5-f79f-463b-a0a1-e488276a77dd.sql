-- Slice 6 — Webhook Dead-Letter Queue (additive)

-- 1. Augment webhook_inbox with retry tracking columns
ALTER TABLE public.webhook_inbox
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_permanently_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dlq_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_retry_scan
  ON public.webhook_inbox (status, next_retry_at)
  WHERE is_processed = false;

-- 2. Dead-Letter Queue table
CREATE TABLE IF NOT EXISTS public.webhook_inbox_dlq (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_inbox_id UUID,
  source TEXT NOT NULL,
  provider TEXT,
  event_id TEXT,
  event_type TEXT,
  payload JSONB NOT NULL,
  signature TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  dlq_reason TEXT NOT NULL,
  original_received_at TIMESTAMPTZ,
  moved_to_dlq_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replayed_at TIMESTAMPTZ,
  replay_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_source ON public.webhook_inbox_dlq (source, moved_to_dlq_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_event ON public.webhook_inbox_dlq (event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_unreplayed ON public.webhook_inbox_dlq (moved_to_dlq_at DESC) WHERE replayed_at IS NULL;

ALTER TABLE public.webhook_inbox_dlq ENABLE ROW LEVEL SECURITY;

-- Admin read-only access (service role bypasses RLS automatically)
CREATE POLICY "Admins can view DLQ entries"
  ON public.webhook_inbox_dlq
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access on webhook_inbox_dlq"
  ON public.webhook_inbox_dlq
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Helper to move a row to DLQ atomically
CREATE OR REPLACE FUNCTION public.move_webhook_to_dlq(
  p_inbox_id UUID,
  p_reason TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dlq_id UUID;
  v_row public.webhook_inbox%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.webhook_inbox WHERE id = p_inbox_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'webhook_inbox row % not found', p_inbox_id;
  END IF;

  INSERT INTO public.webhook_inbox_dlq (
    original_inbox_id, source, provider, event_id, event_type,
    payload, signature, attempt_count, last_error, dlq_reason,
    original_received_at
  ) VALUES (
    v_row.id, v_row.source, v_row.provider, v_row.event_id, v_row.event_type,
    v_row.payload, v_row.signature, COALESCE(v_row.attempt_count, 0),
    v_row.processing_error, p_reason, v_row.created_at
  )
  RETURNING id INTO v_dlq_id;

  UPDATE public.webhook_inbox
     SET status = 'failed_permanently',
         failed_permanently_at = now(),
         dlq_reason = p_reason,
         is_processed = true,
         processed_at = now()
   WHERE id = p_inbox_id;

  RETURN v_dlq_id;
END;
$$;

REVOKE ALL ON FUNCTION public.move_webhook_to_dlq(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_webhook_to_dlq(UUID, TEXT) TO service_role;