
# Full System Audit Report -- Edge Cases, Invalid Inputs, and Breakability Analysis

## Methodology

Read all critical customer-app pages, auth guards, merchant pages, institution pages, and shared components. Traced every form/CTA to its backend call. Focused on: stale session exploits, PIN bypass vectors, direct DB writes for financial data, amount validation gaps, XSS vectors, missing error handling.

---

## FINDINGS

### HIGH SEVERITY

**H1. PayByBankApproval uses `getSession()` -- stale session exploit**
- File: `src/pages/customer-app/PayByBankApproval.tsx` (lines 38, 55, 74)
- Three calls to `supabase.auth.getSession()` which reads from localStorage and can be stale/spoofed
- On line 59, `session.user.id` is passed directly to the edge function as `user_id` -- if session is stale, a different user could authorize payments
- On line 76, `session?.user?.id` is used without null check -- if session is null, `undefined` is sent as user_id to reject flow
- **Fix:** Replace all 3 with `supabase.auth.getUser()`, add null guard on reject path

**H2. MerchantPayByBank uses `getSession()` to resolve merchant identity**
- File: `src/pages/merchant/MerchantPayByBank.tsx` (line 22)
- Uses `session.user.id` to query `gateway_merchants` -- stale session could show wrong merchant's intents
- **Fix:** Replace with `getUser()`

**H3. MerchantWooSync uses `getSession()` for auth check**
- File: `src/pages/merchant/MerchantWooSync.tsx` (line 69)
- `getSession()` check before invoking `pos-inventory-sync` -- stale token could fail silently
- **Fix:** Replace with `getUser()`

**H4. InstitutionApiClients uses `getSession()` + manual Authorization header**
- File: `src/pages/institution/InstitutionApiClients.tsx` (line 75)
- Extracts `session.access_token` manually and passes as Authorization header -- redundant and stale-prone since Supabase SDK auto-attaches the JWT
- **Fix:** Replace with `getUser()`, remove manual header

**H5. MermaidDiagram -- unsanitized `dangerouslySetInnerHTML`**
- File: `src/components/developer/MermaidDiagram.tsx` (line 72)
- The `chart` prop is rendered through Mermaid which produces SVG. Mermaid's output is injected via `dangerouslySetInnerHTML` without DOMPurify sanitization. If a developer portal user can control the diagram definition (e.g. from API spec or user-generated docs), this is an XSS vector.
- **Fix:** Wrap Mermaid SVG output with `DOMPurify.sanitize(svg)` before injection

### MEDIUM SEVERITY

**M1. CustomerTransfer -- no idempotency key on `api-transfers` call**
- File: `src/pages/customer-app/CustomerTransfer.tsx` (line 175)
- The `api-transfers` edge function is called without an `idempotency_key` in the body. If user double-taps "Confirm & Send" or network retries, duplicate transfers could occur.
- The `sending` state disables the button, but network-level retries bypass this
- **Fix:** Generate `transfer_${sourceAccountId}_${Date.now()}` idempotency key and include in the request body

**M2. CustomerTransfer -- amount allows pasting non-numeric via programmatic paste**
- File: `src/pages/customer-app/CustomerTransfer.tsx` (line 361)
- `onChange` strips non-digits with `.replace(/\D/g, '')`, but `amount` is stored as string and converted via `Number(amount || 0)`. Pasting "0000" produces amount=0 which passes the `amountNum <= 0` check but creates a 0-value transfer request. The edge function should reject, but the UI should validate `amountNum >= minimum_amount` (e.g., 100 XAF).
- **Fix:** Add minimum amount validation (e.g., `amountNum < 100`)

**M3. CustomerCashOut -- direct `app_notifications` insert is non-critical but bypasses edge function pattern**
- File: `src/pages/customer-app/CustomerCashOut.tsx` (line 229)
- After successful withdrawal, inserts directly into `app_notifications`. While this is a non-financial write (notification only), it breaks the "all writes through edge functions" pattern. If RLS changes, this could silently fail.
- **Fix:** Move notification creation into the `gateway-process-withdrawal` edge function itself

**M4. CustomerOnboarding -- direct `customer_linked_accounts` insert without server-side validation**
- File: `src/pages/customer-app/CustomerOnboarding.tsx` (line 219)
- Account linking during onboarding inserts directly into `customer_linked_accounts`. No server-side validation of the account number format, no duplicate check. A user could link multiple accounts rapidly or inject malformed metadata.
- **Fix:** Route through an edge function (e.g., `customer-link-account`) that validates and deduplicates

