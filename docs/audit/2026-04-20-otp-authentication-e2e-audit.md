# OTP Authentication — E2E Audit & Remediation Report
**Date:** 2026-04-20
**Auditor:** Senior QA Automation Engineer / Full-Stack Architect
**Scope:** All OTP delivery, verification, PIN, password-reset, captcha, and authentication notification flows.

---

## 1. Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical (production breaking) | 3 | **Fixed** |
| 🟠 High (silent data integrity) | 1 | **Fixed** |
| 🟡 Medium (UX / hardening) | 4 | Documented (see §6) |
| 🟢 Verified passing | 11 | OK |

**Production-blocking issues resolved:** Firebase phone OTP session minting, password-reset OTP hash mismatch, password-reset brute-force window.

---

## 2. Inventory — OTP Surface Area

| # | Surface | Function(s) | Channel | Status |
|---|---------|-------------|---------|--------|
| 1 | Standard phone OTP — send | `phone-auth-send-otp` | SMS (Vonage), WhatsApp (Meta), Email (managed-send-email) | ✅ |
| 2 | Standard phone OTP — verify (signup/login) | `phone-auth-verify-otp` | — | ⚠️ login path returns no session (see §6.1) |
| 3 | Firebase phone OTP — verify + session bridge | `firebase-phone-verify` | Firebase reCAPTCHA + SMS | 🔴→✅ Fixed |
| 4 | PIN login (post-OTP onboarding) | `phone-auth-pin-login` | — | ✅ |
| 5 | PIN check (existence) | `phone-auth-check-pin` | — | ✅ |
| 6 | PIN set (authenticated) | `pin-code-set` | — | ✅ |
| 7 | PIN reset (post-OTP) | `pin-code-reset` | — | ⚠️ Caller-trust model (see §6.2) |
| 8 | Password reset via OTP | `password-reset-with-pin` | — | 🔴→✅ Fixed (hash mismatch + brute-force) |
| 9 | Captcha — generate | `captcha-generate` | — | ✅ |
| 10 | Captcha — verify | `captcha-verify` | — | ✅ |
| 11 | Staff PIN login | `staff-pin-login` | — | ✅ |
| 12 | Auth email hook (signup, recovery, magiclink, invite, reauthentication, email-change) | `auth-email-hook` + queue | Lovable Email Infra | ✅ |
| 13 | Admin resend verification | `admin-resend-verification` | Auth email | ✅ |
| 14 | Email OTP delivery template | inline HTML in `phone-auth-send-otp` | Email | ⚠️ Not branded via `_shared/email-templates` (see §6.3) |

---

## 3. 🔴 Critical Findings — FIXED

### 3.1 `firebase-phone-verify` — wrong `verifyOtp` type → no session minted
**Symptom (from `auth_logs` & function logs at 2026-04-20T21:42:28Z):**
```
AuthApiError: Email link is invalid or has expired
code: "otp_expired", status: 403
```
Every Firebase phone OTP login was failing **after** Firebase verified the SMS, breaking the entire phone-OTP login path on https://kob.lovable.app.

**Root cause:** Previous patch set `verifyOtp({ type: 'email' })` against a `hashed_token` produced by `generateLink({ type: 'magiclink' })`. Type mismatch → token rejected.

**Fix:** Reverted to `type: 'magiclink'`, matching the proven pattern in `phone-auth-pin-login` and `staff-pin-login`.

```ts
// supabase/functions/firebase-phone-verify/index.ts (line 147–153)
const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: 'magiclink',
});
```

### 3.2 `password-reset-with-pin` — plaintext compare against hashed column
**Symptom:** Every password-reset OTP submission silently returned `Invalid or expired OTP code`, even with correct codes.

**Root cause:** `phone-auth-send-otp` stores `SHA-256(otp_code)` in `phone_otp_codes.otp_code`. The reset function did `.eq('otp_code', otp_code)` with the **plaintext** value → guaranteed miss.

**Fix:** Lookup by `phone_number + otp_type + status` only, then SHA-256 hash the submitted code and compare against the stored hash (mirrors `phone-auth-verify-otp`).

