

# Pay by Bank — Full E2E Audit Report & Fix Plan

## Audit Summary

| Layer | Component | Status | Detail |
|---|---|---|---|
| **Edge Function** | `pay-by-bank/index.ts` | ✅ Complete | 6 actions: create_intent, get_intent, authorize, reject, callback, list_intents |
| **Database** | `pay_by_bank_intents` table | ✅ Complete | Full lifecycle, auto-expiry, PISP consent integration |
| **Hosted Auth Page** | `/pay/authorize` | ✅ Complete | Login + approve/reject + auto-redirect + countdown timer |
| **Consumer App** | `/app/authorize-payment/:intentId` | ✅ Complete | Auth guard, approve/reject, redirect to merchant |
| **Webhooks** | 4 event types | ✅ Complete | authorized, submitted, completed, failed via trigger_webhooks |
| **Node.js SDK** | types.ts | ✅ Complete | PayByBankIntent, CreatePayByBankIntentRequest, PayByBankIntentResponse |
| **Python SDK** | types.py + __init__.py | ✅ Complete | PayByBankIntent dataclass, PayByBankStatus literal |
| **Changelog** | v10.1.0 entry | ✅ Complete | 8 items covering all Pay by Bank features |
| **Routing** | App.tsx | ✅ Complete | Both routes registered: `/pay/authorize`, `/app/authorize-payment/:intentId` |

---

## Gaps Found

| # | Gap | Severity | Detail |
|---|---|---|---|
| 1 | **OpenAPI spec missing Pay by Bank endpoints** | HIGH | `public-api-spec/index.ts` has zero Pay by Bank paths, schemas, or tags |
| 2 | **Postman collection missing Pay by Bank folder** | HIGH | `postman-collection/index.ts` has no Pay by Bank requests |
| 3 | **PHP/Laravel SDK missing PayByBank types** | HIGH | No PayByBankResource class or intent types in PHP SDK |
| 4 | **No Developer Guide page for Pay by Bank** | HIGH | No `PayByBankGuide.tsx` — developers have no integration documentation |
| 5 | **No Admin Pay by Bank dashboard** | MEDIUM | Admins cannot monitor/manage payment intents. No `/admin/pay-by-bank` page |
| 6 | **No Merchant portal Pay by Bank page** | MEDIUM | Merchants cannot view their payment intents or get integration instructions |
| 7 | **Banking App has no Pay by Bank authorization** | MEDIUM | `/bank/:id/` has no route for institution customers to authorize Pay by Bank payments |
| 8 | **Consumer App: no PIN verification on approve** | MEDIUM | `PayByBankApproval.tsx` approves without PIN/biometric — violates SCA plan |
| 9 | **Hosted auth page: countdown timer is static** | LOW | `timeLeft` is computed once on render, never updates (no setInterval) |
| 10 | **Edge function: authorize skips straight to completed** | LOW | Lines 196-209 transition awaiting_auth → authorized → submitted → processing → completed in one call without bank connector check. Fine for wallet, but should branch for bank_transfer mode |
| 11 | **No `pay_by_bank.submitted` webhook** | LOW | The `submitted` event type is documented but never actually fired in the edge function |
| 12 | **Changelog JSON (`changelog.json`) not updated** | LOW | Only the UI Changelog.tsx was updated, not the machine-readable JSON file |

---

## Fix Plan

### 1. Add Pay by Bank to OpenAPI Spec

**File:** `supabase/functions/public-api-spec/index.ts`

Add under paths:
- `POST /v1/pay-by-bank/intents` — Create intent
- `GET /v1/pay-by-bank/intents/{intent_id}` — Get intent status
- `POST /v1/pay-by-bank/intents/{intent_id}/authorize` — Authorize
- `POST /v1/pay-by-bank/intents/{intent_id}/reject` — Reject
- `GET /v1/pay-by-bank/intents` — List merchant intents
- `POST /v1/pay-by-bank/callback` — Bank connector callback