**M5. CustomerRegister -- direct `kyc_verifications` insert**
- File: `src/pages/customer-app/CustomerRegister.tsx` (line 161)
- KYC verification record is inserted directly from the client. While the `status: 'pending'` is hardcoded (user can't mark themselves as verified), a malicious client could insert multiple pending records or manipulate fields like `document_type`.
- **Fix:** Route KYC submission through an edge function that enforces rate limits and validates document types

**M6. CustomerLinkedAccounts -- direct `customer_linked_accounts` insert and soft-delete**
- File: `src/pages/customer-app/CustomerLinkedAccounts.tsx` (lines 655, 684)
- Both add and remove operations are direct DB writes. The remove sets `is_active: false` and calls `increment_removal_count` RPC. However, there's no server-side limit on how many accounts a user can link.
- **Fix:** Enforce max linked accounts via edge function or DB trigger

### LOW SEVERITY

**L1. CustomerSettings -- password change has no old password verification**
- File: `src/pages/customer-app/CustomerSettings.tsx` (line 120)
- Uses `supabase.auth.updateUser({ password: newPassword })` which only requires an active session. If a session is hijacked, the attacker can change the password without knowing the old one.
- Note: Supabase's `updateUser` does require a valid JWT, so this is partially mitigated. But adding old password verification is a defense-in-depth measure.

**L2. CustomerHelp -- direct `app_notifications` insert for support requests**
- File: `src/pages/customer-app/CustomerHelp.tsx` (line 114)
- Support form submissions are stored as notifications, not via a proper support ticket edge function. This limits traceability.

**L3. Amount inputs accept leading zeros**
- Multiple files (Transfer, CashOut, FundWallet, SplitBills)
- Entering "0001000" produces amount 1000 (correct), but the display is ugly. Minor UX issue.

---

## SUMMARY TABLE

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| H1 | HIGH | PayByBankApproval.tsx | `getSession()` -- stale session in payment authorization | Replace with `getUser()` |
| H2 | HIGH | MerchantPayByBank.tsx | `getSession()` -- stale merchant identity | Replace with `getUser()` |
| H3 | HIGH | MerchantWooSync.tsx | `getSession()` -- stale auth check | Replace with `getUser()` |
| H4 | HIGH | InstitutionApiClients.tsx | `getSession()` + manual auth header | Replace with `getUser()`, remove manual header |
| H5 | HIGH | MermaidDiagram.tsx | Unsanitized `dangerouslySetInnerHTML` (XSS) | Add `DOMPurify.sanitize()` |
| M1 | MEDIUM | CustomerTransfer.tsx | No idempotency key on transfer API call | Add idempotency key |
| M2 | MEDIUM | CustomerTransfer.tsx | Amount allows 0 value past UI validation | Add minimum amount check |
| M3 | MEDIUM | CustomerCashOut.tsx | Direct `app_notifications` insert | Move to edge function |
| M4 | MEDIUM | CustomerOnboarding.tsx | Direct `customer_linked_accounts` insert | Route through edge function |
| M5 | MEDIUM | CustomerRegister.tsx | Direct `kyc_verifications` insert | Route through edge function |
| M6 | MEDIUM | CustomerLinkedAccounts.tsx | Direct insert/update without server-side limits | Add max account limit |
| L1 | LOW | CustomerSettings.tsx | No old password verification | Add old password field |
| L2 | LOW | CustomerHelp.tsx | Support via notifications, not tickets | Improve traceability |
| L3 | LOW | Multiple | Leading zeros in amount inputs | Strip leading zeros |

---

## IMPLEMENTATION PLAN

### Batch 1 -- High Severity (5 fixes)
1. **PayByBankApproval.tsx**: Replace 3x `getSession()` with `getUser()`, add null guard on reject
2. **MerchantPayByBank.tsx**: Replace `getSession()` with `getUser()`
3. **MerchantWooSync.tsx**: Replace `getSession()` with `getUser()`
4. **InstitutionApiClients.tsx**: Replace `getSession()` with `getUser()`, remove manual Authorization header
5. **MermaidDiagram.tsx**: Add DOMPurify import and sanitize SVG output

### Batch 2 -- Medium Severity (6 fixes)
6. **CustomerTransfer.tsx**: Add idempotency key generation, add minimum amount validation (100 XAF)
7. **CustomerCashOut.tsx**: Remove direct `app_notifications` insert (edge function already handles this)
8. **CustomerOnboarding.tsx**: Wrap linked account creation in try/catch with better validation
9. **CustomerRegister.tsx**: Add document type whitelist validation before insert
10. **CustomerLinkedAccounts.tsx**: Add client-side max account check (e.g., 10 accounts)
11. **CustomerTransfer.tsx**: Strip leading zeros from amount display

### Batch 3 -- Low Severity (2 fixes)
12. **CustomerSettings.tsx**: Add current password field for password change
13. **CustomerHelp.tsx**: Improve support submission feedback

### Files Modified
- `src/pages/customer-app/PayByBankApproval.tsx`
- `src/pages/merchant/MerchantPayByBank.tsx`
- `src/pages/merchant/MerchantWooSync.tsx`
- `src/pages/institution/InstitutionApiClients.tsx`
- `src/components/developer/MermaidDiagram.tsx`
- `src/pages/customer-app/CustomerTransfer.tsx`
- `src/pages/customer-app/CustomerCashOut.tsx`
- `src/pages/customer-app/CustomerOnboarding.tsx`
- `src/pages/customer-app/CustomerRegister.tsx`
- `src/pages/customer-app/CustomerLinkedAccounts.tsx`
- `src/pages/customer-app/CustomerSettings.tsx`
- `src/pages/customer-app/CustomerHelp.tsx`

### What Was Verified Clean
- All 5 financial flows (Transfer, FundWallet, CashOut, Bills, SendMoney) correctly gate mutations behind `PinConfirmDialog`
- All financial mutations route through edge functions (not direct DB inserts)
- `CustomerAppAuthGuard` correctly uses `getUser()` and checks profile existence
- `SessionGuard` correctly implements inactivity timeout and single-session enforcement
- DOMPurify is used for admin email template rendering
- Amount inputs strip non-digits on change handlers
- RIB/IBAN format validation is enforced before submission
