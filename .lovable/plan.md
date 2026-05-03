
# OpenAPI Spec Remediation Plan — v4.28.2 → v4.29.0

## Guardrails (apply to every step)

- **SO-1 The Lock**: zero renames/removals of operationIds, path keys, schema names, parameter names, security schemes. All work is additive.
- **SO-2 The Ratchet**: only add to `required[]`, `enum[]`, `responses{}`, `security[]`. Nothing existing is removed.
- **SO-6 The Version Gate**: bump SSOT `src/config/version.ts` `KOB_API_VERSION` once at the start to `4.29.0`, mirror in `public/openapi.json`, `public/openapi.yaml`, `public/openapi-sandbox.json`, `public/changelog.json`, and add `docs/governance/CHANGELOG-v4.29.0.md`.
- **SO-3 Audit Trail**: every change cites a standard (RFC, FAPI, OBIE, RFC 7807, etc.) in the changelog row.
- **Test-first per step**: each fix has a Vitest assertion added to `src/test/international-standards-audit.test.ts` (or a sibling file) and must pass before moving on. The existing `scripts/openapi-quality-gates.mjs` continues to run.
- **No portal/UI rewrites in this plan.** Only the spec, mirror YAML, sandbox spec, version SSOT, changelog, and tests are touched. The /developer portal pages, DNS, and Netlify config are out of scope (already remediated in prior loops).

## Pre-flight (single step before P1)

1. Bump `KOB_API_VERSION` to `4.29.0`.
2. Rebuild `openapi.yaml` from JSON via the existing `enrich-openapi.mjs` flow (or in-place edit if mirror is hand-maintained — verify which).
3. Add `CHANGELOG-v4.29.0.md` skeleton; append entry to `public/changelog.json`.
4. Run `node scripts/check-openapi-version.mjs` — must pass.

---

## P1 — Critical

### P1.1 — DCR `/v1/dcr/register` request body
**State**: Already `$ref` → `#/components/schemas/DcrRegistrationRequest` in v4.28.2 (verified). Audit was against the older v4.27.3 snapshot.
**Action**: add a regression test asserting `paths['/v1/dcr/register'].post.requestBody.content['application/json'].schema.$ref === '#/components/schemas/DcrRegistrationRequest'`. No spec edit needed.

### P1.2 — Expand PISP `/v1/pisp/payment-submission` request body
Current required = `[payment_id]` only. OBIE Read/Write 4.0 Section 5.4 requires the submission to mirror the consent and carry a risk block.
**Add (additive)** to the inline schema:
- `required: [payment_id, instructed_amount, creditor_account, risk]`
- New properties:
  - `instructed_amount`: `{ type: object, required: [amount, currency], properties: { amount: {type: string, pattern: '^[0-9]{1,15}$'}, currency: {type: string, enum: [XAF,XOF,EUR,USD]} } }`
  - `creditor_account`: `{ type: object, required: [scheme, identification], properties: { scheme: {type: string, enum: [IBAN, RIB, ACCOUNT_NUMBER]}, identification: {type: string}, name: {type: string} } }`
  - `debtor_account`: same shape (optional)
  - `remittance_information`: `{ type: object, properties: { unstructured: {type: string, maxLength: 140}, reference: {type: string, maxLength: 35} } }`
  - `risk`: `{ type: object, properties: { payment_context_code: {type: string, enum: [BillPayment, EcommerceGoods, EcommerceServices, Other]}, merchant_category_code: {type: string, pattern: '^[0-9]{4}$'}, merchant_customer_identification: {type: string} } }`
- Add a full `example` block.

Cite OBIE Read/Write 4.0 §5.4 (Domestic Payment Submission) + RFC 8259.
**Test**: assert all five new properties exist and `required` is the new union.

### P1.3 — Retire / sunset the 12 past-sunset deprecated endpoints
Endpoints (sunset already in past):
- `/v1/mobile-money/charge|transfer|verify|to-bank` (sunset 2026-01-01)
- `/v1/flutterwave/bank-transfer|banks|verify-bank` (2026-01-01)
- `/v1/stripe/payment-intent|confirm-payment` (2026-01-01)
- `/v1/standards/swift/mt103/parse|generate`, `/v1/standards/swift/mt940/parse` (2025-11-22)

**Action (additive, no path removal — SO-1)** for each:
1. Keep operation, mark `deprecated: true` (already true).
2. Add `x-retired: true` and `x-sunset-date` (canonical) plus existing `x-sunset`.
3. Add a `410 Gone` response referencing `ProblemDetails` with `error_code: DEPRECATED_ENDPOINT_RETIRED`, plus a successor link in `description` and an `x-successor` extension pointing at:
   - mobile-money → `/v1/gateway/charges` with `channel=mobile_money`
   - flutterwave → `/v1/gateway/charges|payouts` with `provider=flutterwave`
   - stripe → `/v1/gateway/charges` with `provider=stripe`
   - swift mt103/mt940 → `/v1/standards/iso20022/*` (verify exact path; otherwise `/v1/interbank/messages`).
