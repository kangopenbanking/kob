
# Nium Integration — Gap Closure Plan (Multi-Currency, Virtual + Global Accounts, E2E)

## 1. What's there today

| Area | State |
|---|---|
| Modes | `stub` / `sandbox` / `live` via `NIUM_MODE` — works |
| Currencies | **Hard-locked to USD / EUR / GBP** in `NiumCurrency` type, SDK, OpenAPI, DB checks |
| Account types | One concept (`global_account`) — Nium's **Virtual Accounts** (per-customer pay-in) and **Global Accounts** (client-pooled) are conflated |
| FX | XAF only as destination; EUR pegged 655.957 (BEAC) ✓ |
| PoP whitelist | Locked to Software/Digital + Royalties (BEAC §) ✓ — must stay |
| Edge functions | create, list, payout-quote, payout-preference, name-correction, webhook, admin-fees |
| Beneficiaries / Payouts / Conversions / Statements | **Missing** |
| Webhook events | only incoming payment + name correction |
| RFI / KYC remediation | **Missing** |
| Admin UI | name-corrections + fee settings only |
| E2E | one Playwright spec (`global-accounts.spec.ts`) — read-only |

## 2. Gaps to close (Standing Order 4: additive only)

### G1 — Currency expansion
Add to `NiumCurrency` (union + DB check + OpenAPI enum) per Nium's supported list:
`USD, EUR, GBP, AUD, CAD, SGD, AED, JPY, INR, ZAR, HKD, CHF, NZD, SEK, NOK, DKK, CNY` — **17 currencies total**.
XAF stays the **default destination currency** (Nium does not issue XAF VAs — documented in code + docs).
Per-currency stub FX rates added to `STUB_RATES`. EUR peg unchanged.

### G2 — Virtual Account vs Global Account split
- Rename concept (additive only, keep old names as aliases):
  - **Virtual Account** = per-customer pay-in (`/api/v2/client/{c}/customer/{customer}/virtualAccount`) — already implemented, keep
  - **Global Account** = client-pooled receivables (`/api/v2/client/{c}/globalAccount`) — new
- DB: add `account_kind enum('virtual','global')` column on `nium_accounts`, default `virtual`, backfill existing rows.
- New edge functions: `nium-create-virtual-account` (alias to existing), `nium-create-global-pool-account`, `nium-list-virtual-accounts`, `nium-list-global-pool-accounts`.

### G3 — Missing Nium operations
| Module | New edge function | Nium endpoint |
|---|---|---|
| Beneficiaries | `nium-beneficiary-ops` (create/list/delete) | `/api/v2/client/{c}/customer/{cu}/beneficiaries` |
| Payouts | `nium-create-payout` | `/api/v2/client/{c}/customer/{cu}/transfer` |
| FX Conversion | `nium-create-conversion` | `/api/v2/client/{c}/customer/{cu}/conversion` |
| Statements | `nium-get-statement` | `/api/v2/client/{c}/customer/{cu}/statement` |
| RFI (KYC remediation) | `nium-rfi-ops` (list + respond) | `/api/v1/client/{c}/customer/{cu}/rfi` |

All gated by `assertAllowedNiumPopCode` for outbound flows. Idempotency-Key required (UUID v4) per project memory.

### G4 — Webhook coverage
Extend `nium-webhook` to handle and persist:
`PAYIN_RECEIVED` (exists), `PAYOUT_STATUS`, `CONVERSION_STATUS`, `RFI_REQUESTED`, `RFI_RESOLVED`, `BENEFICIARY_VERIFIED`, `ACCOUNT_STATUS_CHANGED`.
HMAC-SHA256 verification already covered by `verifyWebhookSignature` (SDK + edge). Dedupe via `webhook_inbox.idempotency_key`.

### G5 — Admin surfaces
- `AdminNiumAccounts.tsx` — search / filter / suspend / reactivate accounts (virtual + global).
- `AdminNiumRFIInbox.tsx` — open RFIs, respond with documents.
- `AdminNiumPayouts.tsx` — payout monitor with retry + cancel.
- All admin actions require step-up MFA (project standard).

### G6 — Consumer + Merchant UI
- `GlobalReceivingAccount.tsx` — render the 17 currencies in the create-account picker; show per-currency wire instructions and limits.
- New `VirtualAccountInbox.tsx` page on `/app/virtual-accounts` listing inbound payments by VA.

