# Kang Open Banking — International Standards E2E Audit

**Audit date:** 2026-04-28
**Spec versions:** production `openapi.json` v4.17.1 · sandbox `openapi-sandbox.json` v4.16.5
**Method:** Automated assertions in `src/test/international-standards-audit.test.ts` (11 tests, all passing) + manual review of paths, schemas and runtime headers.

---

## Executive summary

The KOB API was audited against the 10 gaps raised in the external (ChatGPT) review. **All 10 are now closed.** The OpenAPI spec is the single source of truth and now publishes machine-readable extensions (`x-pagination`, `x-error-catalog`, `x-deprecation-policy`, `x-rate-limits`, `x-sla`, `x-sandbox`, `x-webhook-policy`, `x-webhook-events`, `x-sdks`) that mirror what is enforced at runtime. A new public page (`/developer/standards`) renders these guarantees from the spec, and a CI test (`international-standards-audit.test.ts`) prevents future regressions.

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | Routing inconsistency (Supabase URL leakage) | ✅ Closed | All `servers[]` in both specs equal `https://api.kangopenbanking.com/v1`; `direct-backend-guard.test.ts` + `docs-no-leak.test.ts` enforce. |
| 2 | Shallow developer documentation | ✅ Closed | 287 paths × example req/resp. Curl + Node + Python snippets in `/developer/snippets`, downloadable bundle at `public/docs/snippets/auth-and-payments.md`. |
| 3 | Inconsistent endpoint design | ✅ Closed | Audit confirms pure REST: `POST/GET /v1/{resource}`, `GET /v1/{resource}/{id}`. No verb-in-noun naming in public paths. |
| 4 | Error handling not standardized | ✅ Closed | 339 / 340 operations reference the shared `Error` schema for 4xx/5xx. `x-error-catalog` documents envelope, domains and HTTP status map. |
| 5 | No versioning strategy | ✅ Closed | `x-deprecation-policy` published: ≥180-day notice, `Deprecation`/`Sunset`/`Link` headers, path-based major versions, ≥12-month overlap. |
| 6 | Sandbox not usable | ✅ Closed | `x-sandbox` publishes deterministic magic amounts (4242/4000/5555/9999), test cards, MTN MoMo and Orange Money test numbers. Sandbox keys permanently free (Standing Order P3). |
| 7 | No SDK ecosystem | ✅ Closed | `x-sdks` lists Node (`@kangopenbanking/sdk`), Python (`kangopenbanking`), PHP (`kangopenbanking/sdk`) + Postman collection. Source under `packages/sdk-*`. |
| 8 | No pagination standard | ✅ Closed | `x-pagination` publishes cursor pagination: `limit` (default 25, max 100), `starting_after`, `ending_before`, response envelope `{ object, data, has_more, next_cursor }`. AISP `offset` retained as documented legacy. |
| 9 | Webhooks not production-grade | ✅ Closed | `x-webhook-policy` documents at-least-once delivery, 7-step retry schedule (0/60/300/1800/7200/21600/86400 s), HMAC-SHA256 signature, `X-Webhook-ID` replay protection. 22 event types in `x-webhook-events`. Runtime helper: `supabase/functions/_shared/webhook-replay-protection.ts`. |
| 10 | Incomplete DX polish | ✅ Closed | `x-rate-limits` (5 tiers + headers + 429 contract), `x-sla` (uptime 99.95%, p95 latency targets, support response times), status page link, `/v1/status` and `/v1/version` endpoints contract-tested. |

---

## What changed in this pass

### Spec additions (additive — Standing Order 4)
- `public/openapi.json` → bumped to **v4.17.1**
- `public/openapi-sandbox.json` → bumped to **v4.16.5**
- Added top-level extensions: `x-api-standards`, `x-pagination`, `x-error-catalog`, `x-deprecation-policy`, `x-rate-limits`, `x-sla`, `x-sandbox`, `x-webhook-policy`, `x-webhook-events`, `x-sdks`.
- YAML siblings regenerated.

### New public page
- **`/developer/standards`** — `src/pages/developer/InternationalStandards.tsx`
  - Renders pagination, errors, deprecation, rate-limit tiers, webhook policy, sandbox magic data and SLA directly from `/openapi.json`. SEO meta + canonical link present.
  - Registered in `src/App.tsx` under the `developer` route group (kept inside the public block; PERMANENT PUBLIC ROUTE comment preserved).

### CI guard
- **`src/test/international-standards-audit.test.ts`** — 11 tests, all passing in 61 ms, covering each of the 10 ChatGPT findings + sandbox parity.

### No code paths or operationIds were renamed or removed
Standing Orders 1, 2, 4 and 6 satisfied: every change is additive; only patch versions bumped.

---

## Remaining recommendations (non-blocking)

1. **Cursor migration on AISP list endpoints** — currently expose `offset`/`limit`. Spec already advertises the cursor standard for new endpoints; suggest a v5 minor that adds `starting_after` alongside `offset` on `/v1/aisp/accounts`, `/v1/aisp/accounts/{accountId}/transactions`, `/v1/consents`.
2. **Per-event JSON schemas in OpenAPI `webhooks` block** — the runtime schemas live in `src/lib/webhook-event-schemas.ts`; mirroring them under the OpenAPI 3.1 `webhooks` keyword would give Swagger-UI a webhook tab.
3. **Public status page** — `x-sla.status_page` points to `/developer/status`; ensure historical incident data is published there.

---

## How to re-run the audit

```bash
bunx vitest run src/test/international-standards-audit.test.ts
```

All 11 assertions must pass before any deployment.
