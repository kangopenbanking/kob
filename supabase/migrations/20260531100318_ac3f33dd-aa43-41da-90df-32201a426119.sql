
-- Unique serial registry: one row per (source, scope_id, period_from, period_to, account_no).
CREATE TABLE public.statement_serials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  serial TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('customer','banking')),
  scope_id TEXT NOT NULL,           -- 'kang' for customer, institution_id for banking
  account_no TEXT NOT NULL,
  user_id UUID NOT NULL,
  period_from TIMESTAMPTZ NOT NULL,
  period_to TIMESTAMPTZ NOT NULL,
  sequence_no BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT statement_serials_unique_scope
    UNIQUE (source, scope_id, account_no, period_from, period_to)
);

-- Per-scope incrementing sequence helper
CREATE TABLE public.statement_serial_counters (
  source TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  last_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, scope_id)
);

GRANT SELECT ON public.statement_serials TO authenticated;
GRANT ALL ON public.statement_serials TO service_role;
GRANT ALL ON public.statement_serial_counters TO service_role;

ALTER TABLE public.statement_serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_serial_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own statement serials"
ON public.statement_serials FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Download audit
CREATE TABLE public.statement_download_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('customer','banking')),
  scope_id TEXT NOT NULL,
  account_no TEXT NOT NULL,
  serial TEXT NOT NULL,
  period_from TIMESTAMPTZ NOT NULL,
  period_to TIMESTAMPTZ NOT NULL,
  tx_count INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.statement_download_audit TO authenticated;
GRANT ALL ON public.statement_download_audit TO service_role;
ALTER TABLE public.statement_download_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own download audit"
ON public.statement_download_audit FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_stmt_audit_user ON public.statement_download_audit(user_id, created_at DESC);

-- Allocation RPC: atomically reserve a unique serial per scope+period+account.
-- If one already exists for that exact scope, return it (idempotent).
CREATE OR REPLACE FUNCTION public.allocate_statement_serial(
  p_source TEXT,
  p_scope_id TEXT,
  p_account_no TEXT,
  p_user_id UUID,
  p_period_from TIMESTAMPTZ,
  p_period_to TIMESTAMPTZ
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing TEXT;
  v_seq BIGINT;
  v_prefix TEXT;
  v_scope_short TEXT;
  v_serial TEXT;
BEGIN
  IF p_source NOT IN ('customer','banking') THEN
    RAISE EXCEPTION 'invalid source';
  END IF;

  -- Idempotent: reuse existing serial for exact (source,scope,account,period)
  SELECT serial INTO v_existing
  FROM public.statement_serials
  WHERE source = p_source
    AND scope_id = p_scope_id
    AND account_no = p_account_no
    AND period_from = p_period_from
    AND period_to = p_period_to
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Bump per-scope counter atomically
  INSERT INTO public.statement_serial_counters (source, scope_id, last_value, updated_at)
  VALUES (p_source, p_scope_id, 1, now())
  ON CONFLICT (source, scope_id)
  DO UPDATE SET last_value = statement_serial_counters.last_value + 1, updated_at = now()
  RETURNING last_value INTO v_seq;

  v_prefix := CASE WHEN p_source = 'customer' THEN 'KANG' ELSE 'BANK' END;
  v_scope_short := UPPER(SUBSTRING(REGEXP_REPLACE(p_scope_id, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 6));
  IF v_scope_short = '' THEN v_scope_short := 'GEN'; END IF;

  v_serial := v_prefix || '-' || v_scope_short || '-' ||
              TO_CHAR(p_period_from AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
              TO_CHAR(p_period_to AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
              LPAD(v_seq::TEXT, 8, '0');

  INSERT INTO public.statement_serials
    (serial, source, scope_id, account_no, user_id, period_from, period_to, sequence_no)
  VALUES
    (v_serial, p_source, p_scope_id, p_account_no, p_user_id, p_period_from, p_period_to, v_seq);

  RETURN v_serial;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_statement_serial(TEXT,TEXT,TEXT,UUID,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_statement_serial(TEXT,TEXT,TEXT,UUID,TIMESTAMPTZ,TIMESTAMPTZ) TO authenticated, service_role;