### 3.3 `password-reset-with-pin` — no per-OTP attempt cap
**Risk:** A single `pending` OTP could be brute-forced 5 times/hr (function-level rate-limit) × the entire 10-min validity window. With no per-record `attempts` counter, an attacker with a fresh OTP target had unlimited tries until expiration.

**Fix:** Added `attempts` increment + `max_attempts` enforcement (same pattern as `phone-auth-verify-otp`). After max attempts the OTP row is marked `failed` and re-issuance required.

---

## 4. 🟠 High Finding — FIXED (rolled into §3.2/3.3)

`password-reset-with-pin` previously **never** marked OTPs as `verified` after a (broken) success path because it never reached success. With the fix, the existing `status: 'verified', verified_at: now()` block now executes correctly.

---

## 5. ✅ Verified Passing (no changes required)

| Control | Where | Verification |
|---------|-------|--------------|
| OTP hashed at rest (SHA-256) | `phone-auth-send-otp` L320–323 | ✅ |
| OTP attempt counting + lockout | `phone-auth-verify-otp` L70–87 | ✅ |
| OTP expiry enforcement (10 min) | both verifiers | ✅ |
| OTP send rate-limit (3 / 15 min / identifier) | `phone-auth-send-otp` L234–246 | ✅ |
| Captcha mandatory for OTP send | `phone-auth-send-otp` L218–230 | ✅ |
| Captcha attempt cap (3) + expiry (5 min) | `captcha-verify` L44–49 | ✅ |
| WhatsApp → SMS automatic fallback | `phone-auth-send-otp` L288–297 | ✅ |
| PIN salted-SHA-256 (`s2$<salt>$<hash>`) | `pin-code-set/reset/verify` | ✅ |
| PIN lockout (3 attempts → 30 min) | `phone-auth-pin-login` L196–207 | ✅ |
| Security event logging on every auth event | `log_security_event` RPC across all functions | ✅ |
| Single-active-session enforcement | `enforce-single-session` invoked post-login | ✅ |

---

## 6. 🟡 Medium Findings — Documented for Future Hardening

### 6.1 `phone-auth-verify-otp` `login` branch returns `user` but no session tokens
The function returns `user` (from `admin.getUserById`), but **no `access_token` / `refresh_token`**. Front-end (`src/pages/Auth.tsx`) only calls `setSession` for the Firebase path; the standard OTP login path (delivery_method = sms / whatsapp / email + standard verify) cannot complete. Today this is masked because the login UI defaults to Firebase OTP, but the standard OTP login is dead code.
**Recommendation:** Mirror `phone-auth-pin-login`: `generateLink({ type: 'magiclink' }) → verifyOtp` and return `session` object. Front-end then `supabase.auth.setSession(...)` like the Firebase path.

### 6.2 `pin-code-reset` trusts caller for OTP verification
The function relies on a comment ("caller must have already verified their identity via Firebase OTP") rather than checking a server-side proof. A direct invocation can reset any user's PIN given their phone number (rate-limit only).
**Recommendation:** Require a short-lived `otp_proof_token` issued by `firebase-phone-verify` / `phone-auth-verify-otp` and validated here before mutating `pin_code_hash`.

### 6.3 OTP email is unbranded / bypasses Lovable Email queue
`phone-auth-send-otp::sendViaEmail` posts inline HTML directly to `managed-send-email` instead of using the queued, retry-safe `_shared/email-templates/` system that auth-email-hook uses.
**Recommendation:** Move to a `transactional-email-templates/` template (e.g. `otp-code.tsx`) and call `send-transactional-email` for retry/DLQ/suppression compliance.

### 6.4 `firebase-phone-verify` placeholder email uses legacy `@phone.kob.cm`
New users created via Firebase phone get `@phone.kob.cm` placeholders, while the canonical scheme used elsewhere is `{kang_id}@kang.id`. Inconsistent placeholders complicate later normalization (already handled in `phone-auth-verify-otp` and `normalize-user-email`).
**Recommendation:** After insert, normalize to `{kang_id}@kang.id` via `auth.admin.updateUserById` (same code path that already exists in `phone-auth-verify-otp` L204–225).

