

# Pay by Bank — Redirect-Based SCA Implementation Plan

## What Already Exists

| Component | Status |
|---|---|
| `pisp-create-consent` | ✅ Creates PISP consent with `AwaitingAuthorisation` status |
| `consent-authorize` | ✅ Authorizes/rejects consents; supports both API-based and form-based (PKCE) flows |
| `pisp-domestic-payment` | ✅ Creates payment against authorized consent |
| `pisp-payment-submission` | ✅ Submits payment for execution |
| `pisp_consents` table | ✅ Full lifecycle with status, expiry, creditor/debtor, risk |
| `payments` + `payment_events` tables | ✅ Payment records with event tracking |
| `oauth_sessions` + `authorization_codes` | ✅ PKCE session + code exchange |
| Consumer App (PIN/biometric auth) | ✅ `/app/scan` with QR payment approval |
| Webhook governance | ✅ HMAC-SHA256 verified, multi-endpoint, 24 event types |
| Bank connector architecture | ✅ Memory confirms file/DB/MQ/pull modes exist |

## What's Missing (The Gap)

| # | Gap | Priority |
|---|---|---|
| 1 | **No `pay_by_bank_intents` table** — need a merchant-facing payment intent that wraps PISP consent + tracks redirect_uri, state, merchant branding | HIGH |
| 2 | **No hosted authorization page** (`/pay/authorize`) — the web UI where users authenticate and approve the payment | HIGH |
| 3 | **No `pay-by-bank` edge function** — merchant-facing API to create intent, get status, handle callbacks | HIGH |
| 4 | **No Consumer App approval screen** for Pay by Bank — `CustomerScan.tsx` handles QR payments but not redirect-based bank payment authorization | HIGH |
| 5 | **No deep link handling** — `kob://authorize?consent_id=...` not wired | MEDIUM |
| 6 | **No webhook events** for `payment.authorized`, `payment.submitted`, `payment.completed`, `payment.failed` | MEDIUM |
| 7 | **No merchant checkout button component** — embeddable "Pay by Bank (KOB)" button/SDK snippet | LOW |

## Implementation Plan

### Phase 1: Database & Edge Function (Core API)

**Migration — `pay_by_bank_intents` table:**

```text
Columns: id, merchant_id, consent_id, amount, currency, 
         redirect_uri, state, status (awaiting_auth → authorized → submitted → processing → completed → failed),
         merchant_name, merchant_logo_url, debtor_account,
         creditor_account, description, expires_at,
         authorization_url, created_at, updated_at
```

RLS: service_role only (edge function mediated).

**Edge function — `pay-by-bank/index.ts`:**

Actions:
- `create_intent` — Merchant creates payment intent → auto-creates PISP consent → returns `authorization_url` + `intent_id`
- `get_intent` — Merchant polls status
- `authorize` — User approves (called from hosted page or consumer app) → marks consent authorized → creates payment + submission → triggers bank connector or wallet movement
- `reject` — User rejects → updates status → redirects with `error=access_denied`
- `callback` — Internal: bank connector confirms execution → updates status → fires webhooks
- `list_intents` — Merchant lists their payment intents

### Phase 2: Hosted Authorization Page (Web Fallback)

**New route: `/pay/authorize`** (`src/pages/PayByBankAuthorize.tsx`)

Flow:
1. URL: `/pay/authorize?intent_id=...&state=...`
2. Page fetches intent details (merchant name, amount, currency)
3. If not logged in → inline login (email/PIN or phone/PIN)
4. Shows approval screen: merchant logo, amount, account selector, fees
5. "Approve" → calls `pay-by-bank` edge function `authorize` action
6. "Reject" → calls `reject` action
7. Both redirect back to `redirect_uri?intent_id=...&status=...&state=...`

Design: Minimal, secure-feeling page (bank-grade UI). No navigation chrome. KOB branding only.

### Phase 3: Consumer App Approval Screen

**New component: `PayByBankApproval.tsx`** in customer-app

- Accessible via deep link `kob://authorize?intent_id=...` or route `/app/authorize-payment/:intentId`
- Shows merchant name/logo, amount, account picker, fee breakdown
- Confirm with PIN (reuse existing PIN verification)
- On approve → calls edge function → shows receipt → "Return to merchant" button opens `redirect_uri`

**Update `CustomerScan.tsx`** to detect `kob_pay_by_bank` QR codes (for Proposal C later).

### Phase 4: Webhook Events & Merchant Verification

Add 4 new webhook event types to the catalogue:
- `pay_by_bank.authorized`
- `pay_by_bank.submitted`
- `pay_by_bank.completed`
- `pay_by_bank.failed`

Fire via existing `trigger_webhooks()` DB function from within the edge function at each status transition.

**Merchant verification endpoint**: `GET /v1/pay-by-bank/{intent_id}` already covered by `get_intent` action.

### Phase 5: SDK & Documentation

- Add `payByBank.createIntent()`, `payByBank.getIntent()` to Node.js, Python, PHP SDKs
- Add Pay by Bank section to API docs, Postman collection, OpenAPI spec
- Add changelog entry
- Add merchant integration guide to `/developer` portal

### Phase 6 (Future): Decoupled SCA

- Merchant displays QR code with `intent_id`
- User scans in KOB app → approval screen
- Merchant polls via websocket or webhook confirms

## Files Summary

| File | Action |
|---|---|
| **Migration** | Create `pay_by_bank_intents` table with RLS |
| `supabase/functions/pay-by-bank/index.ts` | **Create** — core API (create, authorize, reject, get, list, callback) |
| `src/pages/PayByBankAuthorize.tsx` | **Create** — hosted authorization page |
| `src/pages/customer-app/PayByBankApproval.tsx` | **Create** — consumer app approval screen |
| `src/App.tsx` | **Modify** — add routes `/pay/authorize`, `/app/authorize-payment/:intentId` |
| `supabase/functions/postman-collection/index.ts` | **Modify** — add Pay by Bank endpoints |
| `supabase/functions/public-api-spec/index.ts` | **Modify** — add OpenAPI paths |
| `packages/sdk-node/src/types.ts` | **Modify** — add PayByBankIntent type |
| `packages/sdk-python/kangopenbanking/types.py` | **Modify** — add PayByBankIntent dataclass |
| `src/pages/developer/Changelog.tsx` | **Modify** — add v10.1.0 entry |

## Security Requirements

- PKCE mandatory on authorization flow
- `state` parameter validated on redirect
- CSRF token on hosted page form submissions
- Intent expires after configurable window (default 15 minutes)
- PIN/biometric required for approval (SCA)
- Device binding logged via `user_sessions`
- Risk checks: amount thresholds, velocity, merchant reputation