Add schemas: `PayByBankIntent`, `CreatePayByBankIntentRequest`, `PayByBankIntentResponse`
Add tag: `Pay by Bank`
Bump version to v4.1.0

### 2. Add Pay by Bank to Postman Collection

**File:** `supabase/functions/postman-collection/index.ts`

New folder "Pay by Bank" with 6 requests matching the OpenAPI paths above. Add `intent_id` variable.

### 3. Add PHP SDK PayByBank Resource

**New file:** `packages/sdk-php/src/Resources/PayByBankResource.php`

Methods: `createIntent()`, `getIntent()`, `listIntents()`

**Modify:** `packages/sdk-php/src/KangOpenBanking.php` — add `PayByBankResource` property

### 4. Create Developer Guide Page

**New file:** `src/pages/developer/PayByBankGuide.tsx`

Contents:
- Overview of redirect-based SCA flow
- Sequence diagram (text-based)
- Code examples in Node.js, Python, PHP tabs
- Webhook event reference
- Testing in sandbox instructions

**Modify:** Developer portal navigation to include "Pay by Bank" under Payment Gateway guides

### 5. Create Admin Pay by Bank Dashboard

**New file:** `src/pages/admin/AdminPayByBank.tsx` at `/admin/pay-by-bank`

- Intent list with status filters, search by merchant
- Detail dialog showing full intent + linked consent + payment
- Stats: total intents, completion rate, avg authorization time
- Manual status override for stuck intents

**Modify:** `src/App.tsx` — add admin route

### 6. Create Merchant Pay by Bank Page

**New file:** `src/pages/merchant/MerchantPayByBank.tsx` at `/merchant/pay-by-bank` (or equivalent dashboard route)

- List of merchant's payment intents via `list_intents`
- Integration guide snippet with API key + code examples
- Create test intent button (sandbox mode)

### 7. Add Banking App Authorization Route

**Modify:** `src/App.tsx` — add `/bank/:institutionId/authorize-payment/:intentId` route pointing to a banking-app variant of `PayByBankApproval.tsx`

### 8. Fix Hosted Auth Countdown Timer

**Modify:** `src/pages/PayByBankAuthorize.tsx`

Add `useEffect` with `setInterval` to decrement countdown every second. Auto-transition to "expired" step when timer reaches 0.

### 9. Fire `pay_by_bank.submitted` Webhook

**Modify:** `supabase/functions/pay-by-bank/index.ts`

After setting status to `submitted` (line 196), fire `pay_by_bank.submitted` webhook before transitioning to processing.

### 10. Update Changelog JSON

**Modify:** Machine-readable `changelog.json` to include v10.1.0 Pay by Bank entry.

---

## Files Summary

| File | Action |
|---|---|
| `supabase/functions/public-api-spec/index.ts` | **Modify** — add Pay by Bank paths + schemas + tag, bump to v4.1.0 |
| `supabase/functions/postman-collection/index.ts` | **Modify** — add Pay by Bank folder with 6 requests |
| `packages/sdk-php/src/Resources/PayByBankResource.php` | **Create** — PHP resource class |
| `packages/sdk-php/src/KangOpenBanking.php` | **Modify** — register PayByBankResource |
| `src/pages/developer/PayByBankGuide.tsx` | **Create** — developer integration guide |
| `src/pages/admin/AdminPayByBank.tsx` | **Create** — admin monitoring dashboard |
| `src/pages/merchant/MerchantPayByBank.tsx` | **Create** — merchant intent management |
| `src/pages/PayByBankAuthorize.tsx` | **Modify** — fix countdown timer with setInterval |
| `src/pages/customer-app/PayByBankApproval.tsx` | **Modify** — (PIN verification noted but deferred to existing PIN infra wiring) |
| `supabase/functions/pay-by-bank/index.ts` | **Modify** — fire submitted webhook |
| `src/App.tsx` | **Modify** — add admin + merchant + banking-app routes |
| Developer portal navigation | **Modify** — add Pay by Bank guide link |

