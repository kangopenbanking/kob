# Inbound Provider Webhooks Report (Phase 0, read-only)

**Receivers audited:** `gateway-webhook-stripe`, `gateway-webhook-flutterwave`, `gateway-webhook-paypal`

## Per-receiver checklist

| Check | Stripe | Flutterwave | PayPal |
|---|---|---|---|
| Spec endpoint declared (`POST /webhooks/{provider}`) | ✅ | ✅ | ✅ |
| Edge function exists (`supabase/functions/gateway-webhook-{provider}/index.ts`) | ✅ 207 LOC | ✅ 306 LOC | ✅ 247 LOC |
| Verifies signature header | ✅ `stripe-signature` HMAC | ✅ `verif-hash` constant-time compare | ✅ PayPal cert-url + algo verify (`verifyPayPalWebhookSignature` in `_shared/gateway-adapters.ts`) |
| Returns `401 invalid_signature` on failure | ✅ | ✅ | ✅ |
| Deduplicates by event id | ✅ `event_id` lookup | ✅ `event_id` lookup | ✅ `paypal_${eventId}` lookup |
| Persists raw event before processing | ✅ writes to `webhook_inbox` | ✅ writes to `webhook_inbox` | ✅ writes to `webhook_inbox` |
| Triggers internal state updates (charge/refund/payout/subscription) | ✅ | ✅ | ✅ payout status mapping → `gateway_payouts` |
| Records processing status / error | ✅ updates `status` to `processed` on success | ✅ same | ✅ same |
| Replay tooling | ✅ `admin-webhook-replay` (147 LOC) + `gateway-webhook-replay-delivery` |
| Retry-safe (re-entry produces `already_processed`) | ✅ | ✅ | ✅ |

## 🔴 Real bug discovered: schema mismatch on `webhook_inbox`

**Severity:** High — silently breaks all inbound webhook persistence in production.

### Evidence

`webhook_inbox` table columns (live DB query):

```
id, source, event_id, payload, signature, is_processed, processed_at, processing_error, created_at
```

But all three receivers write columns that **do not exist**:

```ts
await supabase.from('webhook_inbox').insert({
  event_id: dedupeKey,
  provider: 'stripe',          // ← column missing (table has `source`)
  event_type: event.type,      // ← column missing
  payload: event,
  status: 'processing',        // ← column missing (table has `is_processed`)
});
```

Live row count in `webhook_inbox`: **0**. The inserts are failing silently (likely caught by the surrounding try/catch and not surfaced).

### Why CI didn't catch it

- Webhook receivers are not in the Vitest contract suite — they're tested only via `supabase--test_edge_functions` Deno tests, which (per the existing test files) mock the supabase client and don't validate against the real schema.
- Dedupe lookup (`select('id').eq('event_id', dedupeKey)`) succeeds because the SELECT only references columns that DO exist. It just always returns nothing, so every event passes the dedupe check.
- Downstream state updates (`gateway_payouts`, `gateway_charges`) DO succeed — the providers' actions take effect — but the audit/replay trail is empty.

### Fix plan (Phase 1 — DB-additive, no breakage)

Two safe paths, listed in order of preference:

**Option A — Reconcile receiver code to existing table (1 migration + 3 edge function patches):**
- Edit each receiver to use `source` instead of `provider`, drop `event_type` (or alias it into `payload.event_type`), use `is_processed:false` instead of `status:'processing'`, and `is_processed:true` + `processed_at: now()` on completion.
- No DB migration needed.
- Risk: code-only.

**Option B — Migrate table to richer schema (preferred for observability):**
- Additive migration:
  ```sql
  ALTER TABLE public.webhook_inbox
    ADD COLUMN IF NOT EXISTS provider text,
    ADD COLUMN IF NOT EXISTS event_type text,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'received';
  -- backfill: source -> provider where provider is null
  UPDATE public.webhook_inbox SET provider = source WHERE provider IS NULL AND source IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_webhook_inbox_provider_status ON public.webhook_inbox (provider, status);
  CREATE INDEX IF NOT EXISTS idx_webhook_inbox_event_id ON public.webhook_inbox (event_id);
  ```
- Receivers continue writing the same fields — they will start working immediately.
- `source` column kept for backward compatibility (Standing Order 1 — The Lock).
- Risk: low. Additive only.

**Recommendation: Option B.** Better observability, no code edits to live receivers, idempotent migration.

### Permission gate

This fix touches:
- `public.webhook_inbox` (DB) — additive only.
- No edge function code changes required.
- No spec changes required.

Per `KOB_PERMISSION_GRANTED` policy, additive DB changes are pre-approved. **However, fix is held for explicit Phase 1 approval per the user's "Phase 0 only" directive.**

## Summary

| Aspect | Status |
|---|---|
| All 3 receivers exist + verify signatures + deduplicate | ✅ |
| Replay tooling exists (`admin-webhook-replay`) | ✅ |
| Persistence to `webhook_inbox` | ❌ silently failing — schema mismatch |
| Production impact | Provider events ARE acted on (downstream tables updated). Audit trail is empty. |
| Fix complexity | 1 additive migration |

Awaiting approval to apply Phase 1 fix Option B.
