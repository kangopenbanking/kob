

## Plan: Multi-Consumer Funding Intents API

### Current State
- `funding_intents` table only has `account_id` + `user_id` — scoped to end-users funding their own KOB accounts
- Edge function enforces `account.user_id === auth.uid()` — no merchant, institution, or external API path
- `oauth-token` does NOT implement `client_credentials` grant (only `authorization_code` and `refresh_token`)
- Merchant wallets exist (`gateway_merchant_wallets`) but have no funding intent integration
- Institution float/clearing accounts have no dedicated funding path

### Schema Changes (Migration)

Add columns to `funding_intents`:
- `funding_scope text DEFAULT 'end_user'` — enum: `end_user | merchant | institution | external_api`
- `merchant_id uuid REFERENCES gateway_merchants(id)` — populated for merchant wallet funding
- `api_client_id text` — populated for external fintech API calls (OAuth client_credentials)
- `target_description text` — human-readable label ("Merchant wallet top-up", "Float account credit", etc.)

Add RLS policies:
- Merchants can read/insert intents where `merchant_id` matches their merchant
- Admins can read all intents (already via service_role)
- Institution owners/staff can read intents scoped to their `institution_id`

Add index on `merchant_id` and `funding_scope`.

### Edge Function Changes

**`gateway-create-funding-intent/index.ts`** — major refactor for multi-consumer:

1. **Auth layer**: Accept 3 auth modes:
   - **Bearer JWT (end-user)**: Current flow — `scope = end_user`, validates `account.user_id`
   - **Bearer JWT (merchant)**: New — if `funding_scope = merchant` + `merchant_id` provided, validate merchant ownership via `gateway_merchants.user_id`; credits `gateway_merchant_wallets` on success (not `accounts`)
   - **Bearer JWT (institution)**: New — if `funding_scope = institution`, validate institution ownership via `institutions.user_id` or staff assignment
   - **OAuth access_token (external API)**: New — if `funding_scope = external_api`, look up token in `access_tokens` table, resolve `client_id` → institution mapping, validate `account_id` belongs to that institution

2. **Routing changes**:
   - End-user: credits `account_balances` (current behavior)
   - Merchant: credits `gateway_merchant_wallets` via `update_merchant_wallet()` DB function
   - Institution: credits target institutional account (`accounts` table with institution scope)
   - External API: credits specified customer `account_id` within the institution's scope

3. **Fee policy per scope**:
   - End-user: current fee schedule (2.5%–3.5%)
   - Merchant: merchant-tier fees (configurable, default 2%)
   - Institution: institutional-tier (1.5% or waived per agreement)
   - External API: same as institution tier

**`oauth-token/index.ts`** — add `client_credentials` grant:
- Validate `client_id` + `client_secret`
- Issue access_token with scope `funding:write` (no user context, scoped to institution)
- Store in `access_tokens` table with `client_id` and no `user_id`

### Webhook Updates

**`gateway-webhook-flutterwave`, `gateway-webhook-stripe`, `gateway-webhook-paypal`**:
- When finalizing a funding intent, check `funding_scope`:
  - `end_user`: credit `account_balances` (current)
  - `merchant`: call `update_merchant_wallet()` to credit available balance
  - `institution` / `external_api`: credit target account via `account_balances`

### Admin Dashboard Updates

**`FundingManagement.tsx`**:
- Add `funding_scope` column + filter (End User / Merchant / Institution / External API)
- Show `merchant_id` or `api_client_id` in detail dialog
- Add admin ability to manually create funding intents for any scope (e.g., admin-initiated float top-up)

### Developer Documentation

**`FundingIntentsGuide.tsx`**:
- Add "Consumer Types" section with 4 tabs explaining each scope
- Add OAuth `client_credentials` flow example for external fintechs
- Add merchant wallet funding example
- Add institution float funding example

### Merchant Portal Integration

- Add "Fund Wallet" button/page in merchant portal that calls `gateway-create-funding-intent` with `funding_scope: merchant`

### Files to Create/Modify

| Action | File |
|--------|------|
| Migration | New SQL: add `funding_scope`, `merchant_id`, `api_client_id` columns + RLS policies |
| Modify | `supabase/functions/gateway-create-funding-intent/index.ts` — multi-consumer auth + routing |
| Modify | `supabase/functions/oauth-token/index.ts` — add `client_credentials` grant |
| Modify | `supabase/functions/gateway-webhook-flutterwave/index.ts` — scope-aware crediting |
| Modify | `supabase/functions/gateway-webhook-stripe/index.ts` — scope-aware crediting |
| Modify | `supabase/functions/gateway-webhook-paypal/index.ts` — scope-aware crediting |
| Modify | `src/pages/admin/FundingManagement.tsx` — scope filter + display |
| Modify | `src/pages/developer/FundingIntentsGuide.tsx` — multi-consumer docs |
| Create | `src/pages/merchant/MerchantFundWallet.tsx` — merchant self-service funding page |
| Modify | Merchant portal navigation — add "Fund Wallet" link |
| Modify | `src/test/funding-intents.test.ts` — add multi-scope tests |

