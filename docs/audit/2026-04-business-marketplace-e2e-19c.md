# Business Marketplace E2E Audit — 2026-04-19c

**Scope:** `/biz/storefront`, `/biz/products`, `/biz/products/new`, `/biz/products/:id`, customer-facing store rendering, city catalog.

## Findings & Fixes

| # | Area | Severity | Finding | Fix |
|---|---|---|---|---|
| 1 | BusinessProductForm | High | No marketplace category, no images, no draft/active control | Added Main + Sub-category (with custom override), up to 6 images via storage upload, status toggle. Auto-creates `pos_categories` rows and links via `pos_product_category_links`. |
| 2 | BusinessStorefront | High | No storefront style options, no live preview, no category field, no sub-category persistence | Added 4 storefront templates (Classic / Modern / Bold / Minimal), live `StorePreview` panel reflecting template + brand color, category & sub-category persisted to `pos_store_profiles`. |
| 3 | Cities catalog | High | Only 8–10 hard-coded cities per region; no way to add custom city/village | Expanded `CAMEROON_CITIES` to 200+ subdivision and locality entries across all 10 regions. New `CitySelector` component with inline "Add custom city/village" entry that persists user-entered values. |
| 4 | CustomerStoreDetail | High | Selected `image_url` from `pos_product_images` — column does not exist (real column is `url`); product images never rendered | Replaced selector + accessors to use `url`. |
| 5 | StorePreview | Medium | Hard-coded purple, single layout | Themed by `template` + `primaryColor`; banner height, radius, badge style and overlay vary per template. Reused on both Business storefront editor and merchant storefront. |
| 6 | Product variants on update | Medium | New variants added to existing product were never persisted (only existing IDs updated) | Added insert path for variants without `id` (with required `merchant_id`). |
| 7 | Storefront preview entry point | Low | "Preview" button only opened external URL | Live in-page preview now rendered above branding section; external "Open" button retained. |

## E2E Validation Steps

1. `/biz/storefront` → choose template → preview updates in place ✅
2. Switch region → city dropdown refreshes with 20-30 entries ✅
3. Choose "＋ Add custom city / village…" → type → saves to profile ✅
4. `/biz/products/new` → set category + sub-category + 2 images + 2 variants → save ✅
5. Edit product → categories pre-selected, images preloaded ✅
6. Customer app → published store now renders product images via `pos_product_images.url` ✅

## Files Changed
- `src/lib/storefront-data.ts` — expanded city list
- `src/lib/storefront-templates.ts` (new) — 4 templates
- `src/components/storefront/CitySelector.tsx` (new) — region + city + custom
- `src/components/storefront/StorePreview.tsx` — themed preview
- `src/pages/business-app/BusinessStorefront.tsx` — templates, live preview, category, custom city
- `src/pages/business-app/BusinessProductForm.tsx` — categories, images, status, variant insert fix
- `src/pages/customer-app/CustomerStoreDetail.tsx` — image column fix

No DB migrations required — all changes use existing `pos_categories`, `pos_product_category_links`, `pos_product_images`, and `pos_store_profiles.custom_brand_json` columns.
