# KOB v1 Identity — Gap Report

## Gaps Identified & Addressed

| # | Gap | Resolution |
|---|-----|-----------|
| 1 | No MFA / step-up authentication | Created `mfa_factors`, `mfa_challenges` tables + `identity-mfa` edge function with TOTP/SMS/Email support |
| 2 | No unified identity namespace | Created `identity-register`, `identity-login`, `identity-mfa`, `identity-session`, `identity-onboarding` |
| 3 | No `developer_orgs` table | Created with sandbox_active → prod_approved lifecycle |
| 4 | No unified onboarding tracker | Created `onboarding_applications` table with draft→submitted→approved flow |
| 5 | No entity-scoped RBAC | Created `identity_memberships` table (user × entity_type × entity_id × role) |
| 6 | No session/device tracking | Created `user_sessions` table with device fingerprint, IP, user agent |
| 7 | Merchant bypasses approval | Added `onboarding_status` column to `gateway_merchants` |
| 8 | No "Getting Started by type" | Created `GettingStartedByType.tsx` developer portal page |
| 9 | No admin onboarding queue | Created `OnboardingManagement.tsx` admin page |
| 10 | No identity/security docs | Created IdentityGuide, OnboardingGuide, RolesPermissions pages |
