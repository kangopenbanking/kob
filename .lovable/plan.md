## Auto-fetch KOB Merchant Directory into Virtual Card Surfaces

Wire the public `merchants-qr-directory` + `merchants-qr-get` endpoints (shipped in v4.31.0) into every virtual-card-facing surface so any KOB merchant or business becomes instantly discoverable and payable via QR — with no manual configuration per merchant.

### Goal

Whenever a user opens a virtual-card screen (Consumer PWA, Business PWA `/biz`, Merchant Portal `/merchant`, or external partner card apps via SDK), the active KOB merchant catalogue is auto-fetched, cached, and kept fresh — so scanning a KOB merchant QR resolves the payee without any lookup friction.

---

### 1. Shared data hook (single source of truth)

Create `src/hooks/useMerchantDirectory.ts`:
- React Query hook hitting `GET https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants-qr-directory`
- Cursor-based auto-pagination (loops until `has_more=false`, capped at 1000 rows per refresh)
- Filters: `country`, `category`, `search` (client-side over `name`)
- `staleTime: 5 min`, `refetchInterval: 5 min`, `refetchOnWindowFocus: true`
- Persists last snapshot to `localStorage` (`kob_merchant_dir_v1`) for offline QR-decode resolution
- Exposes `{ merchants, byId, isLoading, refetch, lastSyncedAt }`

Companion hook `useMerchantQR(merchantId, { amount?, ref? })` → `merchants-qr-get` for on-demand EMVCo payload generation (used by "Show my QR" tiles).

### 2. Wire into Virtual Card surfaces

| Surface | File | Change |
|---|---|---|
| Consumer PWA — Virtual Card screen | `src/pages/customer/VirtualCard*.tsx` (existing) | Mount `useMerchantDirectory()`; show "Pay a KOB merchant" search field + recents |
| QR Scanner result handler | scanner that detects `kob_pos_pay` / EMVCo payloads | Resolve scanned merchant ID via `byId` map before calling `qr-initiate-payment` |
| Business PWA `/biz/home` | `src/pages/biz/BizHome.tsx` | Add "Your QR poster" tile (calls `useMerchantQR(myMerchantId)`) + live "QR payments today" feed |
| Merchant Portal | new `src/pages/merchant/QRAcceptance.tsx` route `/merchant/qr-acceptance` | Lists own QR config, downloadable EMVCo poster (PNG/PDF), partner-payment report table |
| Merchant nav | `src/components/merchant/merchant-navigation-config.ts` | Add "QR Acceptance" under **Payments** with `QrCode` icon |

### 3. Background sync for partner SDK consumers

Add `directory.sync()` to the `qr` namespace in:
- `packages/sdk-node/src/index.ts`
- `packages/sdk-python/kangopenbanking/__init__.py`
- `packages/sdk-php/src/Resources/`

Each SDK gets a built-in 5-minute cache + cursor pagination identical to the React hook so external virtual-card apps poll once, not per scan.

### 4. Realtime freshness (optional but cheap)

Subscribe to `gateway_merchants` row changes via Supabase Realtime in `useMerchantDirectory` (filter `status=eq.active`). On INSERT/UPDATE invalidate the React Query cache → instant propagation when a new merchant is KYB-approved, no 5-min wait.

Requires: `ALTER PUBLICATION supabase_realtime ADD TABLE public.gateway_merchants;` (migration).

### 5. Public listing edge-function tweak

Confirm `merchants-qr-directory` returns the fields the UIs need. If `logo_url`, `category_label`, `accepts_partner_cards` are missing from the `merchant_qr_directory` view, extend the view (additive — Standing Order 4) and bump OpenAPI to **v4.31.1** (patch).

### 6. Tests

- Vitest: `src/hooks/__tests__/useMerchantDirectory.test.ts` — pagination loop, localStorage hydration, realtime invalidation
- Playwright: `e2e/authenticated/merchant-directory-autosync.spec.ts` — scanner picks up a freshly KYB-approved merchant within one refetch cycle

### 7. Files to create / edit

Created:
- `src/hooks/useMerchantDirectory.ts`
- `src/hooks/useMerchantQR.ts`
- `src/pages/merchant/QRAcceptance.tsx`
- `src/hooks/__tests__/useMerchantDirectory.test.ts`
- `e2e/authenticated/merchant-directory-autosync.spec.ts`
- `supabase/migrations/<ts>_realtime_gateway_merchants.sql`
- `docs/governance/CHANGELOG-v4.31.1.md` (only if view extended)

Edited:
- `src/App.tsx` (route `/merchant/qr-acceptance`)
- `src/components/merchant/merchant-navigation-config.ts`
- `src/pages/biz/BizHome.tsx` (or current Biz home file)
- Existing virtual-card pages + QR scanner result handler
- `packages/sdk-node`, `sdk-python`, `sdk-php` — add `qr.directory.sync()`
- `src/config/version.ts`, `public/openapi.json`, `public/openapi.yaml`, `public/changelog.json`, `public/CHANGELOG.md`, `CHANGELOG.md` (only if view extended → 4.31.1)

### Compliance

- Standing Orders 1, 2, 4 (additive only, no renames)
- P1 Public First (directory endpoint already public/anon)
- P5 Working Code (smoke test in Playwright)
- Direct Backend Mandate (`https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1`)

Approve to switch to build mode.