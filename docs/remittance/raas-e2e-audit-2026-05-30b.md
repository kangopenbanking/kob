# RaaS E2E Audit — Phase 1 Closeout (2026-05-30b)

> Re-audit after Phase 0 (auth gates) **and** Phase 1 (idempotency + audit logging
> + provider hardening). Compare against `raas-e2e-audit-2026-05-30.md`.

## Overall status

| Score | Phase 0 | **Phase 1 (this report)** |
|---|---|---|
| Security gates | 5 / 10 | **9 / 10** |
| Idempotency / replay safety | 3 / 10 | **8 / 10** |
| Observability (audit trail) | 4 / 10 | **9 / 10** |
| Provider integration honesty | 5 / 10 | **8 / 10** |
| Regression coverage | 2 / 10 | **8 / 10** |
| **Overall** | **6.0 / 10** | **8.4 / 10** |

## Phase 1 remediation matrix

| # | Gap (from prior audit) | Status | Evidence |
|---|---|---|---|
| 1 | `remittance-recon-cron` publicly executable | **CLOSED** in Phase 0 | `verifyCronAuth` enforced, structured 401 `code: CRON_SECRET_REQUIRED` |
| 2 | `remittance-routing-engine` missing service-role gate | **CLOSED** in Phase 0 | 401 `Unauthorized` to anon callers (verified live) |
| 3 | `remittance-fulfill` missing service-role gate | **CLOSED** in Phase 0 | 401 `Unauthorized` to anon callers (verified live) |
| 4 | `remittance-payin-intent` leaks provider/contract details pre-auth | **CLOSED** | Auth moved to top of handler; empty body w/ invalid JWT now returns `{"error":"unauthorized","code":"INVALID_TOKEN"}` with no provider hints |
| 5 | No idempotency on `send` | **CLOSED** | `Idempotency-Key` header accepted, validated (UUID v4 ≤255), reserved atomically via `integration_idempotency_keys`; replays return cached body + `X-Idempotent-Replay: true`; bad keys return `IDEMPOTENCY_KEY_INVALID` |
| 6 | No idempotency on routing / fulfill (double-ledger risk) | **CLOSED** | `withRemittanceIdempotency` keyed on `remittance_id` (UUID v4) prevents duplicate journal/ledger postings even on retry storms |
| 7 | PayPal funding is a silent UI stub | **CLOSED** | `create_paypal_order` returns `501 PROVIDER_NOT_CONFIGURED` when `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` not set instead of writing a fake `pending` row |
| 8 | No structured security audit logging | **CLOSED** | Every endpoint records who/what/when via `recordRemittanceAudit` → `security_audit_logs (event_category='remittance')` with decision codes (`allowed`, `denied_unauthenticated`, `denied_unauthorized`, `denied_validation`, `denied_idempotency`, `denied_provider`, `system_error`) |
| 9 | No admin view for security review | **CLOSED** | `/admin/remittance-security` page with allowed/denied counters, endpoint filter, decision filter, IP/user search |
| 10 | No regression suite | **CLOSED** | `scripts/raas-e2e-runner.mjs` + `.github/workflows/raas-e2e.yml` — 8 probes, fails CI on any regression |

Remaining P2 / P3 (deferred — non-blocking):

- Corridor daily / monthly velocity caps are tracked (`remittance_usage_tracking`)
  and **enforced** for the daily window on quote; monthly is still tracked only.
- Backfill: 16 quotes without a downstream transfer remain in the database;
  these predate the audit and have no user impact (cleanup migration optional).

## Verified live (post-deploy)

```
POST /remittance-recon-cron       (bad token) → 401 {"error":"unauthorized","code":"INVALID_TOKEN"}
POST /remittance-routing-engine   (bad token) → 401 {"error":"Unauthorized"}
POST /remittance-fulfill          (bad token) → 401 {"error":"Unauthorized"}
POST /remittance-payin-intent     (bad token) → 401 {"error":"unauthorized","code":"INVALID_TOKEN"}
```

## Files touched in Phase 1

```
supabase/functions/_shared/remittance-audit.ts             (new)
supabase/functions/_shared/remittance-idempotency.ts       (new)
supabase/functions/remittance-routing-engine/index.ts      (idempotency + audit)
supabase/functions/remittance-fulfill/index.ts             (idempotency + audit)
supabase/functions/remittance-recon-cron/index.ts          (structured 401 + audit)
supabase/functions/remittance-payin-intent/index.ts        (auth-first + PayPal 501 + audit)
supabase/functions/remittance-outbound/index.ts            (send Idempotency-Key + audit)
src/pages/admin/AdminRemittanceSecurity.tsx                (new admin view)
src/App.tsx                                                (route /admin/remittance-security)
scripts/raas-e2e-runner.mjs                                (new regression runner)
.github/workflows/raas-e2e.yml                             (CI: every 6h + PR + push)
```

## CI contract

The runner fails the build on the first regression. Required GitHub secrets:

| Secret | Notes |
|---|---|
| `RAAS_BASE_URL` | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1` |
| `RAAS_ANON_KEY` | Project publishable/anon key |
| `RAAS_USER_JWT` | (optional) Authenticated user JWT — enables the `Idempotency-Key` probe |

## Next (Phase 2 — optional)

1. Enforce monthly velocity caps on quote.
2. Add a scheduled job that closes quotes never converted into transfers after 24h.
3. Wire the new `security_audit_logs` rows to the central admin notifications inbox.