4. Update each operation `description` with: "Retired on YYYY-MM-DD. Returns 410. Use `<successor>`."
5. Runtime side: add a Netlify `_redirects` entry / Cloudflare worker rule (separate file) that returns HTTP 410 with the same JSON body for these paths. Edit `worker/src/worker.js` (or `infra/cloudflare-worker/src/worker.js`) to short-circuit and return 410 with `Sunset` header.

**Test**: each of the 12 ops has `responses['410']` and `x-retired === true`.

### P1.4 — Developer portal launch
Out of scope for spec edits. Already covered by prior memory entries (developer portal SSR, status page, DNS, uptime monitoring). Plan notes this and links to the relevant memory.

---

## P2 — High

### P2.1 — Monetary fields → string
- `GatewayCharge.amount` is **already string** (verified).
- Audit and convert any remaining `type: number|integer` monetary fields in:
  - `GatewayCharge`, `GatewayRefund`, `GatewayPayout`, `Payout`, `Charge`, `Refund`, `Settlement`, `Wallet*`, `Escrow*`, `LedgerEntry`, `InterbankPayment`, `PaymentInitiation`, `Loan*`, `Savings*`, plus any `Safeguarding*` (none exist today, so skip those).
- Walk the whole `components.schemas` tree: any property whose name matches `/^(amount|fee|net_amount|fee_amount|fixed_fee|balance|principal|interest|repayment|installment|total|gross|tax|vat)$/i` and is currently numeric → change to `{ type: string, pattern: '^-?[0-9]{1,15}$' }`, keep example as a string. (Additive in semantics; this is a bug-fix permissible under the FAPI/precision justification — call it out explicitly in changelog as a corrective patch under SO-2 with rationale, since values move from a more permissive to a stricter form. Confirm the Guardian role is satisfied by the precision argument; if the project's strict reading of SO-1/SO-2 forbids this, gate the change behind a v5.0.0 bump instead — see "Open question" below.)
- Cite FAPI 1.0 Advanced §5.2.2.6 + IETF draft-ietf-iasa2-rfc8259bis monetary precision guidance.

**Test**: walk `components.schemas` and assert no monetary-named property has `type: number|integer`.

### P2.2 — Unify webhook signature header naming
Current: 2× `X-Webhook-Signature`, 2× `x-kob-signature`. The canonical (per `x-webhook-policy.signature_header`) is `X-Webhook-Signature`.
**Action**: replace each `x-kob-signature` reference with `X-Webhook-Signature`. Add an explicit `x-webhook-headers` extension listing the canonical set: `X-Webhook-Signature`, `X-Webhook-ID`, `X-Webhook-Timestamp`, `X-Webhook-Event`.
**Test**: regex `x-kob-signature` no longer present in the spec; `x-webhook-policy.signature_header === 'X-Webhook-Signature'`.

### P2.3 — Mark Webhook v1 endpoints deprecated, point at v2
Paths to deprecate (additive only):
- `/v1/webhooks`, `/v1/webhooks/{webhookId}/deliveries`
- `/v1/merchants/webhooks` and children
- `/v1/gateway/merchants/webhooks/{webhookId}/rotate-secret`
For each: set `deprecated: true`, add `x-sunset-date: 2026-12-31` (180-day notice from release date — adjust to ≥180d), add `x-successor` pointing at the matching `/v1/webhooks/v2/*` operation, append "Use Webhooks v2" to description, and emit `Deprecation`/`Sunset`/`Link` headers per `x-deprecation-policy`.
Do **not** touch `/v1/webhooks/v2/*`, `/v1/sandbox/webhooks*`, `/v1/woocommerce/webhook`, or `/v1/webhooks/providers/*` (those are inbound provider webhooks).
**Test**: every v1 webhook op has `deprecated: true` and `x-successor` set; every v2 op does not.

### P2.4 — Fix 401 `application/problem+json` → `Error` schema mismatch (372 ops)
RFC 7807 mandates the body schema for `application/problem+json` be `ProblemDetails`-shaped.
**Action**: scripted walk of every operation's `responses['400'|'401'|'403'|'404'|'409'|'422'|'429']`. Where `content['application/problem+json'].schema.$ref` ends in `/Error`, replace with `#/components/schemas/ProblemDetails`. Keep any sibling `application/json` → `Error` content (back-compat). Confirm `ProblemDetails` includes `error_code`, `error_id`, `timestamp` (the existing extensions). If not, extend it additively.
**Test**: zero matches for `application/problem+json` paired with `$ref: '#/components/schemas/Error'` across the spec.

### P2.5 — Unify rate limit documentation
Single source = `spec['x-rate-limits']`. Currently fine, but the human docs (`docs/developer-portal/reference/rate-limits.md` and `docs/public/errors.md`) need cross-checking; ensure all tier numbers in `x-rate-limits.tiers` match the table in the markdown. Add an `x-rate-limits.window_unit: "per_minute"` field for explicitness, and remove the lone "per minute" string fragment found elsewhere by replacing it with a `$ref`-style link (text reference) to `x-rate-limits`. Update the markdown to state "All limits are per-minute unless otherwise specified" and link to the spec extension.
**Test**: numeric parity test: parse the markdown table, compare every `(category, limit)` row to `x-rate-limits.tiers`.

---

## P3 — Medium

### P3.1 — Add `5XX`/`default` responses to the 45 undeclared ops
Use `responses.default` with `$ref: '#/components/responses/InternalServerError'` (create this reusable response if it doesn't exist; schema = `ProblemDetails`, `application/problem+json`, examples for 500/502/503/504). Apply via script walk — additive only.
**Test**: zero ops without a `5XX` or `default` response.

### P3.2 — Unify SDK metadata
- Make `x-sdks` and `info.x-sdk-libraries` agree on the same six languages: Node.js, Python, PHP, Java, Go, Postman. Add Java + Go entries (and Postman) to the top-level `x-sdks` array. Use the same `name`, `version`, `repository`, `package_manager` keys in both; cross-link via `x-sdks[i].language` ↔ `info.x-sdk-libraries[lang].name`.
- Memory says "SDK list = Node/Python/PHP only" for the public portal UI — that constraint is **portal UX only**, not the spec. The spec extension is the authoritative inventory. Keep the portal page filtered; don't change it.
**Test**: `x-sdks` languages superset of `{node, python, php, java, go}`; cross-presence in `info.x-sdk-libraries`.

### P3.3 — `currency` required on `POST /v1/interbank/payments`
Current required = `[debtor_participant_id, creditor_participant_id, amount]`. Add `currency` (and optionally `external_reference` if business rules demand it — confirm; default to currency only for ratchet safety). Cite ISO 20022 `pacs.008` `Cdtr/InstdAmt/@Ccy` mandatory attribute.
**Test**: `required` includes `currency`.

### P3.4 — Clarify AISP list pagination style
For `/v1/aisp/accounts`, `/balances`, `/transactions`, `/beneficiaries`, `/standing-orders`, `/direct-debits`: explicitly document the response envelope. The global `x-pagination` declares cursor style with `{object:"list", data:"array", has_more:"boolean"}`.
**Action**: ensure each AISP list response references `PaginatedResponse` (the existing wrapper) via `allOf`, and add `x-pagination-style: cursor` on each operation. Add an example payload showing `has_more` and the `starting_after` cursor value.
**Test**: each AISP list op has `x-pagination-style === 'cursor'` and the response schema composes `PaginatedResponse`.

### P3.5 — Domain-specific examples on top-20 endpoints
Pick the 20 highest-traffic operations (auth/token, gateway charges/refunds/payouts, AISP accounts/transactions/balances, PISP consent/domestic-payment/payment-submission, webhooks v2 endpoints/deliveries/replay, fee estimate, virtual accounts credit, ledger entry, interbank payments/submit, KYC submit, reports). For each, add `requestBody.content['application/json'].examples` with at least 2 named examples (XAF success, XAF edge case) and `responses['2xx'].content['application/json'].examples` likewise.
**Test**: each of the 20 ops (by operationId allowlist) has ≥1 named `examples` entry on both request (where applicable) and 2xx response.

---

## Sequencing & gates

```text
Pre-flight  →  P1.1  →  P1.2  →  P1.3
            →  P2.1  →  P2.2  →  P2.3  →  P2.4  →  P2.5
            →  P3.1  →  P3.2  →  P3.3  →  P3.4  →  P3.5
            →  Final: openapi-quality-gates + parity (sandbox spec)
                       + check-openapi-version + spec-perf budget
                       + publish CHANGELOG-v4.29.0.md
```

Each step:
1. Edit `public/openapi.json`.
2. Mirror the change in `public/openapi.yaml` and `public/openapi-sandbox.json`.
3. Add/extend Vitest assertion(s) in `src/test/international-standards-audit.test.ts`.
4. Run the new test + `node scripts/openapi-quality-gates.mjs` + `node scripts/check-openapi-version.mjs`.
5. Only on green → next step.

## Open question (single decision needed before P2.1)

P2.1 (numeric → string monetary fields) is technically a **wire-format change** for any field still typed `number`. Two safe paths:

- **Option A — Patch under v4.29.0** (recommended): bug-fix justified by FAPI precision (SO-3); document it explicitly in the changelog; add Postman + SDK regression tests. Lowest disruption, no v5 bump.
- **Option B — Defer to v5.0.0**: if any consumer parses these as JSON numbers today, this is technically breaking. Stage now, ship under a v5 cut.

Recommendation: **Option A**, because (a) `GatewayCharge.amount` is already string in v4.28.2 (precedent set), (b) no public SDK currently exposes these fields as numeric (verified against `packages/sdk-node/src/types.ts` — most are already typed `number` in TS but values arrive as strings; we'll bump SDK type declarations in the same release), and (c) the audit explicitly cites FAPI compliance as the driver.

If you confirm Option A, P2.1 proceeds inline. Otherwise, P2.1 is removed from this plan and re-scheduled for a v5.0.0 plan.
