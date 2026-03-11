

# Unified Merchant App — Single Entry Point for All Merchants

## Problem

The Business App currently has a dual-route structure (`/biz` and `/biz/:merchantId`) creating an implicit multi-tenant pattern where the merchant ID must be known upfront from the URL. The user wants a single app at `/biz` where any merchant or staff member logs in, and the app automatically resolves their merchant context from the database.

## Architecture Change

```text
CURRENT:  /biz/:merchantId/auth  →  /biz/:merchantId/home
                                     (merchant ID from URL)

NEW:      /biz/auth  →  /biz/home
                        (merchant ID resolved from logged-in user via hook)
```

The `:merchantId` routes will be removed entirely. A new `useMerchantContext` hook will resolve the merchant ID after login by querying `gateway_merchants` (for owners) or `merchant_staff_roles` (for staff).

## Implementation Plan

### 1. Create `src/hooks/useMerchantContext.ts`

A shared hook that:
- Queries `gateway_merchants` for the logged-in user's `user_id` to get their merchant ID (owner path)
- Falls back to `merchant_staff_roles` to get the `merchant_id` for staff
- Caches the result in React Query with a long `staleTime`
- Returns `{ merchantId, isOwner, isStaff, isLoading }`

### 2. Update `BusinessAuth.tsx`

- Remove `useParams` for `merchantId` — the app always lives at `/biz/auth`
- On successful login, resolve merchant ID via `useMerchantContext` logic (inline query)
- If user has no merchant account: show option to register
- Add a **"Register your business"** button that navigates to `/biz/register` (a new mobile-optimized registration page)
- All navigation uses `/biz/...` (no merchant ID in URL)

### 3. Create `src/pages/business-app/BusinessRegister.tsx`

A mobile-first merchant registration flow within the Business App (adapting the existing `MerchantRegister.tsx` desktop form to the PWA design system):
- Multi-step form: Business Info → Contact → Settings → Review
- Calls the existing `gateway-merchant-register` edge function
- After success, redirects to `/biz/home`
- Styled with the Warm Minimal design system (rounded cards, subtle shadows)

### 4. Update `BusinessSplash.tsx`

- Remove `merchantId` param usage
- Always redirect to `/biz/auth` or `/biz/home`

### 5. Update `BusinessAppLayout.tsx`

- Remove `merchantId` from `useParams`
- Use `useMerchantContext()` to get the merchant ID
- Pass it down via React context or let child components use the hook directly
- `basePath` is always `/biz`
- `SessionGuard` context is always `'biz'`

### 6. Update all Business App pages (14 files)

Every page that currently does `useParams<{ merchantId?: string }>()` will instead use `useMerchantContext()` to get the merchant ID. The `basePath` will always be `/biz`.

Files to update:
- `BusinessHome.tsx`, `BusinessWallet.tsx`, `BusinessOrders.tsx`, `BusinessMore.tsx`
- `BusinessReceive.tsx`, `BusinessTill.tsx`, `BusinessProducts.tsx`
- `BusinessQuickOrder.tsx`, `BusinessCustomers.tsx`, `BusinessCoupons.tsx`
- `BusinessReviews.tsx`, `BusinessStaff.tsx`, `BusinessStorefront.tsx`, `BusinessInventory.tsx`

### 7. Update `App.tsx` Routes

Remove the duplicate `/biz/:merchantId/*` route block entirely. Keep only:
```
/biz          → BusinessSplash
/biz/auth     → BusinessAuth
/biz/register → BusinessRegister (NEW)
/biz/*        → BusinessAppLayout (with child routes)
```

### 8. Update `useBusinessData.ts`

No change to the hook signature — it still accepts `merchantId` as a parameter. The difference is that callers will now get it from `useMerchantContext()` instead of `useParams()`.

## Files to Create/Edit

| File | Action |
|---|---|
| `src/hooks/useMerchantContext.ts` | **Create** — resolves merchant ID from auth |
| `src/pages/business-app/BusinessRegister.tsx` | **Create** — mobile merchant registration |
| `src/pages/business-app/BusinessAuth.tsx` | Edit — remove URL params, add register link |
| `src/pages/business-app/BusinessSplash.tsx` | Edit — remove URL params |
| `src/components/business-app/BusinessAppLayout.tsx` | Edit — remove URL params, use context hook |
| `src/pages/business-app/BusinessHome.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessWallet.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessOrders.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessMore.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessReceive.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessTill.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessProducts.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessQuickOrder.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessCustomers.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessCoupons.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessReviews.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessStaff.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessStorefront.tsx` | Edit — use `useMerchantContext` |
| `src/pages/business-app/BusinessInventory.tsx` | Edit — use `useMerchantContext` |
| `src/App.tsx` | Edit — remove `:merchantId` routes, add register route |

## Key Design Decisions

- **No URL-based merchant ID**: The merchant context comes from the authenticated user's database records, not the URL. This prevents unauthorized access to other merchants' data.
- **Registration within the app**: New merchants can register directly from the Business App auth screen, keeping them in the mobile-first experience.
- **Backward compatibility**: The `useBusinessData` hook interface stays the same; only the source of `merchantId` changes.

