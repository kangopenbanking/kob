

## KOB API Card + Bank Transfer Integration Audit

### Current State (Verified)

The integrator is correct. Tracing `gateway-create-charge` and the unified `/v1/gateway/charges` endpoint confirms:

| Channel | Status | Gap |
|---|---|---|
| `mobile_money` | ✅ Works E2E (Flutterwave/MTN/Orange) | `verify-status` returns optimistic "successful" without re-checking provider |
| `card` | ⚠️ Charge row created, Stripe PaymentIntent created | Response omits `client_secret` and `redirect_url` — integrator has nothing to confirm with |
| `bank_transfer` | ⚠️ Charge row created | Response omits account number / reference / instructions |
| `paypal` | ⚠️ Order created | `approval_url` not surfaced on `/charges` (only on funding-intent flow) |

**Root cause**: `gateway-create-charge` returns the DB row only. Provider-specific `next_action` data (Stripe `client_secret`, Flutterwave `redirect_url`, bank account details, PayPal `approval_url`) is computed but never attached to the response. `provider_raw` stays `null` because it's populated only by the webhook callback.

This violates **Standing Order P5 (Working Code Rule)**: every documented `card` / `bank_transfer` / `paypal` example fails for integrators because there is no field to act on.

### Recommended Path: **Option B — Integrate Stripe.js + surface `next_action` for all channels**

Hiding `card` (Option A) breaks the public API contract and contradicts the docs. Waiting on KOB support (Option C) is a no-op — *we are KOB*. The correct fix is to make `/charges` return a Stripe-style `next_action` block, then ship a thin Stripe.js helper for card confirmation.

---

### Fix Plan

**1. Standardize the `next_action` response envelope on `/v1/gateway/charges`**

Update `supabase/functions/gateway-create-charge/index.ts` to return a `next_action` object alongside the charge row, shaped per channel:

```jsonc
// card
"next_action": {
  "type": "stripe_confirm_card",
  "client_secret": "pi_xxx_secret_xxx",
  "publishable_key": "pk_test_xxx",     // safe to expose
  "publishable_key_env": "test"
}

// bank_transfer
"next_action": {
  "type": "bank_transfer_instructions",
  "bank_name": "...", "account_number": "...",
  "account_name": "...", "reference": "...",
  "expires_at": "..."
}

// mobile_money
"next_action": {
  "type": "mobile_money_push",
  "message": "Approve the USSD prompt on 237677...",
  "poll_url": "/v1/gateway/charges/{id}/verify"
}

// paypal
"next_action": { "type": "paypal_redirect", "approval_url": "..." }

// already-paid / no further action
"next_action": null
```

This matches Stripe's PaymentIntent contract and the existing internal `FundingResult.tsx` shape — so the public API and the internal funding flow finally agree.

**2. Wire Stripe card flow end-to-end inside `gateway-create-charge`**

For `channel: "card"`:
- Create Stripe PaymentIntent (already done in `gateway-preauth-charge` — extract to `_shared/stripe-helpers.ts` and reuse).
- Persist `provider_ref = pi_xxx` and `client_secret` in `gateway_charges.metadata.stripe`.
- Return `client_secret` + the merchant's Stripe **publishable** key (read from `gateway_merchants.stripe_publishable_key`, fall back to platform `STRIPE_PUBLISHABLE_KEY` secret) inside `next_action`.

**3. Wire bank-transfer instructions for `channel: "bank_transfer"`**

Reuse the logic already present in the funding-intent path (`bank_transfer_instructions` branch in `FundingResult.tsx`):
- For KOB-partner banks → generate virtual account via `kob-bank-transfer-issue` helper, return account_number + reference.
- For non-partner banks → return Flutterwave-issued account from `/v3/charges?type=bank_transfer` response.

**4. Fix the mobile-money verify-status bug**

`gateway-verify-charge` currently returns the local DB status without re-polling the provider. Update it to:
1. If charge is terminal (`successful`/`failed`/`refunded`) → return as-is.
2. Else → call provider's `getStatus()` (MTN MoMo `/requesttopay/{ref}`, Orange Money status, Flutterwave verify) via the existing `payment-connectors` adapters.
3. Update DB row + emit `charge.successful` / `charge.failed` webhook event.
4. Return refreshed status.

