## Reconciliation with current state

Your prompt assumes a stale snapshot (`info.version = "4.28.2"`, PISP submission body with only `payment_id`, retired endpoints still returning `200`). The repo today is at **`4.29.1`** and already further along than the prompt's "REPLACE WITH" payloads in two places. Standing Orders 1 (Lock), 2 (Ratchet), 4 (Surgeon), and 6 (Version Gate) prevent silent regression, so I will **not** apply Fixes 1 or 2 as written. Details below.

### What I will do

**Fix 3 — `/v1/v1/` URL bug (apply in full)**
Real bug. Counts confirmed:
- `public/openapi.json` — 389 occurrences
- `public/openapi.yaml` — 389 occurrences
- `public/openapi-sandbox.json` — 2 occurrences

All occurrences are inside string values (`x-codeSamples` curl `source` strings and a couple of `example` fields like `https://api.kangopenbanking.com/v1/v1/oauth/token`). Path keys (`/v1/aisp/accounts`, etc.) are unaffected.

Approach: load each file, walk every JSON string value, replace the substring `https://api.kangopenbanking.com/v1/v1/` → `https://api.kangopenbanking.com/v1/` (string values only — JSON keys never touched). For the YAML file, run the same substring replace line-by-line (the substring is unambiguous and only ever appears inside quoted scalars). Re-parse each file afterwards to confirm validity.

Acceptance: `rg -c "/v1/v1/" public/openapi.json public/openapi.yaml public/openapi-sandbox.json` returns `0` for all three.

**Fix 4 — Getting-started SDK list (apply, adapted)**
File: `src/pages/developer/GettingStarted.tsx`, "Install an SDK (Optional)" block around lines 210–235. Replace the current 4-tab list with the 6-SDK list from your prompt **using the actual published package names from this repo** (the prompt's package names disagree with what is actually published and would break Order P5 — Working Code Rule):

| SDK | Install command (from this repo) | GitHub |
|---|---|---|
| Node.js / TypeScript | `npm install @kangopenbanking/sdk` (v1.6.0) | `kangopenbanking/sdk-node` |
| Python | `pip install kangopenbanking` (v1.6.0) | `kangopenbanking/sdk-python` |
| PHP / Laravel | `composer require kangopenbanking/sdk` (v1.6.0) | `kangopenbanking/sdk-php` |
| Java | Maven `com.kangopenbanking:kangopenbanking-sdk-typed:4.29.1` | `kangopenbanking/KangOpenBanking-KOB` (+ CI link) |
| Go | `go get github.com/kangopenbanking/sdk-go` | pkg.go.dev link |
| Ruby | Community via `openapi-generator-cli (ruby)` | guides/sdks#ruby |

Why deviate from the prompt's package names: the prompt lists `@kang/openbanking-node`, `kang-openbanking`, `kang/openbanking-php`, and `kangfinance/*` GitHub orgs. None of those are what `packages/sdk-node`, `packages/sdk-python`, `packages/sdk-php` actually publish (`@kangopenbanking/sdk`, `kangopenbanking`, `kangopenbanking/sdk`). Using the prompt strings would make every code sample fail the Order P5 sandbox smoke test.

I will keep the surrounding step structure intact (no quickstart, cURL, sandbox key, or footer changes).

### What I will NOT do, and why

**Fix 1 — PISP `/v1/pisp/payment-submission` request body: REJECT**
Current state already exceeds the prompt's target. The schema is the OBIE Read/Write 4.0 §5.4 form:
- `required[]`: `payment_id, instructed_amount, creditor_account, risk`
- `properties`: `payment_id, instructed_amount {amount, currency}, creditor_account, debtor_account, remittance_information, risk`

Your "REPLACE WITH" payload removes `instructed_amount` (object) and `risk` from `required[]`, deletes `risk` and `remittance_information` from `properties`, and replaces `instructed_amount` with a flat `amount`/`currency` pair. That is a **breaking schema change** that:
- Violates Standing Order 2 (Ratchet — required entries cannot be removed once added).
- Violates Standing Order 4 (Surgeon — modifications need Guardian approval and cited justification).
- Violates Standing Order 1 (Lock — schema rename of the payment amount carrier).
- Diverges from OBIE 4.0 §5.4 (cited justification standard already on file).
- Would require a major version bump per Standing Order 6, but you also instruct me to keep `info.version = 4.28.2`.

If you want a flat-money convenience surface, the additive path is to add optional siblings (`amount_minor`, `currency`) alongside `instructed_amount` in a new minor version — I can do that as a separate change.

**Fix 2 — 12 retired endpoints: REJECT (already done, differently)**
Verified on `/v1/mobile-money/charge`: it already has `x-retired: true`, `x-successor: "/v1/gateway/charges?channel=mobile_money"`, `x-sunset-date`, headers `Sunset`/`Deprecation`/`Link` (RFC 8594), `responses: {"410": {...ProblemDetails...}}`, and **no** `200`. The other 11 follow the same pattern — confirmed by `src/test/v4.29.0-audit-remediation.test.ts > "P1.3"` which currently passes.

The only deltas your prompt asks for are cosmetic:
- field name `x-replacement-endpoint` instead of `x-successor`
- example body wording

Renaming `x-successor` → `x-replacement-endpoint` is a vendor-extension rename: under Standing Order 1 it counts as a contract change for any consumer keying on `x-successor` (we have one — the Postman regenerator in `scripts/regen-postman.mjs`). I will **not** silently rename. If you want the `x-replacement-endpoint` alias for an external auditor, I can **add** it as a second key on each of the 12 ops (additive, Surgeon-safe) without removing `x-successor`. Confirm and I'll include it.

**Global constraint #1 — revert `info.version` to `4.28.2`: REJECT**
Standing Order 2 (Ratchet) and Order P7 (Changelog) both forbid moving the published version backwards. `4.29.1` is already in `src/config/version.ts`, `public/changelog.json`, both OpenAPI files, sandbox spec, SDKs (1.6.0), Postman collection, and the v4.29.0/v4.29.1 changelog entries. Reverting would break every parity test and the live audit gate.

### Files to change

1. `public/openapi.json` — Fix 3 (string-value substring replace only).
2. `public/openapi.yaml` — Fix 3 (same substring replace).
3. `public/openapi-sandbox.json` — Fix 3 (same).
4. `src/pages/developer/GettingStarted.tsx` — Fix 4 (replace SDK install list block with the 6-SDK table; preserve every other section).

### Verification after edits

- `node -e "JSON.parse(require('fs').readFileSync('public/openapi.json'))"` for both JSON specs.
- `rg -c "/v1/v1/" public/openapi.json public/openapi.yaml public/openapi-sandbox.json` → all `0`.
- Vitest: `bunx vitest run src/test/v4.29.0-audit-remediation.test.ts src/test/openapi-fixtures.test.ts` to confirm no regression.
- Visually re-check the `/developer/getting-started` SDK block in the preview (lists 6 SDKs, no "coming soon").

### Decisions I need from you before applying

1. Confirm I should **skip Fix 1 and Fix 2** as documented above (recommended).
2. Optional: add `x-replacement-endpoint` as an **additive alias** alongside the existing `x-successor` on the 12 retired ops? (yes/no)
3. Confirm Fix 4 should use the **actual published SDK package names** from this repo (recommended) rather than the strings in your prompt.
