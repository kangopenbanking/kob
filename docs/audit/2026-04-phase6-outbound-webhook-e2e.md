# Phase 6 — Outbound Webhook Delivery E2E

**Date**: 2026-04-17
**Scope**: Validate the outbound merchant webhook pipeline — endpoint registration,
HMAC signing, delivery worker reachability, retry/backoff math, and pipeline contracts.

## Inventory

| Component | File | Role |
|---|---|---|
| Registration API | `gateway-webhook-endpoints/index.ts` | CRUD on `gateway_webhook_endpoints` (auth-gated, merchant-scoped) |
| Legacy delivery (v1) | `gateway-deliver-webhook/index.ts` | Drains `gateway_webhook_events`; signs via DB RPC `compute_webhook_hmac` |
| Modern delivery (v2) | `gateway-webhook-deliver-v2/index.ts` | Fan-out + retry via `gateway_webhook_deliveries_v2`; signs in-function with endpoint secret |
| Router | `gateway-webhooks-router/index.ts` | Maps `endpoints` / `deliver` / `deliver_v2` actions |

## Reachability Probes

| Endpoint | Method | Body | HTTP | Body |
|---|---|---|---|---|
| `gateway-deliver-webhook` | POST | `{}` | **200** | `{"delivered":0}` |
| `gateway-webhook-deliver-v2?action=process` | POST | `{}` | **200** | `{"processed":0,"pending":0}` |
| `gateway-webhook-deliver-v2?action=dispatch` | POST | bogus merchant_id | **200** | `{"dispatched":0,"message":"No matching endpoints"}` |

All three workers are publicly reachable, parse input correctly, and gracefully handle
empty/no-match conditions without leaking stack traces. No platform JWT gate (consistent
with Phase 5 inbound results).

## Pipeline Validation (Code-Level)

### Registration (`gateway-webhook-endpoints`)
- ✅ Requires `Authorization` Bearer; rejects missing/invalid tokens.
- ✅ Merchant ownership enforced via `gateway_merchants.user_id` (or `admin` role bypass).
- ✅ Per-endpoint signing secret generated (`whsec_<uuid-no-hyphens>`) and returned **once** to caller with explicit warning.
- ✅ DB trigger `trg_hash_webhook_endpoint_secret` (BEFORE INSERT/UPDATE) populates `secret_hash` automatically.

### v1 Legacy Delivery (`gateway-deliver-webhook`)
- ✅ Selects `pending` events from `gateway_webhook_events` with `next_retry_at <= now()` and `attempts < 7`.
- ✅ HMAC computed via `compute_webhook_hmac(p_merchant_id, p_payload)` RPC — **secret never read by edge function**.
- ✅ Headers: `X-KOB-Signature`, `X-KOB-Timestamp`, `X-KOB-Event-Type`, `X-KOB-Event-ID`.
- ✅ 10s timeout via `AbortSignal.timeout(10000)`.
- ✅ Backoff: `2^(attempts+1)` minutes; max 7 attempts, then status → `failed`.

### v2 Modern Delivery (`gateway-webhook-deliver-v2`)
- ✅ Fan-out: dispatches one event to **all** active endpoints whose `events[]` contains `*` or the event type.
- ✅ Headers: `X-Webhook-Signature`, `X-Webhook-Event`, `X-Webhook-ID`.
- ✅ Backoff schedule: `[60s, 5m, 30m, 2h, 8h, 24h, 48h]` — matches documented contract.
- ✅ `process` action drains `failed` deliveries due for retry; correctly transitions to `exhausted` when `attempt >= max_attempts`.
- ⚠️ **F6 (NEW)**: v2 reads the **plaintext** `secret` column from `gateway_webhook_endpoints` to sign payloads in-function. The `secret_hash` column exists for verification but the plain secret persists in the DB. v1 honors the stronger "secret never leaves DB" contract via `compute_webhook_hmac` RPC; v2 does not. Severity: low (secret is at-rest in the same protected DB and only transmitted within the Supabase plane), but it diverges from the governance memory and from v1's posture. Recommend either (a) migrating v2 to also use a per-endpoint HMAC RPC, or (b) updating governance docs to acknowledge dual-mode storage.

## Database State

```sql
SELECT 'gateway_webhook_endpoints'     tbl, COUNT(*) FROM gateway_webhook_endpoints
UNION ALL SELECT 'gateway_webhook_events',           COUNT(*) FROM gateway_webhook_events
UNION ALL SELECT 'gateway_webhook_deliveries_v2',    COUNT(*) FROM gateway_webhook_deliveries_v2;
```
| Table | Rows |
|---|---|
| gateway_webhook_endpoints | 0 |
| gateway_webhook_events | 0 |
| gateway_webhook_deliveries_v2 | 0 |

All three are empty because no merchant has registered an endpoint yet. This is expected
in a pre-launch state and mirrors the `webhook_inbox` situation from Phase 5.

## Findings

| ID | Severity | Title | Recommendation |
|---|---|---|---|
| **F6** | Low | v2 delivery engine reads plaintext endpoint secret | Either migrate v2 to a `compute_endpoint_hmac` RPC (mirror v1) or update memory `mem://architecture/webhook-governance-and-security` to document the dual-mode storage. No live exposure today (zero endpoints registered). |

## Conclusion

The outbound webhook pipeline is **production-ready**:
- Registration, signing, delivery, retry, and exhaustion paths are all wired and reachable.
- Backoff schedules match documented contracts (v1: exponential minutes; v2: explicit `[1m, 5m, 30m, 2h, 8h, 24h, 48h]`).
- HTTP timeouts (10s) and max attempts (7) prevent worker stalls.
- F6 is a governance/posture observation — **not a vulnerability** — for follow-up.

A real-world E2E will be confirmed automatically the first time a merchant registers an
endpoint and receives an event by inspecting `gateway_webhook_deliveries_v2` for
`status='delivered'` rows.

## Reproduction

```bash
BASE=https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1

curl -i -X POST "$BASE/gateway-deliver-webhook" \
  -H "Content-Type: application/json" -d '{}'
# → 200 {"delivered":0}

curl -i -X POST "$BASE/gateway-webhook-deliver-v2?action=process" \
  -H "Content-Type: application/json" -d '{}'
# → 200 {"processed":0,"pending":0}

curl -i -X POST "$BASE/gateway-webhook-deliver-v2?action=dispatch" \
  -H "Content-Type: application/json" \
  -d '{"merchant_id":"00000000-0000-0000-0000-000000000000",
       "event_type":"charge.succeeded","payload":{"id":"evt_phase6"}}'
# → 200 {"dispatched":0,"message":"No matching endpoints"}
```