This eliminates the "fake success" without provider confirmation.

**5. Publish a Stripe.js helper for integrators**

Add a documented snippet (no new dependency for KOB itself — integrators install `@stripe/stripe-js` in their app):

```js
// docs/developer-portal/payments/card-confirmation.md (NEW)
import { loadStripe } from '@stripe/stripe-js';

const charge = await fetch('/v1/gateway/charges', { /* sk_test_, channel: 'card' */ }).then(r=>r.json());
const stripe = await loadStripe(charge.next_action.publishable_key);
const { error, paymentIntent } = await stripe.confirmCardPayment(
  charge.next_action.client_secret,
  { payment_method: { card: cardElement } }
);
// then POST /v1/gateway/charges/{id}/verify to finalize on KOB side
```

Add the same snippet in Node, Python, PHP, Java, Go (Standing Order P9).

**6. Update OpenAPI + docs (Standing Order P10)**

- `public/openapi.json` + `public/openapi.yaml` — add `next_action` discriminated union to `Charge` response schema.
- `docs/developer-portal/payments/unified-payments.md` — replace example response with one showing `next_action`.
- `docs/developer-portal/payments/payment-methods.md` — add "How to complete the payment" subsection per channel.
- New: `docs/developer-portal/payments/card-confirmation.md` (Stripe.js flow, 6 languages).
- New: `docs/developer-portal/payments/bank-transfer-instructions.md`.

**7. Changelog (Standing Order #6 + P7)** — bump **v4.16.2 → v4.16.3**:
> **Added**: `next_action` field on `POST /v1/gateway/charges` response, exposing `client_secret` (card), bank account details (bank_transfer), USSD message (mobile_money), and `approval_url` (paypal). **Fixed**: `POST /v1/gateway/charges/{id}/verify` now re-polls the upstream provider instead of returning cached status. Resolves P5 Working Code Rule violation for card and bank_transfer channels.

**8. E2E verification**

Live curl probes via `supabase--curl_edge_functions`:
- `POST /gateway/charges` with `channel: "card"` → expect `next_action.client_secret` + `publishable_key` present.
- `POST /gateway/charges` with `channel: "bank_transfer"` → expect `next_action.account_number`, `reference`.
- `POST /gateway/charges` with `channel: "mobile_money"` → expect `next_action.poll_url`.
- `POST /gateway/charges/{id}/verify` for a pending MoMo charge → expect upstream `getStatus()` call in logs (no fake success).
- Re-run `api-contract-test` suite — must stay green.

---

### Files Touched

| File | Action |
|---|---|
| `supabase/functions/_shared/stripe-helpers.ts` | **NEW** — extracted PaymentIntent creation |
| `supabase/functions/_shared/charge-next-action.ts` | **NEW** — builds `next_action` per channel |
| `supabase/functions/gateway-create-charge/index.ts` | Attach `next_action`, wire card + bank_transfer |
| `supabase/functions/gateway-verify-charge/index.ts` | Re-poll provider, no fake success |
| `public/openapi.json`, `public/openapi.yaml` | Add `next_action` schema |
| `docs/developer-portal/payments/unified-payments.md` | Updated response example |
| `docs/developer-portal/payments/payment-methods.md` | Per-channel completion steps |
| `docs/developer-portal/payments/card-confirmation.md` | **NEW** (6 languages) |
| `docs/developer-portal/payments/bank-transfer-instructions.md` | **NEW** |
| `src/pages/developer/Changelog.tsx` | v4.16.3 entry |

**No table changes. No removals. No breaking changes.** The `next_action` field is additive — existing integrators ignoring it keep working; new integrators get a complete contract.

### Standing Order Compliance

| Order | Verdict |
|---|---|
| #1 Lock — no renames | ✅ |
| #2 Ratchet — only adds `next_action` | ✅ |
| #3 Audit Trail — cites P5 Working Code Rule | ✅ |
| #4 Surgeon — additive response field | ✅ |
| #6 Version Gate — patch bump 4.16.2 → 4.16.3 | ✅ |
| P5 Working Code Rule — restored for card/bank_transfer | ✅ |
| P9 Multi-Language — 6 languages in new docs | ✅ |
| P10 Living Docs — OpenAPI + 4 doc pages updated | ✅ |

