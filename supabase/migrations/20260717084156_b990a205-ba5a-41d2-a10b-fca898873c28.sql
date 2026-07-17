-- Phase 1B-R1I-c.3R-F — Atomic round-up instruction creation gate
-- Single-statement INSERT ... SELECT that only fires when roundup_settings.enabled = true
-- for the given consumer. Closes the disable/instruction-creation race deterministically.

CREATE OR REPLACE FUNCTION public.roundup_insert_if_enabled(
  p_consumer_id       uuid,
  p_source_tx_id      text,
  p_source_kind       text,
  p_source_account_id uuid,
  p_bank_id           uuid,
  p_merchant_name     text,
  p_goal_id           uuid,
  p_original_amount   numeric,
  p_rounded_amount    numeric,
  p_roundup_amount    numeric,
  p_threshold_used    integer,
  p_idempotency_key   text,
  p_state             text,
  p_skip_reason       text
)
RETURNS SETOF public.roundup_transactions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.roundup_transactions (
    consumer_id, source_tx_id, source_kind, source_account_id, bank_id,
    merchant_name, goal_id, original_amount, rounded_amount, roundup_amount,
    threshold_used, idempotency_key, state, skip_reason
  )
  SELECT
    p_consumer_id, p_source_tx_id, p_source_kind, p_source_account_id, p_bank_id,
    p_merchant_name,
    -- Block linking to an archived goal atomically as part of the same statement.
    CASE
      WHEN p_goal_id IS NULL THEN NULL
      WHEN EXISTS (
        SELECT 1 FROM public.savings_goals g
        WHERE g.id = p_goal_id
          AND g.consumer_id = p_consumer_id
          AND g.status = 'archived'
      ) THEN NULL
      ELSE p_goal_id
    END,
    p_original_amount, p_rounded_amount, p_roundup_amount,
    p_threshold_used, p_idempotency_key, p_state, p_skip_reason
  FROM public.roundup_settings s
  WHERE s.consumer_id = p_consumer_id
    AND s.enabled = true
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.roundup_insert_if_enabled(
  uuid, text, text, uuid, uuid, text, uuid, numeric, numeric, numeric,
  integer, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.roundup_insert_if_enabled(
  uuid, text, text, uuid, uuid, text, uuid, numeric, numeric, numeric,
  integer, text, text, text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.roundup_insert_if_enabled(
  uuid, text, text, uuid, uuid, text, uuid, numeric, numeric, numeric,
  integer, text, text, text
) IS
  'Phase 1B-R1I-c.3R-F atomic gate: creates a roundup_transactions row only when roundup_settings.enabled = true for the consumer, in one statement. Returns 0 rows if disabled. Also nulls goal_id atomically if the target savings_goal is archived.';
