

# Plan: Fix All Confirmed Gaps for Production Readiness

## Diagnosis

After thorough codebase analysis, here is the real status of each reported issue:

### Issues That Are NOT Code Bugs (Infrastructure/Deployment)

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| 7 of 9 sub-pages redirect to homepage | **Stale publish** -- all routes are correctly defined in App.tsx under `PublicDeveloperLayout` with no auth guard | Click "Publish" to deploy current build |
| DNS failure on api.kangopenbanking.com | Custom domain DNS not configured for API subdomain | External DNS setup required (not a code change) |
| DNS failure on sandbox.kangopenbanking.com | Same as above | External DNS setup required |
| Terms/Privacy redirect to homepage | Routes exist at `/terms`, `/privacy` wrapped in public `Layout` -- stale publish | Click "Publish" |
| Swagger UI not publicly accessible | Route exists at `/developer/api-explorer` -- stale publish | Click "Publish" |
| Rate-limit documentation missing | Exists at `/developer/api/rate-limits` with full tables | Click "Publish" |

### Actual Code Gaps to Fix

| Gap | Current State | Action |
|-----|--------------|--------|
| No COBAC registration number published | SecurityCompliancePage mentions COBAC but no registration number | Add registration number to compliance page |
| No public pentest/security audit report | SecurityCompliancePage lists certifications but no downloadable audit | Add audit disclosure section |
| FAPI certification not independently verified | Listed as "Compliant" but no verification link | Add OpenID Foundation reference link |
| POS/Catalog endpoints -- spec only, not live | Edge functions exist but no public status indicator | Add "Beta" badges and availability table to POS guide |
| API base URL references hardcoded to api.kangopenbanking.com | 845 references across 70 files -- will 404 until DNS resolves | Update `API_CONFIG` to use Lovable Cloud edge function URL as primary, with custom domain as display URL |

## Implementation Steps

### Step 1: Fix API Base URL Strategy
Update `src/config/api.ts` to use the working Supabase functions URL as the runtime endpoint while displaying `api.kangopenbanking.com` in documentation. Add a helper that code examples reference.

### Step 2: Enhance SecurityCompliancePage
Add to `src/pages/developer/SecurityCompliancePage.tsx`:
- COBAC registration reference number (placeholder for real number)
- Downloadable security audit summary section
- FAPI certification verification link
- Incident response policy table (already partially exists)

### Step 3: Add POS Module Availability Status
Update `src/pages/developer/MerchantsPOSGuide.tsx`:
- Add "Beta" badge and availability matrix
- Clarify which POS endpoints are live vs planned
- Add deployment timeline

### Step 4: Create Dedicated SLA Page in Developer Portal
Add a route at `/developer/sla` that consolidates SLA targets, uptime guarantees, and incident response from the existing SecurityCompliancePage into a standalone document accessible from the developer portal sidebar.

### Step 5: Ensure All API Code Examples Use Fallback URL
Create a shared constant `API_EXAMPLE_BASE_URL` that code example components (`ApiEndpoint.tsx`, `SdkExamples.tsx`) reference, so examples work even before custom domain DNS is configured.

## Files to Modify

| File | Change |
|------|--------|
| `src/config/api.ts` | Add runtime URL helper + example base URL constant |
| `src/pages/developer/SecurityCompliancePage.tsx` | Add COBAC reg number, audit section, FAPI link |
| `src/pages/developer/MerchantsPOSGuide.tsx` | Add availability matrix with Beta badges |
| `src/pages/developer/SLAPage.tsx` | New: dedicated developer-portal SLA page |
| `src/components/developer/PublicDeveloperLayout.tsx` | Add SLA to sidebar nav |
| `src/App.tsx` | Add `/developer/sla` route |
| `src/components/developer/ApiEndpoint.tsx` | Use configurable base URL for examples |

## Critical User Action Required

**You must click "Publish" after these changes.** The majority of reported issues (sub-page redirects, legal pages, Swagger UI, rate limits) are already correctly implemented in code but not deployed to the live site. No code change can fix a stale deployment.

## Out of Scope (External Actions)

- **DNS configuration** for `api.kangopenbanking.com` and `sandbox.kangopenbanking.com` -- requires DNS provider action
- **GitHub organization creation** -- external platform action
- **Third-party pentest report** -- requires engaging an audit firm
- **COBAC actual registration number** -- requires the real regulatory reference