---

## 7. Notifications, Alerts & Email — Auth Coverage

| Event | Channel | Status |
|-------|---------|--------|
| Signup confirmation | `auth-email-hook` → `signup.tsx` template → pgmq `auth_emails` queue | ✅ |
| Magic link | `auth-email-hook` → `magic-link.tsx` | ✅ |
| Password recovery | `auth-email-hook` → `recovery.tsx` | ✅ |
| Email change | `auth-email-hook` → `email-change.tsx` | ✅ |
| Invite | `auth-email-hook` → `invite.tsx` | ✅ |
| Reauthentication | `auth-email-hook` → `reauthentication.tsx` | ✅ |
| OTP code (SMS) | Vonage `KOB API` sender | ✅ |
| OTP code (WhatsApp) | Meta WA Business API, text message | ✅ |
| OTP code (Email) | inline HTML via `managed-send-email` | ⚠️ §6.3 |
| Login security event | `audit_logs` + `app_notifications` | ✅ |
| PIN lockout | `audit_logs` (`pin_login_failed`) | ✅ — consider in-app push (§6) |
| Single-session takeover | `enforce-single-session` revokes prior tokens | ✅ |
| Admin verification resend | `admin-resend-verification` re-issues `signup` link | ✅ |

**Gaps in user-facing alerts:**
- No push/email notification on PIN lockout (silent — user only sees lockout on next attempt).
- No alert on suspicious-IP first-login (geo/IP available in `audit_logs.geolocation` but no notifier wired).

---

## 8. Test Matrix — End-to-End

| Flow | Pre-fix | Post-fix |
|------|---------|----------|
| Firebase phone OTP login (existing user) | ❌ `otp_expired` 403 | ✅ session minted |
| Firebase phone OTP signup (new user) | ❌ blocked at session step | ✅ user + session created |
| Standard SMS OTP send (signup) | ✅ | ✅ |
| Standard email OTP send | ✅ | ✅ (cosmetic gap §6.3) |
| Standard OTP verify (signup) | ✅ | ✅ |
| Standard OTP verify (login) | ⚠️ returns user, no session | ⚠️ unchanged — see §6.1 |
| PIN login (existing user) | ✅ | ✅ |
| PIN reset post-OTP | ⚠️ trust model | ⚠️ unchanged — see §6.2 |
| Password reset via OTP | ❌ silent fail (hash mismatch) | ✅ works + brute-force capped |
| Captcha gate | ✅ | ✅ |
| WhatsApp → SMS fallback | ✅ | ✅ |
| OTP brute-force (5+ wrong codes) | ✅ blocked | ✅ blocked |
| OTP expiry (>10 min) | ✅ enforced | ✅ enforced |
| Auth-email queue (DLQ on Mailgun 5xx) | ✅ | ✅ |

---

## 9. Files Changed in This Pass

| File | Change |
|------|--------|
| `supabase/functions/firebase-phone-verify/index.ts` | Reverted `verifyOtp` type from `'email'` → `'magiclink'` (Critical 3.1) |
| `supabase/functions/password-reset-with-pin/index.ts` | Hash-compare OTP + add per-record attempt cap (Critical 3.2 + 3.3) |
| `docs/audit/2026-04-20-otp-authentication-e2e-audit.md` | This report |

No DB schema changes. No frontend changes (all fixes server-side). No deletions.

---

## 10. Recommended Next Batches

| Batch | Items | Risk |
|-------|-------|------|
| F | Standard OTP login session minting (§6.1) | Low — additive |
| G | `pin-code-reset` require OTP-proof token (§6.2) | Medium — protocol change |
| H | OTP email → branded transactional template (§6.3) | Low — cosmetic + reliability win |
| I | Firebase placeholder email normalization (§6.4) | Low |
| J | PIN-lockout push/email alert + suspicious-IP first-login alert | Low |

Awaiting approval to execute Batches F–J in subsequent passes.
