-- P1-G: Reconcile webhook_inbox schema with what the three provider receivers
-- (gateway-webhook-stripe / gateway-webhook-flutterwave / gateway-webhook-paypal)
-- already write. Additive only — no DROP, no RENAME. Standing Order 1 (The Lock)
-- preserved: existing `source` and `is_processed` columns are kept.
--
-- Justification standard: internal audit
-- docs/internal/provider-webhooks-report.md (2026-04-30) — receivers were
-- inserting non-existent columns, causing silent failure of the inbound
-- audit trail (live row count: 0 in webhook_inbox).

ALTER TABLE public.webhook_inbox
  ADD COLUMN IF NOT EXISTS provider   text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS status     text NOT NULL DEFAULT 'received';

-- Backfill: any historical rows that used the legacy `source` column
-- get their `provider` value mirrored across, so downstream consumers can
-- standardize on `provider` going forward without losing history.
UPDATE public.webhook_inbox
   SET provider = source
 WHERE provider IS NULL
   AND source   IS NOT NULL;

-- Indexes — match the access patterns used by the receivers
-- (event_id lookup for dedupe; provider+status for replay/admin queries).
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_event_id
  ON public.webhook_inbox (event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_provider_status
  ON public.webhook_inbox (provider, status);

-- Document the additive nature of this change in the column comment so
-- future migrations don't accidentally drop the legacy `source` column.
COMMENT ON COLUMN public.webhook_inbox.source IS
  'LEGACY — kept for backward compatibility (Standing Order 1). New writers should populate `provider` instead.';

COMMENT ON COLUMN public.webhook_inbox.provider IS
  'Provider that emitted the webhook event: stripe | flutterwave | paypal | etc.';

COMMENT ON COLUMN public.webhook_inbox.status IS
  'Lifecycle of the inbound event: received | processing | processed | failed | dead_letter.';