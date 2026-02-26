

## Open Banking & Transfers E2E Audit Plan

### Current State Summary

**AISP (Account Information) — COMPLETE:**
- Edge functions: `aisp-create-consent`, `aisp-accounts`, `aisp-balances`, `aisp-transactions`, `aisp-beneficiaries`, `aisp-standing-orders`, `aisp-direct-debits`
- Consent lifecycle: Create → Authorize (`consent-authorize`) → Use → Revoke (`consent-revoke`)
- Expiry handled by `expire_old_consents()` DB function
- Permission checks via `check_aisp_permission` and `check_aisp_permission_with_account` DB functions
- Data access gated by `x-consent-id` header
- OpenAPI spec: 8 AISP endpoints documented
- Developer page: `AispReference.tsx` — fully documented with all endpoints and best practices
- **No gaps found**

**PISP (Payment Initiation) — COMPLETE:**
- Edge functions: `pisp-create-consent`, `pisp-domestic-payment`, `pisp-payment-submission`, `pisp-payment-details`
- Payment lifecycle: Pending → Authorized → AcceptedSettlementInProgress → Completed/Failed
- Idempotency-Key enforcement on payment-submission with 24h TTL and replay
- Consent validation with expiry check (`expires_at > NOW()`)
- Fee recording via `record_transaction_fee` RPC
- OpenAPI spec: 4 PISP endpoints + consent management
- Developer page: `PispReference.tsx` — fully documented with lifecycle, error codes, bulk payments, SWIFT/international
- **No gaps found**

**Transfer Channels — Audit Results:**

| Transfer Type | Edge Function | OpenAPI Spec | Dev Portal Page | Status |
|---|---|---|---|---|
| Bank-to-Bank (internal accounts) | `api-transfers` | **MISSING** | **MISSING** | **GAP** |
| FI-to-FI (institution) | `facilitated-bank-transfer` | `/v1/flutterwave/bank-transfer` (partial) | `BankingReference.tsx` (partial) | **GAP** |
| MoMo-to-Bank | `mobile-money-to-bank` | `/v1/mobile-money/to-bank` | **MISSING** from BankingReference | **GAP** |
| Card-to-Bank | `gateway-fund-account` + `gateway-withdraw-to-bank` | Both present | `GatewayFundingGuide.tsx`, `BankingReference.tsx` | COMPLETE |
| Customer Account-to-External Bank | `gateway-withdraw-to-bank` | Present | `GatewayFundingGuide.tsx` | COMPLETE |
| Bulk Transfers | `bulk-transfers` | `/v1/banking/bulk-transfers` | `PispReference.tsx` | COMPLETE |
| External Bank Transfer (Flutterwave) | `flutterwave-bank-transfer` | `/v1/flutterwave/bank-transfer` | **MISSING** dedicated section | **GAP** |
| FI Facilitated Bank Transfer | `facilitated-bank-transfer` | **MISSING** as distinct endpoint | **MISSING** | **GAP** |

### Identified Gaps (5 items)

#### Gap 1: Internal Account-to-Account Transfer not in OpenAPI spec
- `api-transfers` edge function exists and works (validates ownership, checks balance, creates transaction, updates balance)
- **Missing** from OpenAPI spec entirely — no `/v1/banking/internal-transfer` path
- **Missing** from developer documentation pages

#### Gap 2: Facilitated Bank Transfer not documented as distinct endpoint
- `facilitated-bank-transfer` edge function exists for institution-facilitated Flutterwave transfers with KOB fee calculation
- Not documented as a separate endpoint in OpenAPI spec (only generic `/v1/flutterwave/bank-transfer`)
- Missing from developer portal documentation

#### Gap 3: MoMo-to-Bank transfer missing from BankingReference page
- OpenAPI spec has `/v1/mobile-money/to-bank` 
- `BankingReference.tsx` doesn't mention this transfer type
- No cross-reference in the transfer documentation