### G7 — API + SDKs
- Bump OpenAPI **4.51.6 → 4.52.0** (minor: new paths added) per Standing Order 6.
- New paths under `/v1/gateway/nium/*` for each new function, with full request/response examples and Idempotency-Key headers (Standing Order 3 cites Nium API v2 §Virtual Accounts and §Payouts).
- SDKs (Node, Python, PHP): add `NiumResource` extension methods `createConversion`, `createPayout`, `listBeneficiaries`, `getStatement`, `respondToRfi`. README method tables updated (CI gates `check-{node,python,php}-sdk-readme.mjs` re-run).
- Postman collection regenerated; `webhook-fixtures-v4.52.0.zip` published with signed `payout.status` + `conversion.status` examples.

### G8 — Permissions recommendation
**Best-recommended option (apply by default):** keep current `SECURITY DEFINER` + `has_role()` pattern. Admin Nium screens gated by `nium_ops` app role (new `app_role` enum value). Consumer-facing endpoints stay scoped to `auth.uid()` via existing RLS on `nium_accounts`, `nium_incoming_payments`. New tables (`nium_beneficiaries`, `nium_payouts`, `nium_conversions`, `nium_rfi`) get the standard:
```
GRANT SELECT, INSERT, UPDATE ON public.<t> TO authenticated;
GRANT ALL ON public.<t> TO service_role;
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
-- owner-scoped policy via auth.uid()
-- admin-scoped policy via has_role(auth.uid(), 'nium_ops')
```

## 3. E2E coverage (added in `e2e/nium/`)

Each test asserts: 200 + DB row + webhook fixture replay + UI state. **PASS report emitted to `NIUM_E2E_REPORT.md`** with per-step ✓/✗.

| # | Spec | Covers |
|---|---|---|
| 1 | `nium-create-virtual-account.spec.ts` | 17 currencies × create → list → idempotent re-create |
| 2 | `nium-create-global-account.spec.ts` | client-pooled account creation + suspend/reactivate |
| 3 | `nium-payin-webhook.spec.ts` | signed `PAYIN_RECEIVED` → FX → wallet credit |
| 4 | `nium-payout.spec.ts` | beneficiary create → payout → `PAYOUT_STATUS` webhook → ledger |
| 5 | `nium-conversion.spec.ts` | USD→EUR conversion + spread parity vs `nium-quote-payout` |
| 6 | `nium-rfi.spec.ts` | RFI requested → admin responds → resolved |
| 7 | `nium-pop-guard.spec.ts` | forbidden PoP code rejected (BEAC lock) |
| 8 | `nium-rls.spec.ts` | user A cannot read user B's accounts/payouts |
| 9 | `nium-multi-currency-ui.spec.ts` | Playwright: 17-currency picker, XAF excluded as source, included as destination |

CI: new workflow `.github/workflows/nium-e2e.yml` (nightly + on-push to Nium files).

## 4. Sequencing (each step is its own commit, Surgeon Rule)

1. **Migration** — `nium_accounts.account_kind`, new tables (beneficiaries, payouts, conversions, rfi), GRANTs, RLS, `nium_ops` role.
2. **Shared lib** — expand `NiumCurrency` union + stub rates; add `assertNiumPayoutCurrency` helper.
3. **Edge functions** — 5 new functions (G3) + webhook extension (G4).
4. **OpenAPI v4.52.0** — additive paths, examples, history snapshot, changelog entry, version bump.
5. **SDKs** — Node/Python/PHP method additions + README sync; run all 3 README check scripts.
6. **Admin UI** — 3 new pages + step-up gates.
7. **Consumer UI** — picker + VA inbox.
8. **E2E suite** — 9 specs + workflow + `NIUM_E2E_REPORT.md` generator.
9. **Verification** — run `pnpm test`, all README gates, `verify-webhook-fixtures.mjs`, Playwright. Final report attached.

## 5. Permissions / secrets needed from you

If you want to flip from `stub` → `sandbox` or `live` Nium now:
- `NIUM_API_KEY` *(sandbox first, then live)*
- `NIUM_CLIENT_ID`
- `NIUM_BASE_URL` *(defaults to `https://gateway.nium.com`)*
- `NIUM_WEBHOOK_SECRET` *(HMAC-SHA256)*

**Recommended:** keep `NIUM_MODE=stub` until steps 1–8 are merged, then move to `sandbox` for the E2E run, then `live` after the PASS report is signed off.

## 6. Out of scope (will not touch)

- BEAC PoP whitelist values (locked).
- EUR/XAF peg.
- Existing function signatures (additive only).
- Removing or renaming any current path / operationId (Standing Order 1).

---

**Deliverable on approval:** all 9 sequencing steps shipped, full `NIUM_E2E_REPORT.md` with step-by-step PASS, OpenAPI bumped to 4.52.0, SDK READMEs + Postman regenerated, CI green.
