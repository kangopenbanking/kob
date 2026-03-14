

# KOB v1: Registration + Login + Onboarding Modernization Plan

## Phase 0 — Current State Audit Summary

### What Already Exists (Robust)

**Authentication:**
- Phone OTP (SMS/WhatsApp/both) via `phone-auth-send-otp`, `phone-auth-verify-otp`
- PIN-based login via `phone-auth-pin-login`, `phone-auth-check-pin`
- Firebase Phone Auth fallback for Cameroon (+237)
- Captcha challenge system (`captcha-verify`)
- Brute-force lockout (3 attempts / 30-min)
- Session management with single-active-session enforcement
- 5-minute inactivity timeout

**OAuth 2.0 / OIDC:**
- Full OAuth token endpoint with mTLS, PKCE, client_credentials, authorization_code, refresh_token grants
- DCR (Dynamic Client Registration)
- PAR (Pushed Authorization Requests)
- Token introspection, revocation
- JWKS endpoint, OIDC discovery
- Hashed token storage (SHA-256)

**Registration Flows (4 types):**
- **Personal**: Auth.tsx (phone/email tabs with captcha + OTP + PIN)
- **Institution**: Register.tsx → `institution-register` edge function → PendingApproval page
- **Merchant**: MerchantRegister.tsx → direct `gateway_merchants` insert → MerchantDashboard
- **Developer/TPP**: TPPRegistration.tsx → `dcr-register` edge function + `developer-register-app`

**KYC/KYB:**
- Customer KYC: `kyc-submit` + admin review via `admin-kyc-review`
- Business KYB: `business-kyc-submit` + `admin-kyb-verify`
- Private document storage with signed URLs
- Three-tier verification (100K/5M XAF/day)

**RBAC:**
- 8 roles via `app_role` enum: admin, personal, institution, merchant, tpp, staff, moderator, developer
- `has_role()` + `has_permission()` SECURITY DEFINER functions
- RoleGuard component for frontend route protection
- Staff assignments with portal permissions

**Admin Portal:**
- Institution verification, KYC review, KYB review, TPP registrations
- Merchant management, user management, access roles
- Audit logs, security monitoring

**Audit Logging:**
- `audit_logs` table with `log_audit_event()` function
- `security_audit_logs` with risk scoring
- `suspicious_activities` tracking
- Consent event logging

### Gaps Identified

1. **No MFA / Step-up authentication** — No TOTP, no MFA challenge flow for sensitive operations
2. **No unified `/v1/identity/*` namespace** — Auth flows are scattered across separate edge functions
3. **No `developer_orgs` table** — Developers register apps but have no org-level entity
4. **No unified onboarding status endpoint** — Each entity type has different status tracking
5. **No onboarding_applications table** — KYC/KYB exist but no unified application tracker
6. **No membership/RBAC mapping table** — Roles are in `user_roles` but not entity-scoped
7. **No rotating refresh tokens with reuse detection** — OAuth refresh tokens exist but no rotation enforcement
8. **No session/device tracking table** — Single-session enforced via Realtime, no persistent device registry
9. **Merchant registration bypasses approval** — Direct insert, no KYB gating before production keys
10. **No developer portal "Getting Started by account type"** — Only TPP-focused guide exists

---

## Implementation Plan (Non-Breaking, Additive)

### Phase 1: Database Migrations (6 new tables, 2 extensions)

**New tables:**
1. `developer_orgs` — id, name, user_id, status (sandbox_active|prod_requested|prod_approved|suspended), created_at, updated_at
2. `mfa_factors` — id, user_id, type (sms_otp|totp|email_otp), secret_encrypted, phone_snapshot, enabled, verified_at, created_at
3. `mfa_challenges` — id, user_id, factor_id, challenge_code_hash, expires_at, verified_at, created_at
4. `onboarding_applications` — id, entity_type (personal|merchant|institution|developer_org), entity_id, user_id, status (draft|submitted|under_review|approved|rejected), submitted_at, reviewed_at, reviewer_user_id, notes, created_at, updated_at
5. `user_sessions` — id, user_id, device_fingerprint, ip_address, user_agent, last_seen_at, created_at, revoked_at
6. `identity_memberships` — id, user_id, entity_type, entity_id, role, status (active|suspended), created_at

**Extensions to existing tables:**
- `gateway_merchants`: Add `onboarding_status` column (default 'active' for existing rows — backwards compatible)
- Insert default `system_config` rows for MFA policies

**Seed data:**
- Demo developer_org, onboarding_applications in various states

### Phase 2: Edge Functions (New Identity Layer)

All new endpoints under additive namespace. Existing `/v1/auth/*` and `/v1/oauth/*` remain untouched.