#### Gap 4: No dedicated Transfers Guide page in developer portal
- Multiple transfer types exist across different edge functions but no unified "Transfers & Fund Movement" documentation page
- Transfer use cases are scattered across `PispReference.tsx`, `BankingReference.tsx`, and `GatewayFundingGuide.tsx`

#### Gap 5: Missing E2E tests for Open Banking consent lifecycle and transfer flows
- Current tests only cover gateway fee calculations and status mapping
- No tests for AISP/PISP consent creation schemas, consent expiry logic, or transfer endpoint documentation coverage

---

### Implementation Plan

#### Stage 1: Add Internal Transfer endpoint to OpenAPI spec
Add `/v1/banking/internal-transfer` to `public-api-spec/index.ts` under Banking Operations tag with full request/response schema matching `api-transfers` edge function.

#### Stage 2: Add Facilitated Transfer endpoint to OpenAPI spec
Add `/v1/banking/facilitated-transfer` to `public-api-spec/index.ts` under Banking Operations tag, documenting the institution-facilitated Flutterwave payout flow with KOB fee calculation.

#### Stage 3: Add both endpoints to Postman collection
Add "Internal Account Transfer" and "Facilitated Bank Transfer" requests to `postman-collection/index.ts`.

#### Stage 4: Create unified Transfers Guide page
Create `src/pages/developer/TransfersGuide.tsx` documenting all 6 transfer types:

```text
Transfer Types Documented:
1. Internal Account-to-Account (POST /v1/banking/internal-transfer)
2. Bank-to-External-Bank via Flutterwave (POST /v1/flutterwave/bank-transfer)
3. Institution Facilitated Transfer (POST /v1/banking/facilitated-transfer)
4. Mobile Money to Bank (POST /v1/mobile-money/to-bank)
5. Account Funding via Gateway (POST /v1/gateway/fund-account)
6. Withdrawal to External Bank (POST /v1/gateway/withdraw-to-bank)
```

Each with request/response schemas, use case descriptions, and error handling notes.

#### Stage 5: Update BankingReference.tsx
Add "Mobile Money to Bank" and "Internal Account Transfer" sections with endpoint documentation and cross-links to TransfersGuide.

#### Stage 6: Add route and navigation
- Add route in `App.tsx`: `developer/api/transfers` → `TransfersGuide`
- Add sidebar nav item in `DeveloperLayout.tsx` under Payments section: "Transfers & Fund Movement"

#### Stage 7: Expand E2E test suite
Add to `src/test/gateway-integration.test.ts`:
- AISP consent creation schema validation
- PISP payment lifecycle state validation
- Internal transfer endpoint in OpenAPI spec
- Facilitated transfer endpoint in OpenAPI spec
- MoMo-to-bank endpoint in OpenAPI spec
- All 6 transfer types documented verification

#### Stage 8: Update Changelog to v2.4.0
Add entries for:
- Internal account transfer endpoint documented
- Facilitated bank transfer endpoint documented
- Unified Transfers Guide page added
- BankingReference expanded with MoMo-to-bank and internal transfers
- E2E test suite expanded with Open Banking consent and transfer coverage

---

### Technical Details

**Files to create (1):**
- `src/pages/developer/TransfersGuide.tsx` — Unified transfers documentation page (~250 lines)

**Files to modify (6):**
- `supabase/functions/public-api-spec/index.ts` — Add 2 new paths (internal-transfer, facilitated-transfer)
- `supabase/functions/postman-collection/index.ts` — Add 2 new requests
- `src/pages/developer/BankingReference.tsx` — Add MoMo-to-bank and internal transfer sections
- `src/App.tsx` — Add TransfersGuide route
- `src/components/developer/DeveloperLayout.tsx` — Add sidebar nav item
- `src/pages/developer/Changelog.tsx` — Add v2.4.0 entry
- `src/test/gateway-integration.test.ts` — Expand with Open Banking and transfer tests

**Non-Breaking Guarantee:**
All changes are additive. No existing endpoints, routes, edge functions, or data structures are modified. Only documentation synchronization, new page creation, and test expansion.

