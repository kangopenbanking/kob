# Claude AI Integration Readiness Audit — Remediation Report

**Date:** 2026-05-02
**Source audit:** `Kang_API_Integration_Readiness_Report.docx` (Audit 5, May 2026)
**Baseline score:** 32/100 (Developer Portal) · 100/100 (API Spec)
**Target after fixes:** ~60/100 per audit Section 7

## Audit findings vs status

| # | Audit Finding | Severity | Status | Where Fixed |
|---|---|---|---|---|
| P1 | Sandbox page exposes `https://YOUR_PROJECT.supabase.co/functions/v1` placeholder | CRITICAL | **FIXED** | `vite-plugin-prerender-docs.ts` (already fixed in source); also fixed `src/pages/developer/SandboxOverview.tsx` (was showing production URL as "Base URL") |
| P2 | Getting Started uses legacy `provider`/`phone_number` instead of OpenAPI v4.27 `channel`/`customer_phone` | HIGH | **FIXED** | Prerender plugin Getting Started + Gateway Quickstart curl bodies updated |
| P3 | Getting Started missing successful response body example | HIGH | **FIXED** | Added HTTP 201 JSON response (StandardResponse envelope) |
| P3b | Getting Started missing error response example | HIGH | **FIXED** | Added RFC 7807 `application/problem+json` error example |
| P4 | Authentication page is generic stub | HIGH | **FIXED** | New `/developer/authentication` prerender entry: API key + OAuth 2.0 PKCE worked example, full scopes table, token lifetimes, FAPI posture |
| P5 | API Explorer page is generic stub | MEDIUM | Already had prerender entry; React page is full Swagger UI (verified) |
| P6a | Webhook guide lists only 6 events instead of 52 | HIGH | **FIXED** | Webhooks prerender now lists all 52 events grouped by domain (Charges, Refunds, Payouts, Transfers, Disputes, Settlements, Subscriptions, AISP, PISP, KYC, Loans/Savings) |
| P6b | Webhook guide retry policy incomplete | MEDIUM | **FIXED** | 7-attempt exponential backoff table (1m → 24h), 10s timeout, dead-letter window, replay endpoint |
| P6c | Webhook guide signature code Node-only | MEDIUM | **FIXED** | Added Node, Python, PHP HMAC-SHA256 verifiers (constant-time compare) |
| P7 | SDK page lacks complete working examples | MEDIUM | **FIXED** | Added Node/Python/PHP create-charge worked examples + min runtime per language |
| P8 | Home page missing version badge | LOW | **FIXED** | Home shows **API v4.27.2** + spec download links (JSON, YAML, sandbox JSON) |
| P9 | Sandbox page React component shows production URL labelled "Base URL", stale `v4.6.0` | MEDIUM | **FIXED** | Renamed to "Sandbox Base URL", added "Production Base URL" row, version → v4.27.2; seed-data and webhook-simulator curl examples now point at sandbox host |

## Files changed

| File | Change |
|---|---|
| `vite-plugin-prerender-docs.ts` | Rewrote Getting Started, Gateway Quickstart, Webhooks, SDKs prerender content; added new `/developer/authentication` entry; added v4.27.2 version badge + Authentication + Webhooks + Changelog quick links + spec downloads on `/developer` home |
| `src/pages/developer/SandboxOverview.tsx` | Sandbox URL row labelled correctly, added Production URL row, v4.27.2, sandbox-host curl examples |
| `src/test/developer-portal-charge-fields.test.ts` | New CI guard: enforces `channel`/`customer_phone` in prerender, sandbox host on Sandbox page, version badge on home, presence of Authentication route |

## Verification

```
$ bunx vitest run src/test/developer-portal-charge-fields.test.ts \
                  src/test/developer-portal-content.test.ts
 ✓ src/test/developer-portal-charge-fields.test.ts (4 tests)
 ✓ src/test/developer-portal-content.test.ts (3 tests)
 Test Files  2 passed (2)
      Tests  7 passed (7)
```

The existing forbidden-pattern guards (`YOUR_PROJECT`, `supabase.co/functions/v1`, ssr-fallback duplication) still pass. The new field-correctness guard prevents the legacy `phone_number` field from being re-introduced into prerendered charge examples.

## Standing Orders preserved

- **Order 1 (Lock):** No operationId / schema rename. Field corrections were doc-only — the API spec already used `channel`/`customer_phone` since v4.4.0; only stale documentation was updated.
- **Order 2 (Ratchet):** No compliance check removed. New CI test added (forward progress).
- **Order P1 (Public First):** All updated routes remain public.
- **Order P4 (Open Spec):** Spec links explicitly surfaced on home page.
- **Order P5 (Working Code):** All curl examples now match the live OpenAPI v4.27.2 schema and the sandbox host.
- **Order P9 (Multi-language):** Webhook signature verification now provided in Node, Python, and PHP; SDK examples in Node, Python, and PHP.
