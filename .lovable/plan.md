

# Developer API Audit — Targeted Remediation Plan

## Audit reality check

I cross-checked every claim in the audit against the codebase. Several "emergency" findings are **factually incorrect** for this project — likely the audit was run against a stale crawl or against `kangopenbanking.com` rather than this Lovable preview / `info.kangfintechsolutions.com`.

| Audit claim | Actual state in this repo |
|---|---|
| Fix 1 — Portal pages are blank stubs | **False.** 140+ real page components exist (`GettingStarted.tsx`, `SandboxOverview.tsx`, `GatewayQuickstart.tsx`, `WebhooksGuide.tsx`, `RealWorldExamples.tsx`, `ApiExplorer.tsx`, etc.), all wired in `src/App.tsx` under `/developer/*` with real content. |
| Fix 2 — API Explorer not rendered | **False.** `/developer/api-explorer` already mounts Swagger UI with the live spec from `public-api-spec`, plus a static Redoc fallback at `/developer/api-explorer-static`. |
| Fix 4 — No sandbox credentials page | **False.** `/developer/sandbox/credentials`, `/sandbox/test-cards`, `/sandbox/mobile-money`, `/sandbox/console` all exist. |
| Fix 5 — No auth guide | **False.** `AuthenticationOverview`, `AuthOAuth2`, `AuthFapi`, `AuthMtls`, `AuthApiKeys`, `TokenLifecycleGuide` all exist. |
| Fix 8 — No rate-limit page | **False.** `RateLimitsGuide.tsx` exists and the OpenAPI `info.description` already documents tier limits + headers. |
| Fix 10 — Mintlify setup missing | **N/A.** This is a React/Vite app with custom GuidePageShell components, not a Mintlify site. Re-platforming to Mintlify is a separate strategic decision, not a fix. |
| **Fix 6 — Monetary type bugs** | **TRUE.** `VirtualCard.balance_usd` is `type: number`. `LoanScheduleItem.principal/interest/fees/total_due` are `type: number`. Confirmed at lines 1342–1356, 1645–1648. |
| **Fix 7 — Missing 401/403 components** | **TRUE.** `components.responses` contains only `NotModified` and `TooManyRequests`. No reusable `Unauthorized` / `Forbidden`. Inline 401/403 are present on most ops but not standardised. |
| **Fix 9 — Transaction OBIE dual naming** | **PARTIAL.** PascalCase OBIE aliases (`AccountId`, `TransactionId`, `Amount`, `CreditDebitIndicator`, etc.) are mixed into the primary `Transaction` schema with `x-obie-mapping` annotations. SDK generators will emit duplicate fields. |

## Scope of this plan

I will fix the **three real spec bugs** plus add light portal polish for two pages flagged as weak. Everything else in the audit is already shipped.

---

## Changes

### 1. Fix monetary types in `public/openapi.json` (Fix 6)

**Standing Order 4 (Surgeon Rule) + Order 6 (Version Gate) compliance:** these are **breaking schema changes**, so per the Guardian rules I will NOT silently rename. Instead:

- `VirtualCard`: keep `balance_usd` (deprecated, add `deprecated: true` + `x-sunset` note) and add new sibling fields:
  - `balance` → `type: string, pattern: "^[0-9]{1,15}$"` (minor units)
  - `currency` → `type: string, enum: ["USD","XAF","EUR","GBP"]`, default `"USD"`
- `LoanScheduleItem`: keep `principal`, `interest`, `fees`, `total_due` as deprecated and add string-typed siblings: `principal_amount`, `interest_amount`, `fees_amount`, `total_due_amount` (all `pattern: "^[0-9]{1,15}$"`).
- Bump `info.version` 4.16.4 → **4.17.0** (minor — additive) and add a changelog entry citing FAPI 1.0 Adv §5.2.2 + RFC 8259 (no float for monetary).

### 2. Add reusable `Unauthorized` / `Forbidden` response components (Fix 7)

In `public/openapi.json` and the live `supabase/functions/public-api-spec/index.ts` source:

```jsonc
"components": {
  "responses": {
    "Unauthorized": {
      "description": "Expired, revoked, or invalid access token (RFC 6750 §3.1).",
      "content": {
        "application/problem+json": { "schema": { "$ref": "#/components/schemas/ProblemDetails" } }
      }
    },
    "Forbidden": {
      "description": "Token valid but scope insufficient or resource not owned by client.",
      "content": {
        "application/problem+json": { "schema": { "$ref": "#/components/schemas/ProblemDetails" } }
      }
    }
  }
}
```

Then sweep all secured operations and replace inline `401`/`403` with `$ref: "#/components/responses/Unauthorized"` / `Forbidden`. Done via a small Node script run once over the spec to keep the change mechanical and reviewable.

### 3. Resolve Transaction OBIE dual naming (Fix 9)

- Create new `TransactionOBIE` schema in `components.schemas` containing only the PascalCase OBIE-mandated fields, with a top-level `description` linking to OBIE Read/Write Data API v3.1.
- Mark each PascalCase field on the primary `Transaction` schema as `deprecated: true` with `x-replacement: "TransactionOBIE.<Field>"`.
- Add a note in `info.description` pointing OBIE consumers to `TransactionOBIE`.
- No removals (Standing Order 1 — The Lock).

### 4. Sync `public/openapi.json` with edge function source

The static file (`public/openapi.json`) was flagged stale in `API_EXPLORER_DIAGNOSIS.md`. After edits I will mirror the same JSON tree into `supabase/functions/public-api-spec/index.ts` so both endpoints serve identical content.

### 5. Light polish — only where the audit found a real UX gap

- Add a prominent **"Default = sandbox"** server toggle banner at the top of `ApiExplorer.tsx` (audit Fix 2's underlying concern). Sandbox stays the default selected server.
- Add a copy-paste **cURL + Node + Python** triple-tab snippet to the top of `GettingStarted.tsx` for the OAuth `/token` exchange (closes Fix 3 for the highest-traffic page; the `CodeBlock` component already supports multi-lang tabs).

## What I will **NOT** do

- Re-platform to Mintlify (Fix 10) — out of scope, would discard 140+ existing pages.
- Recreate pages that already exist (Fixes 1, 4, 5, 8).
- Rename or remove any existing operationId, schema, parameter, or security scheme (Standing Order 1 — The Lock).

## Verification after implementation

1. `npm test` (existing `openapi-parity.test.ts`, `docs-smoke.test.ts`, `code-examples-smoke.test.ts`).
2. Spot-check `/developer/api-explorer` renders with new spec.
3. Confirm `info.version === "4.17.0"` and a changelog entry appears in `docs/governance/`.

## Files touched

- `public/openapi.json` (schema fixes + responses + version bump)
- `supabase/functions/public-api-spec/index.ts` (mirror)
- `src/pages/developer/ApiExplorer.tsx` (sandbox-default banner)
- `src/pages/developer/GettingStarted.tsx` (multi-lang OAuth snippet)
- `docs/governance/CHANGELOG-v4.17.0.md` (new — Standing Order 7)

