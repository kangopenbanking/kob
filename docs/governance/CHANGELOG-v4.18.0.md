# CHANGELOG — v4.18.0 (2026-05-01)

**Theme:** Reconciliation & Integration Hardening — make the API safe to plug into a bank's treasury and payment-initiation stack.

## 1. Confirmation of Payee (CoP)

- **New endpoint:** `POST /v1/confirmation-of-payee` — Pay.UK Confirmation of Payee v3 / ISO 20022 acmt.023/024 inspired beneficiary verification.
- Returns deterministic outcome: `match` | `close_match` | `no_match` | `unavailable` with ISO/Pay.UK reason codes (`ANNM`, `BANM`, `NACC`, `ACNS`, `OPTO`, `AC01`, `MBAM`).
- When `close_match`, the response includes `name_suggested` (the actual holder name on file) so the payer UI can prompt the user to confirm.
- Backed by the new `confirmation-of-payee` edge function. Looks up holder records in the `accounts` directory; returns `unavailable` rather than fabricating a match when the account is not in the directory (fail-closed).

**Justification:** Confirmation of Payee is now a baseline expectation for inbound bank integrations even outside UK/EU; APP-fraud liability shifts make it commercially material. Standing Order 4 (Surgeon Rule): purely additive.

## 2. Floating-point money — string-typed siblings (Standing Order 1 preserved)

Treasury and reconciliation systems are zero-tolerance on IEEE-754 floats for monetary values. Per **RFC 8259 §6** and **FAPI 1.0 Advanced §5.2.2**:

| Schema | Old (deprecated) | New (authoritative) |
|---|---|---|
| `GatewayCharge.amount` | `number` | `amount_minor: string ^[0-9]{1,18}$` |
| `GatewayCharge.fee_amount` | `number` | `fee_amount_minor: string ^[0-9]{1,18}$` |
| `GatewayCharge.net_amount` | `number` | `net_amount_minor: string ^[0-9]{1,18}$` |
| `JournalEntry.lines[].debit` | `number` | `debit_amount: string ^[0-9]{1,18}$` |
| `JournalEntry.lines[].credit` | `number` | `credit_amount: string ^[0-9]{1,18}$` |

The original number-typed fields are flagged `deprecated: true` and **retained** for backwards compatibility (Standing Order 1 — The Lock). They will be removed in **v5.0.0**.

**Reconciliation systems MUST consume the `*_minor` / `*_amount` string fields.**

## 3. OAuth path canonicalisation

All discovery metadata and developer documentation now reference the slash form, which matches the OAuth compatibility router (`supabase/functions/oauth/index.ts`):

- `/v1/oauth/authorize` (was: `/v1/oauth-authorize` in some docs)
- `/v1/oauth/token`
- `/v1/oauth/par`
- `/v1/oauth/revoke`
- `/v1/oauth/introspect`

The hyphenated routes (`/v1/oauth-authorize`, `/v1/oauth-token`, …) remain reachable through the OAuth router so existing integrations continue to work — but they are no longer advertised. Bank gateways that pre-validate discovery against the documented endpoint URIs will no longer see a mismatch.

**Files updated:** `src/pages/developer/AuthOAuth2.tsx`, `src/pages/developer/AuthFapi.tsx`, `src/pages/developer/AuthenticationOverview.tsx`.

## 4. CIBA removed from advertised metadata

The OIDC discovery document (`oidc-config`) does not currently emit `backchannel_authentication_endpoint`, but the developer-facing FAPI page and the Open Banking Standards page falsely claimed CIBA support. Banks pre-validating the OIDC discovery document or the standards page would have failed onboarding on a phantom endpoint.

- Removed CIBA claims from `src/pages/developer/AuthFapi.tsx` and `src/pages/developer/OpenBankingStandards.tsx`.
- The `info.description` of the OpenAPI spec now states CIBA will be reintroduced once the `/v1/oauth/bc-authorize` endpoint actually ships.

## 5. TransactionOBIE migration deadline (Standing Order P10)

The deprecated PascalCase aliases on `Transaction` will be removed in **v5.0.0, scheduled for 2026-11-01** — at least 90 days of prior notice as required by Standing Order P10 (Living Docs). Documented in:

- `info.description` (machine-readable for any integrator inspecting the spec).
- `src/pages/developer/ObieMigration.tsx` (already documented; deadline now aligned).

## Standing-order compliance

| Order | Status |
|---|---|
| 1 — The Lock | ✅ All deprecated fields retained, only additive sibling fields added. |
| 2 — The Ratchet | ✅ No required[] entries removed; new fields added. |
| 3 — The Audit Trail | ✅ Each change cites RFC 8259, FAPI 1.0 Adv §5.2.2, RFC 6749, RFC 8414, Pay.UK CoP v3, ISO 20022 acmt.023/024. |
| 4 — The Surgeon Rule | ✅ Additive-only. |
| 5 — The Dead Code Rule | ✅ Confirmation of Payee schema is referenced by `/v1/confirmation-of-payee`. |
| 6 — The Version Gate | ✅ Minor bump 4.17.0 → 4.18.0 (new endpoint + schema additions). |
| P1 — Public First | ✅ Spec, docs, and discovery remain unauthenticated. |
| P10 — Living Docs | ✅ TransactionOBIE removal date documented ≥90 days in advance. |
