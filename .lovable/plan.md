

# Gracefully Dormant Virtual Cards — "Coming Soon" Treatment

## Summary

Set the Virtual Cards service to a professional "Coming Soon" state across all touchpoints — personal dashboard, PWA banking app, admin panels, and API health — without removing any code or breaking existing routes.

## Changes

### 1. Replace `VirtualCards` page content with Coming Soon state
**File: `src/pages/VirtualCards.tsx`**
- Remove the live query/form logic
- Show a polished "Coming Soon" card with:
  - CreditCard icon in a styled container
  - "Virtual Cards — Coming Soon" heading
  - Description: "USD virtual cards for online purchases worldwide. This feature is currently under development and will be available soon."
  - Badge: "Coming Soon"
  - Back to Dashboard button

### 2. Replace PWA `BankCards` page with Coming Soon state
**File: `src/pages/banking-app/BankCards.tsx`**
- Same treatment: replace live hooks with a static Coming Soon view
- Disable the "New Card" button or remove it
- Mobile-friendly Coming Soon layout

### 3. Update Dashboard quick actions
**File: `src/pages/Dashboard.tsx` (line ~74)**
- Add a "Coming Soon" badge or tooltip to the Virtual Cards quick action
- Keep navigation working (lands on the Coming Soon page)

### 4. Update `api-health` edge function
**File: `supabase/functions/api-health/index.ts`**
- Change `virtual_cards` status from the live `cardyfieOk` check to a static `'dormant'` value
- Remove `cardyfieOk` from the `allServicesOk` calculation so it no longer degrades overall health
- This prevents the virtual_cards dependency from dragging system health to "degraded"

### 5. Update `DashboardLayout` sidebar label
**File: `src/components/dashboard/DashboardLayout.tsx` (line ~64)**
- Append " (Soon)" or add a badge indicator to the "Virtual Cards" nav item

### 6. Admin `BankingAppManagement.tsx` — Virtual Cards tab
**File: `src/pages/admin/BankingAppManagement.tsx`**
- In the virtual cards section (~line 1696), replace the data table with a "Coming Soon — Virtual Cards integration is dormant" notice
- Keep the stat card but show "—" instead of count

### 7. No API endpoint removal
- The `virtual-cards` edge function stays deployed (no 404s)
- Any direct calls will still work but return empty/error as before
- OpenAPI spec keeps the Cards section documented with a note: "Currently dormant — coming soon"

## Files Modified (7)
| File | Change |
|---|---|
| `src/pages/VirtualCards.tsx` | Replace with Coming Soon page |
| `src/pages/banking-app/BankCards.tsx` | Replace with Coming Soon page |
| `src/pages/Dashboard.tsx` | Add "Soon" indicator to card action |
| `src/components/dashboard/DashboardLayout.tsx` | Label update |
| `supabase/functions/api-health/index.ts` | Set virtual_cards to `dormant`, exclude from health calc |
| `src/pages/admin/BankingAppManagement.tsx` | Dormant notice in cards tab |
| `src/components/dashboard/widgets/QuickActionsWidget.tsx` | Badge on Cards action |

Zero breaking changes. All routes preserved. Edge function stays deployed.

