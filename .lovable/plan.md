

# Public Documentation Enhancement Plan

## Analysis Summary

All three capabilities the user flagged as "not appearing public" are in fact **fully implemented** and **already have documentation pages**:

| Capability | Edge Function | Doc Page | Sidebar Link |
|---|---|---|---|
| Custodial Wallet APIs | `gateway-wallets` (380+ lines) | `/developer/gateway/wallets` | Yes (Wallets & Escrow section) |
| Outbound Payout Engine | `gateway-instant-payout` (428 lines), `gateway-process-withdrawal`, `gateway-payouts` | `/developer/gateway/payouts`, `/developer/gateway/instant-payouts` | Yes (Transfers section) |
| Instant Rails (Visa Direct / MC Send) | `gateway-push-to-card` (399 lines), `gateway-payout-rails` | `/developer/gateway/instant-payouts` | Yes |

**However**, the documentation pages are thin compared to Stripe and Flutterwave. The pages list endpoints but lack the contextual depth, architecture explanations, flow diagrams, and "how it works" narratives that make Stripe/Flutterwave docs convincing. Someone browsing the portal could easily miss these as real, production-grade capabilities.

---

## Identified Gaps (What Makes Them Look Missing)

### 1. Wallets Guide (`WalletsGuide.tsx`)
- **Missing**: No "How It Works" architecture section explaining KOB as a custodial provider
- **Missing**: No multi-currency wallet creation examples
- **Missing**: No webhook events section (`wallet.credited`, `wallet.debited`, `wallet.frozen`)
- **Missing**: No "Unfreeze" endpoint documentation (the edge function supports it)
- **Missing**: No code examples (curl, Node.js, Python) like Stripe/Flutterwave show

### 2. Instant Payouts Guide (`InstantPayoutsGuide.tsx`)
- **Missing**: No architecture diagram showing the rail selection engine
- **Missing**: No detailed rail comparison table (speed, fees, limits, operating hours, prefunding)
- **Missing**: No `speed: "auto"` parameter documentation (the edge function supports auto fallback)
- **Missing**: No treasury/float prefunding explanation
- **Missing**: No compliance screening flow mention
- **Missing**: No webhook events for payout lifecycle (`payout.processing`, `payout.completed`, `payout.failed`, `payout.reversed`)
- **Missing**: Destination object schema is vague ("bank account, mobile number, or card") -- needs structured breakdown

### 3. Treasury Guide (`TreasuryGuide.tsx`)
- **Missing**: Only 2 endpoints, no explanation of the prefunding model
- **Missing**: No float utilization metrics endpoint
- **Missing**: No connection to instant payouts (reader doesn't understand WHY treasury exists)

### 4. Payouts Guide (`GatewayPayoutsGuide.tsx`)
- **Missing**: No link to Instant Payouts or Push-to-Card from the standard payouts page
- **Missing**: No comparison table showing standard vs instant vs push-to-card

### 5. Landing Page (`IntegrationOverview.tsx`)
- The "Wallets & Escrow" and "Instant Payouts" cards exist but descriptions are too brief to convey these are full APIs, not just features

---

## Implementation Plan (4 Tasks)

### Task 1: Enhance Wallets Guide with Professional Depth
**File**: `src/pages/developer/WalletsGuide.tsx`

Add before the API endpoints:
- **"How It Works" section**: Paragraph explaining KOB provides full custodial wallet infrastructure -- programmatic wallet accounts, balance tracking, ledger operations
- **Architecture callout**: Three-state model already exists but expand with a visual flow (create -> credit -> debit -> freeze lifecycle)
- **Multi-currency example**: Show creating XAF, USD, EUR wallets for the same owner
- **Webhook Events table**: `wallet.credited`, `wallet.debited`, `wallet.frozen`, `wallet.unfrozen`
- **Code examples block**: curl + Node.js for create wallet and credit operations
- **Unfreeze endpoint**: Add `POST /v1/wallets/:wallet_id/unfreeze` documentation
- **Use Cases section**: Marketplace payee balances, gig-economy worker wallets, prepaid card funding, loyalty points ledger

### Task 2: Enhance Instant Payouts Guide with Rail Engine Details
**File**: `src/pages/developer/InstantPayoutsGuide.tsx`

Add:
- **"How It Works" architecture section**: Explain the auto-routing engine -- submit payout -> compliance screen -> rail selection -> float check -> provider dispatch -> webhook delivery
- **Rail Comparison Table**: Structured table showing all rails (mobile_money, bank_transfer, visa_direct, mc_send) with columns: Speed, Estimated Time, Fee Structure, Min/Max Amount, Currencies, Countries, Operating Hours, Prefunding Required
- **Speed Parameter deep-dive**: Document all three speeds (`instant`, `standard`, `auto`) with auto-fallback behavior
- **Destination Object Schema**: Break into 3 typed variants (bank, momo, card) with all required fields from the edge function
- **Prefunding & Float section**: Brief explanation that instant rails require treasury prefunding, link to Treasury guide
- **Compliance section**: Note that all payouts run inline AML/sanctions screening
- **Webhook Events**: `payout.processing`, `payout.completed`, `payout.failed`, `payout.reversed`
- **Code examples**: curl for instant MoMo payout, push-to-card, and rails listing
- **Error codes table**: GW_006 through GW_010 with meanings

### Task 3: Enhance Treasury Guide and Link to Payout Engine
**File**: `src/pages/developer/TreasuryGuide.tsx`

Add:
- **"Why Treasury Matters" section**: Explain prefunding model -- instant rails debit from a pre-loaded float pool, not from real-time bank transfers
- **Connection to Instant Payouts**: Explicit note that treasury float powers the instant payout engine
- **Float Utilization endpoint**: `GET /v1/treasury/utilization` showing per-rail utilization stats
- **Auto-replenishment rules section**: Explain the `treasury.float.low` webhook and automatic threshold-based replenishment
- **Webhook events**: `treasury.float.low`, `treasury.replenishment.completed`

### Task 4: Add Cross-Links and Payout Comparison Matrix
**Files**: `GatewayPayoutsGuide.tsx`, `IntegrationOverview.tsx`

In `GatewayPayoutsGuide.tsx`:
- Add a **"Payout Options Comparison"** table at the top: Standard Payouts vs Instant Payouts vs Push-to-Card, with speed, channels, and fee ranges
- Add navigation links to Instant Payouts and Push-to-Card guides

In `IntegrationOverview.tsx`:
- Enhance the Wallets card description to explicitly say "Full custodial wallet infrastructure with programmatic credit/debit and three-state balance model"
- Enhance the Instant Payouts card to say "Visa Direct, Mastercard Send, MoMo instant, and bank transfer with intelligent rail routing and treasury-backed prefunding"
- Add a **Treasury** card linking to `/developer/gateway/treasury`

