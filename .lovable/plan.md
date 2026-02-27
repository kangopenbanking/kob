

## Fix: Media Banners Not Displaying

### Root Cause
The `defaultSectionOrder` in both `TenantProvider.tsx` and `BankingAppManagement.tsx` does NOT include `media_banner`. Unless an admin has manually clicked "Add Media Banner" in section order settings, banners never appear -- even if media items have been added.

### Implementation Steps

#### 1. Include `media_banner` in default section order
- **`TenantProvider.tsx`**: Add `'media_banner'` to `defaultSectionOrder` array, positioned just before `'recent_transactions'`
- **`BankingAppManagement.tsx`**: Same change to its local `defaultSectionOrder`
- New order: `balance_card → account_carousel → quick_actions → financial_services → media_banner → recent_transactions`

#### 2. Make `media_banner` render conditionally even when in order
- In `BankHome.tsx`, `renderMediaBanner` already returns `null` when no media items exist -- so including it in default order is safe (no empty gap)
- In `BankingAppManagement.tsx` admin preview, the `media_banner` case already shows a placeholder when no media is configured -- also safe

#### 3. Auto-add `media_banner` to section order when media items are added
- In `BankingAppManagement.tsx`, when a user adds a media item via the MediaSectionManager and `media_banner` is not already in `section_order`, automatically insert it before `recent_transactions`

These are minor changes across 2 files (3 lines each) that fix the visibility gap.