**identity-register** — `POST /v1/identity/register`
- Accepts `account_type` (personal|merchant|institution|developer)
- Creates user entity + `onboarding_applications` record
- Returns `entity_id`, `next_steps[]`, provisional token (for sandbox)
- Delegates to existing `institution-register`, `gateway_merchants` insert, or new `developer_orgs` insert internally

**identity-login** — `POST /v1/identity/login`
- Supports `phone_otp`, `email_password`, `pin` methods
- Wraps existing phone-auth functions
- Returns `access_token`, `refresh_token`, `mfa_required` flag
- If MFA required, returns `challenge_id` for step-up

**identity-mfa** — `POST /v1/identity/mfa/*`
- Actions: `enable-totp`, `challenge`, `verify`, `disable`
- TOTP via otpauth:// URI generation
- SMS OTP challenge for step-up
- Required for: key rotation, payout config changes, role changes

**identity-session** — Session management
- `POST /v1/identity/token/refresh` (rotating refresh with reuse detection)
- `POST /v1/identity/logout`
- `GET /v1/identity/me` (current user + roles + entity memberships)

**identity-onboarding** — `POST /v1/onboarding/{type}/start|submit|status|documents`
- Unified onboarding lifecycle
- Wraps existing KYC/KYB submit functions
- Adds `onboarding_applications` tracking

**admin-onboarding-review** — `POST /v1/admin/onboarding/{type}/{id}/approve|reject`
- Wraps existing `admin-kyc-review`, `admin-kyb-verify`, `admin-institution-approve`
- Updates `onboarding_applications` status
- Audit logged

### Phase 3: Frontend Changes

**New pages:**
1. `src/pages/developer/GettingStartedByType.tsx` — Account type selector (Personal / Merchant / Institution / Developer) with guided flows per type
2. `src/pages/admin/OnboardingManagement.tsx` — Unified onboarding application queue across all entity types
3. `src/pages/SecuritySettings.tsx` — Enhance existing with MFA enrollment section (TOTP QR code, SMS backup)

**Enhanced pages:**
- `Auth.tsx` — Add account type selector on signup (personal is default, link to merchant/institution/developer registration)
- `MerchantRegister.tsx` — After registration, create `onboarding_applications` record, route to status page
- `Dashboard.tsx` — Show onboarding progress banner if application is pending

**Admin navigation:**
- Add "Onboarding Queue" under "Registration & Verification" section

### Phase 4: Documentation & API Updates

**New docs pages:**
- `src/pages/developer/IdentityGuide.tsx` — Security & MFA guide
- `src/pages/developer/OnboardingGuide.tsx` — KYB/KYC lifecycle by account type
- `src/pages/developer/RolesPermissions.tsx` — RBAC reference

**OpenAPI updates** (`public/openapi.json` + `public-api-spec`):
- Add Identity tag with 8 new endpoints
- Add Onboarding tag with 6 new endpoints
- Add Admin-Onboarding tag with 2 endpoints
- Add MFA schemas

**Postman collection** (`postman-collection/index.ts`):
- Add Identity folder (register/login/mfa/refresh/me/logout)
- Add Onboarding folder (start/submit/status/documents per type)
- Add Admin Onboarding folder

**Changelog:**
- v4.0.0: Identity API layer, MFA, unified onboarding, developer orgs, RBAC memberships

### Phase 5: Audit Documentation

Create under `docs/identity/`:
- `audit.md` — Current state findings
- `route-inventory.md` — All auth/identity routes mapped
- `gap-report.md` — Gaps addressed
- `non-breaking-plan.md` — Compatibility guarantees
- `security-posture.md` — Rate limits, lockouts, token rotation, audit log coverage

---

## What This Does NOT Change (Zero Breaking)

- All existing `/v1/auth/*` endpoints remain identical
- All existing `/v1/oauth/*` endpoints remain identical
- Existing `user_roles`, `institutions`, `gateway_merchants` tables unchanged structurally
- Existing `RoleGuard`, `DashboardRouter`, auth flows all preserved
- Customer/Banking/Business PWA auth flows untouched
- All 260+ existing edge functions unchanged

## Files Summary

| Action | Count | Examples |
|--------|-------|---------|
| New edge functions | 5 | identity-register, identity-login, identity-mfa, identity-session, identity-onboarding |
| New pages | 4 | GettingStartedByType, OnboardingManagement, IdentityGuide, OnboardingGuide |
| New DB tables | 6 | developer_orgs, mfa_factors, mfa_challenges, onboarding_applications, user_sessions, identity_memberships |
| New docs | 5 | audit.md, route-inventory.md, gap-report.md, non-breaking-plan.md, security-posture.md |
| Enhanced pages | 4 | Auth.tsx, MerchantRegister.tsx, SecuritySettings, admin-navigation |
| Updated specs | 3 | openapi.json, public-api-spec, postman-collection |

