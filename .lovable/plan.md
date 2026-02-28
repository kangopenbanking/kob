

## Audit: All Links Referencing Lovable or Raw Infrastructure URLs

### Findings

**Category 1: `window.location.origin` — Dynamic URLs that resolve to Lovable preview/staging domain**
These 11 files generate shareable links, redirect URLs, and email callbacks using `window.location.origin`, which resolves to `*.lovable.app` in preview or staging. These must use the production custom domain `kangopenbanking.com` instead.

| File | Usage |
|---|---|
| `src/pages/admin/InstitutionVerification.tsx` | `dashboard_url` in email |
| `src/pages/Admin.tsx` | `portal_url`, `reapply_url` in emails |
| `src/pages/CustomerFundAccount.tsx` | `return_url` for payment callback |
| `src/pages/customer-app/CustomerRequest.tsx` | Shareable payment link |
| `src/pages/merchant/MerchantPaymentLinks.tsx` | Copy payment link |
| `src/pages/banking-app/BankFundAccount.tsx` | `return_url` for payment callback |
| `src/pages/institution/GatewayPaymentLinks.tsx` | Copy payment link |
| `src/pages/institution/InstitutionFundAccount.tsx` | `return_url` for payment callback |
| `src/pages/merchant/MerchantFundWallet.tsx` | `return_url` for payment callback |
| `src/pages/customer-app/CustomerRewards.tsx` | Referral link |
| `src/components/pwa/MobileAuthForm.tsx` | `emailRedirectTo` for auth |

**Category 2: Raw Supabase project URLs (`ftwbtzbeqkqrdmxmyvvz.supabase.co`) in frontend**
These should use `api.kangopenbanking.com` instead.

| File | Usage |
|---|---|
| `src/config/api.ts` | `BASE_URL_FALLBACK` |
| `src/pages/developer/ApiExplorer.tsx` | Fallback URL for OpenAPI spec |
| `src/pages/WooForKang.tsx` | Plugin download fetch |
| `src/pages/integrations/WooCommercePluginCode.tsx` | Plugin download fetch |
| `src/pages/integrations/WooCommerceGuide.tsx` | Plugin download fetch |

**Category 3: Raw Supabase project URLs in edge functions**

| File | Usage |
|---|---|
| `supabase/functions/oidc-config/index.ts` | OAuth endpoints use raw Supabase URL |
| `supabase/functions/public-api-spec/index.ts` | OAuth URLs in security schemes |
| `supabase/functions/admin-institution-approve/index.ts` | Dashboard URL construction |

**Category 4: Lovable AI gateway (`ai.gateway.lovable.dev`) — KEEP AS-IS**
These are internal Lovable AI service calls and must NOT be changed:
- `supabase/functions/ai-anomaly-detection/index.ts`
- `supabase/functions/credit-score-tips/index.ts`

**Category 5: PostiQ external service URLs — KEEP AS-IS**
These reference a different Supabase project (PostiQ) and are correct:
- `supabase/functions/postiq-lookup-code/index.ts`
- `supabase/functions/postiq-create-code/index.ts`

---

### Implementation Plan

**Step 1: Create a centralized site URL constant**
Add `SITE_URL` to `src/config/api.ts`:
```typescript
SITE_URL: 'https://kangopenbanking.com',
```

**Step 2: Replace all `window.location.origin` with `API_CONFIG.SITE_URL`**
Update all 11 files in Category 1 to import `API_CONFIG` and use `API_CONFIG.SITE_URL` instead of `window.location.origin`. This ensures all shared links, payment callbacks, referral URLs, and auth redirects point to `kangopenbanking.com` regardless of the environment.

**Step 3: Replace raw Supabase URLs in frontend (Category 2)**
- `src/pages/developer/ApiExplorer.tsx` — change fallback to use `api.kangopenbanking.com`
- `src/pages/WooForKang.tsx`, `WooCommercePluginCode.tsx`, `WooCommerceGuide.tsx` — change plugin download URL to `https://api.kangopenbanking.com/functions/v1/woocommerce-download-plugin`

**Step 4: Replace raw Supabase URLs in edge functions (Category 3)**
- `oidc-config/index.ts` — replace `supabaseUrl` variable with `https://api.kangopenbanking.com/functions/v1` for all OAuth/JWKS/DCR endpoints
- `public-api-spec/index.ts` — update OAuth security scheme URLs
- `admin-institution-approve/index.ts` — use `https://kangopenbanking.com/fi-portal` directly

**Step 5: Update tests**
- `src/test/api-config.test.ts` — add test for `SITE_URL`
- No changes needed for fallback tests (fallback URL stays as internal safety net in config but isn't actively used in frontend code)

### Files Changed (total: ~18 files)
- 1 config file (`src/config/api.ts`)
- 11 frontend files (Category 1 + 2)
- 3 edge functions (Category 3)
- 1 test file

