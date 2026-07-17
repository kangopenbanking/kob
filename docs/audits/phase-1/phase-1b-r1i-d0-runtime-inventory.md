# Phase 1B — R1I-d.0 — Runtime Handler Pagination Inventory

**Scope:** Trace each of the 77 collection operations from the OpenAPI path → Edge Function router → handler → database query → response mapper. Classify runtime pagination behaviour.

## 1. Runtime classes observed

| Class | Definition | Count (approx.) |
|-------|-----------|-----------------|
| CURSOR | Opaque token decoded server-side; forward/backward with tie-breaker. | 6 (AISP + consents reference implementations) |
| KEYSET | `where (created_at, id) < (…)` style keyset scans. | 0 confirmed |
| OFFSET_LIMIT | Postgres `.range()` / `LIMIT/OFFSET`. | ~55 (bulk of gateway/admin/webhooks/ledger/loans/savings) |
| PAGE_LIMIT | 1-based page × per_page → offset. | ~4 (legacy admin + `agentList`) |
| FIXED_LIMIT_ONLY | Handler enforces a constant, ignores request. | ~3 (`cemacCorridorsList`, `banksList` in some branches, `merchantsQrDirectoryList`) |
| IN_MEMORY_SLICE | Fetch all rows then `.slice(...)` in JS. | Suspected on `gatewayReportTransactions`, `gatewayReportSettlements`, `safeguardingSnapshots` (report aggregation) |
| PROVIDER_PAGINATION | Nium / bank-connector token pass-through. | `gatewayListRefunds`, `gatewayListPayouts` fall through to provider on some branches |
| UNBOUNDED | No `.limit()` at all. | Suspected: `listWebhookDlq`, `agentTransactionList`, `cemacCorridorsList` |
| NOT_IMPLEMENTED | Router returns 501 or falls through. | 0 confirmed for GETs in scope |
| UNKNOWN | Cannot be classified from static reading alone. | ~4 |

Counts are inferred from a static walk of `supabase/functions/*/index.ts` — every handler was not opened line-by-line under this read-only slice; the mismatch register (§16 of the master decision doc) flags the operations that require a *runtime* opening in R1I-d.1.

## 2. Reference-implementation handlers (CURSOR)

- `supabase/functions/aisp-accounts/index.ts` — decodes `starting_after`/`ending_before`, tie-breaker `(created_at, id)`, emits `X-Pagination-*` headers.
- `supabase/functions/aisp-transactions/index.ts` — same pattern, plus `from_date` / `to_date` filters.
- `supabase/functions/consents/index.ts` — same pattern.

These three establish the **de facto KOB cursor convention** and are the template R1I-d.1 must broaden.

## 3. Handlers with observable defects

| Operation | Handler file | Defect class | Notes |
|-----------|--------------|--------------|-------|
| `gatewayListCharges` | `supabase/functions/gateway-charges/index.ts` | OFFSET_LIMIT, ordering `created_at DESC` **without** `id` tie-breaker | Duplicate/omission risk under concurrent inserts. |
| `gatewayListPayouts` | `supabase/functions/gateway-payouts/index.ts` | OFFSET_LIMIT + provider fallthrough | Provider cursor discarded; count mixes local + provider. |
| `gatewayListRefunds` | `supabase/functions/gateway-refunds/index.ts` | OFFSET_LIMIT, no tenant predicate on count query (suspected) | Requires runtime open in d.1. |
| `webhookDeliveries` | `supabase/functions/webhook-deliveries/index.ts` | OFFSET_LIMIT, ordering by `created_at DESC`, no tie-breaker | High-volume table — offset scan cost. |
| `listWebhookDlq` | `supabase/functions/webhook-dlq/index.ts` | Suspected FIXED_LIMIT_ONLY / UNBOUNDED (array response) | Admin-only, but still risk. |
| `adminTransactionReview` | `supabase/functions/admin-transaction-review/index.ts` | OFFSET_LIMIT across tenants; admin filter | Cross-tenant scan; must confirm scope predicate presence. |
| `journalList` | `supabase/functions/ledger-journal/index.ts` | OFFSET_LIMIT, order `posted_at DESC` — collisions possible | Needs `(posted_at, journal_id)` tie-breaker. |
| `gatewayReportTransactions` / `gatewayReportSettlements` | `supabase/functions/gateway-reports/index.ts` | Suspected IN_MEMORY_SLICE across aggregation | Report endpoint that ended up on `/gateway/reports` — decide stream vs paged. |
| `agentTransactionList` | `supabase/functions/agent-list/index.ts` (shared router) | UNBOUNDED / FIXED — array response | Contract debt matches runtime debt. |
| `cemacCorridorsList` | `supabase/functions/cemac-corridors/index.ts` | Static reference list; likely bounded exempt. | Confirm bound < 100. |
| `banksList` | `supabase/functions/banks/index.ts` | Static reference list; bounded exempt candidate. | Country × bank code cardinality. |

## 4. Systemic runtime debts

1. **No shared cursor codec.** Cursor implementation is copy-pasted across AISP/consents. Every future paginated endpoint reinvents encoding — a shared helper (`supabase/functions/_shared/pagination.ts`) is proposed for d.1.
2. **Response header emission is not centralised.** Only 3 handlers emit `X-Pagination-*`. Contract vs runtime diverge on the other 74.
3. **Count semantics are inconsistent.** Some handlers return `has_more = data.length === limit` (correct heuristic), others attempt exact `head:true, count:'exact'` queries against high-volume tables (potentially slow), others omit `meta.total` entirely while the response envelope schema advertises `meta`.
4. **Tenant predicates on count queries** were confirmed identical on AISP references; not confirmed on gateway/admin — flagged for opening in d.1.
5. **Provider pagination** (Nium listings via `gatewayListPayouts`, some `gatewayListCharges` branches) discards provider `next_page_token` and re-derives from local mirror. Deferred to the provider-adapter slice.

## 5. Read-only status

No handler code inspected under version control was modified. This document is inference-based on the file inventory produced by `rg` and the auth-carrying handler headers observed in prior slices — a *depth pass* is proposed as the first task of R1I-d.1.
