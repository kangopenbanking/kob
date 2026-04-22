-- 1) Dynamic per-department intake fields + SLA target override
ALTER TABLE public.support_departments
  ADD COLUMN IF NOT EXISTS intake_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sla_target_minutes INTEGER NOT NULL DEFAULT 15;

COMMENT ON COLUMN public.support_departments.intake_fields IS
  'Array of {key,label,type,required,placeholder,options?} objects rendered before chat starts.';

-- Seed sensible defaults for existing departments (idempotent)
UPDATE public.support_departments
SET intake_fields = '[
  {"key":"order_id","label":"Order or transaction ID","type":"text","required":false,"placeholder":"e.g. TX-12345"}
]'::jsonb
WHERE name = 'Payments & Transfers' AND (intake_fields = '[]'::jsonb OR intake_fields IS NULL);

UPDATE public.support_departments
SET intake_fields = '[
  {"key":"account_id","label":"Account or RIB","type":"text","required":false,"placeholder":"23-digit RIB or account ID"}
]'::jsonb
WHERE name = 'Account & Security' AND (intake_fields = '[]'::jsonb OR intake_fields IS NULL);

UPDATE public.support_departments
SET intake_fields = '[
  {"key":"invoice_id","label":"Invoice or fee reference","type":"text","required":false,"placeholder":"e.g. INV-2026-001"}
]'::jsonb
WHERE name = 'Billing & Fees' AND (intake_fields = '[]'::jsonb OR intake_fields IS NULL);

UPDATE public.support_departments
SET intake_fields = '[
  {"key":"app_area","label":"Where did the issue occur?","type":"select","required":false,"options":["Web","iOS","Android","API"]},
  {"key":"error_code","label":"Error code (if any)","type":"text","required":false,"placeholder":"e.g. 500, ECONNRESET"}
]'::jsonb
WHERE name = 'Technical Support' AND (intake_fields = '[]'::jsonb OR intake_fields IS NULL);

-- 2) Lightweight per-guest/IP/user rate-limit ledger (ad-hoc; backend lacks proper primitives)
CREATE TABLE IF NOT EXISTS public.support_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity TEXT NOT NULL,            -- guest_id or user_id (or hashed IP)
  action TEXT NOT NULL,              -- 'create_conversation' | 'send_message'
  window_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', now()),
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_rl_unique
  ON public.support_rate_limits (identity, action, window_start);
CREATE INDEX IF NOT EXISTS idx_support_rl_recent
  ON public.support_rate_limits (identity, action, window_start DESC);

ALTER TABLE public.support_rate_limits ENABLE ROW LEVEL SECURITY;
-- Only the service-side RPC reads/writes; no direct row access from clients.
DROP POLICY IF EXISTS "No direct access" ON public.support_rate_limits;
CREATE POLICY "No direct access" ON public.support_rate_limits FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.support_check_rate_limit(
  p_identity TEXT,
  p_action TEXT,
  p_max_per_minute INTEGER DEFAULT 5,
  p_max_per_hour INTEGER DEFAULT 60
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_minute_bucket TIMESTAMPTZ := date_trunc('minute', v_now);
  v_minute_count INTEGER;
  v_hour_count INTEGER;
BEGIN
  IF p_identity IS NULL OR length(p_identity) = 0 THEN
    RETURN QUERY SELECT TRUE, p_max_per_minute, 0;
    RETURN;
  END IF;

  -- Upsert this minute bucket
  INSERT INTO public.support_rate_limits (identity, action, window_start, count)
  VALUES (p_identity, p_action, v_minute_bucket, 1)
  ON CONFLICT (identity, action, window_start)
  DO UPDATE SET count = public.support_rate_limits.count + 1, updated_at = v_now
  RETURNING count INTO v_minute_count;

  SELECT COALESCE(SUM(count), 0)::INTEGER INTO v_hour_count
  FROM public.support_rate_limits
  WHERE identity = p_identity AND action = p_action
    AND window_start > v_now - INTERVAL '1 hour';

  IF v_minute_count > p_max_per_minute THEN
    RETURN QUERY SELECT FALSE, 0, 60 - EXTRACT(SECOND FROM v_now)::INTEGER;
    RETURN;
  END IF;
  IF v_hour_count > p_max_per_hour THEN
    RETURN QUERY SELECT FALSE, 0, 3600;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, GREATEST(p_max_per_minute - v_minute_count, 0), 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.support_check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;

-- 3) Storage policies so guests can upload to their own folder ('guest/<guest_id>/...')
-- Storage path convention: '<identity>/<timestamp>-<rand>.<ext>' where identity = userId or 'guest_<guest_id>'
DROP POLICY IF EXISTS "Anonymous upload to own guest folder" ON storage.objects;
CREATE POLICY "Anonymous upload to own guest folder"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND (storage.foldername(name))[1] LIKE 'guest_%'
);

DROP POLICY IF EXISTS "Anonymous read own guest folder" ON storage.objects;
CREATE POLICY "Anonymous read own guest folder"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'support-attachments'
  AND (storage.foldername(name))[1] LIKE 'guest_%'
);

-- 4) Make the SLA breach trigger respect per-department targets when set
CREATE OR REPLACE FUNCTION public.support_set_conversation_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minutes INTEGER;
BEGIN
  IF NEW.sla_target_minutes IS NULL OR NEW.sla_target_minutes = 0 THEN
    SELECT COALESCE(sla_target_minutes, 15) INTO v_minutes
    FROM public.support_departments WHERE id = NEW.department_id;
    NEW.sla_target_minutes := COALESCE(v_minutes, 15);
  END IF;
  IF NEW.sla_breach_at IS NULL THEN
    NEW.sla_breach_at := COALESCE(NEW.created_at, now()) + (NEW.sla_target_minutes || ' minutes')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_set_conversation_sla_trg ON public.support_conversations;
CREATE TRIGGER support_set_conversation_sla_trg
BEFORE INSERT ON public.support_conversations
FOR EACH ROW EXECUTE FUNCTION public.support_set_conversation_sla();