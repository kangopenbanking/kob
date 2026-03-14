# KOB v1 Identity Audit — Security Posture

## Rate Limits & Lockouts
- **OTP verification**: 10 attempts / 10 minutes (IP-based)
- **PIN login**: 3 failed attempts → 30-minute lockout
- **CAPTCHA**: Optional for PIN check, advisory for PIN login, triggered on suspicious patterns

## Token Security
- All OAuth access/refresh tokens stored as SHA-256 hashes
- `Cache-Control: no-store` + `Pragma: no-cache` on all token responses
- Refresh token rotation supported via identity-session endpoint
- mTLS supported for FAPI 1.0 Advanced clients

## MFA / Step-up Authentication
- TOTP, SMS OTP, Email OTP factor types
- Challenges expire after 5 minutes, codes stored as SHA-256 hashes
- Required for: key rotation, payout config, role changes, settlement updates

## Session Management
- Single active session per app context (customer/banking/merchant)
- 5-minute inactivity timeout with 60-second warning
- Device fingerprinting and IP tracking via `user_sessions` table
- Instant displacement via Supabase Realtime

## Audit Logging
- `audit_logs`: All identity events (register, login, MFA, onboarding)
- `security_audit_logs`: Risk-scored events with IP/user-agent
- `suspicious_activities`: Automated flagging for high-risk patterns
- `consent_events`: AISP/PISP consent lifecycle

## Secret Storage
- API keys, webhook secrets, PINs: SHA-256 hashed via `hash_secret_value()`
- TOTP secrets: stored encrypted (KMS integration recommended for production)
- No plaintext secrets retrievable from database

## RBAC Enforcement
- `has_role()` and `has_permission()` as SECURITY DEFINER functions
- RLS on all 6 new identity tables
- `identity_memberships` for entity-scoped access control
- Admin-only policies use `has_role(auth.uid(), 'admin')` checks
