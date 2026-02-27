

# Phase 2 Step 1: Customer App — Core Setup & Bold Design System

## Design Direction (from reference images + Iconly Pro)

**From Image 1 (stock tracker):**
- Bold centered action button in bottom nav, raised above the bar with a solid color pill shape (not gradient — we use solid primary)
- Clean white background, large bold serif-like numbers for amounts
- Green badge for positive change, minimal chrome

**From Image 2 (finance app):**
- Deep navy blue solid balance card with bold white typography (`rounded-3xl`)
- Soft pink/salmon pastel accent cards for bills and stats
- Uppercase tracking-wide section labels ("YOUR UPCOMING BILL", "DAILY TRANSACTION")
- Circular avatar, clean outlined icons

**Icon Style (Iconly Pro reference):**
- Use Lucide icons with `strokeWidth={1.5}` for inactive states, `strokeWidth={2}` for active
- Outlined style, clean and minimal — no filled/emoji icons
- Icons sit inside solid-color rounded containers (`rounded-2xl`)

**Hard Rules:**
- No gradients on cards or buttons
- No emoji anywhere
- Solid flat colors only (navy `#1B2B5E`, salmon `#F4B8B8`, mint `#D5EDE2`, sky `#D4E4F7`, amber `#F5E6D0`)
- `rounded-3xl` on all major cards

---

## Implementation Plan (Step 1 of 9)

### 1. Create `CustomerBottomNav` with bold centered QR Scan button
- **File**: `src/components/customer-app/CustomerBottomNav.tsx`
- 5 tabs: Home | Activity | **[QR SCAN]** | Cards | More
- QR Scan button: solid primary circle `h-14 w-14`, raised `-mt-6` above nav, `ScanLine` icon from Lucide, `strokeWidth={2}`
- Other icons: `strokeWidth={1.5}` inactive, `strokeWidth={2}` active
- Active state: bold text + primary color (no background pill — cleaner per reference)
- Nav bar: `bg-background border-t`, `h-16`, `max-w-lg mx-auto`

### 2. Create `CustomerTenantProvider`
- **File**: `src/components/customer-app/CustomerTenantProvider.tsx`
- Reads `customer_app_config` key from `institutions.app_config` JSONB
- Exposes: features, sectionOrder, mediaSections, layoutStyle, cardColors, walkthroughConfig
- Same pattern as `TenantProvider.tsx` but scoped to customer app config

### 3. Create `CustomerAppLayout`
- **File**: `src/components/customer-app/CustomerAppLayout.tsx`
- Wraps `CustomerTenantProvider` + `Outlet` + `CustomerBottomNav`
- `max-w-lg mx-auto min-h-screen bg-background`
- `pb-20` to account for raised QR button

### 4. Create placeholder pages (shell only — real content in later steps)
- **Files in `src/pages/customer-app/`:**
  - `CustomerSplash.tsx` — branded splash with institution logo
  - `CustomerAuth.tsx` — login/register shell
  - `CustomerOnboarding.tsx` — account linking wizard shell (Bank Account / Credit Union / MoMo Orange / MoMo MTN / No bank account)
  - `CustomerHome.tsx` — home screen shell with section rendering pattern
  - `CustomerScan.tsx` — QR scanner placeholder
  - `CustomerActivity.tsx` — transaction history placeholder
  - `CustomerCards.tsx` — cards placeholder
  - `CustomerMore.tsx` — hub for all 17+ features (Transfer, Request, Bills, Invoices, Bank, Split Bills, Pay Links, Cash Out, Recurring, Rewards, Piggy Bank, Njangi, Rent Reporting, Credit Score, Settings, Help, Alerts)

### 5. Add routes in `App.tsx`
- `/app/:institutionId` — `CustomerSplash`
- `/app/:institutionId/auth` — `CustomerAuth`
- `/app/:institutionId/onboarding` — `CustomerOnboarding`
- `/app/:institutionId` — `CustomerAppLayout` wrapper for:
  - `home`, `activity`, `scan`, `cards`, `more`
  - `transfer`, `request`, `bills`, `invoices`, `bank`, `split-bills`, `pay-links`, `cash-out`, `recurring`, `rewards`, `piggybank`, `njangi`, `rent-reporting`, `credit`, `settings`, `alerts`, `help`

### 6. Add admin route placeholder
- `/admin/customer-apps` — `CustomerAppManagement` (shell page)
- Add to admin routes in `App.tsx`

### 7. Update `Apps.tsx`
- Change Customer App status from `'coming-soon'` to `'live'`
- Add `link: '/app/f493095b-037a-40cf-82bc-3a3ab74550dd'`
- Update features list to reflect full feature set

---

## Files Created (~14)
- `src/components/customer-app/CustomerBottomNav.tsx`
- `src/components/customer-app/CustomerTenantProvider.tsx`
- `src/components/customer-app/CustomerAppLayout.tsx`
- `src/pages/customer-app/CustomerSplash.tsx`
- `src/pages/customer-app/CustomerAuth.tsx`
- `src/pages/customer-app/CustomerOnboarding.tsx`
- `src/pages/customer-app/CustomerHome.tsx`
- `src/pages/customer-app/CustomerScan.tsx`
- `src/pages/customer-app/CustomerActivity.tsx`
- `src/pages/customer-app/CustomerCards.tsx`
- `src/pages/customer-app/CustomerMore.tsx`
- `src/pages/admin/CustomerAppManagement.tsx`

## Files Modified
- `src/App.tsx` — add customer app route group + admin route
- `src/pages/Apps.tsx` — update Customer App to live

