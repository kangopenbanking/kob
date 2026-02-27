

## Flutterwave Mobile Money Funding — End-to-End Gap Analysis & Fix Plan

### Root Cause

The funding intent is created successfully, but payments never complete because **there is no client-side polling mechanism for Flutterwave mobile money**. Unlike Stripe (which has `StripeCardConfirm` with `confirmWithBackend` polling), the Flutterwave mobile money flow dead-ends after intent creation.

Here is the flow and where it breaks:

```text
Frontend → gateway-create-funding-intent → Flutterwave API (charge)
         ← Intent created (status: pending_provider)
         ← UI shows "Funding Intent Created" ... AND STOPS HERE

         No polling. No webhook arriving. Payment stuck forever.
```

### Gaps Identified (5 total)

**Gap 1: No `next_action` for mobile money charges**
In `gateway-create-funding-intent/index.ts` (line 151-161), when Flutterwave returns no `redirect_url` (which is the norm for USSD/STK-push mobile money), `next_action` stays `null`. The frontend has no instruction to poll or wait.

**Gap 2: No MobileMoneyConfirm component**
`FundingResult.tsx` handles `redirect_url`, `approval_url`, `stripe_confirm`, and `bank_transfer_instructions` — but has **zero handling** for mobile money "waiting for user to confirm on phone" state with polling.

**Gap 3: Flutterwave adapter lacks defensive response parsing**
`gateway-adapters.ts` line 130: `const data = await res.json()` — if Flutterwave returns HTML (e.g., rate limit page or error), this crashes silently.

**Gap 4: Flutterwave adapter missing timeout**
No `AbortSignal.timeout()` on the fetch call — can hang indefinitely.

**Gap 5: `gateway-confirm-funding` status mapping mismatch**
Line 82: maps `successful` → `succeeded` but `mapFlutterwaveStatus` returns `'successful'` for completed transactions. The reconciler (`gateway-reconcile-funding`) maps to `'successful'` (not `'succeeded'`), creating an inconsistency — reconciler finalizes to `status: 'successful'` while confirm-funding finalizes to `status: 'succeeded'`.

---

### Implementation Plan

#### Step 1: Fix `createFlutterwaveCharge` adapter — defensive parsing + timeout
File: `supabase/functions/_shared/gateway-adapters.ts`

- Add `AbortSignal.timeout(60000)` to the Flutterwave fetch call
- Check `Content-Type` before calling `.json()`
- Wrap JSON parse in try/catch with meaningful error
- Log the Flutterwave response for debugging

#### Step 2: Set proper `next_action` for Flutterwave mobile money in intent creator
File: `supabase/functions/gateway-create-funding-intent/index.ts`

- When `resolvedProvider === 'flutterwave'` and no `redirect_url` is returned (USSD push flow), set:
  ```
  next_action = { type: 'mobile_money_confirm', message: 'Confirm the payment on your phone' }
  status = 'pending_customer_action'
  ```
- When a `redirect_url` IS returned, keep existing redirect logic

#### Step 3: Create `MobileMoneyConfirm` component with polling
New file: `src/components/funding/MobileMoneyConfirm.tsx`

- Shows a "Waiting for mobile money confirmation" UI with phone icon and animated indicator
- Polls `gateway-confirm-funding` every 5 seconds (up to 12 attempts = 60s)
- On success: shows success state, calls `onSuccess`
- On failure: shows error with retry option
- On timeout: shows "check back later" message

#### Step 4: Wire `MobileMoneyConfirm` into `FundingResult`
File: `src/components/funding/FundingResult.tsx`

- Add a condition for `result.next_action?.type === "mobile_money_confirm"` that renders the new `MobileMoneyConfirm` component with `fundingIntentId={result.id}`

#### Step 5: Fix status inconsistency in `gateway-reconcile-funding`
File: `supabase/functions/gateway-reconcile-funding/index.ts`

- In `finalizeIntent`, map `'successful'` → `'succeeded'` to match the `funding_intents` status enum used everywhere else

