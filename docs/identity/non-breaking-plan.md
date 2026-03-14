# KOB v1 Identity — Non-Breaking Compatibility Plan

## Zero Breaking Changes Guarantee

### Preserved Endpoints (Untouched)
- `/v1/auth/phone/send-otp` → `phone-auth-send-otp`
- `/v1/auth/phone/verify-otp` → `phone-auth-verify-otp`
- `/v1/auth/phone/pin-login` → `phone-auth-pin-login`
- `/v1/auth/phone/check-pin` → `phone-auth-check-pin`
- `/v1/oauth/token` → `oauth-token`
- `/v1/oauth/authorize` → `oauth-authorize`
- `/v1/oauth/register` → `dcr-register`
- All 260+ existing edge functions unchanged

### Preserved Tables (No Schema Changes)
- `user_roles` — unchanged
- `institutions` — unchanged
- `gateway_merchants` — only added optional `onboarding_status` column (default 'active')
- `profiles` — unchanged
- `audit_logs` — unchanged

### New Additive Layer
- 5 new edge functions under `identity-*` namespace
- 6 new database tables with RLS
- 4 new frontend pages
- 3 new developer portal guide pages
- New admin nav item "Onboarding Queue"

### Frontend Compatibility
- `RoleGuard`, `ProtectedRoute`, `DashboardRouter` — unchanged
- All PWA auth flows (Customer, Banking, Business) — unchanged
- Existing registration flows (Auth.tsx, Register.tsx, MerchantRegister.tsx) — unchanged
