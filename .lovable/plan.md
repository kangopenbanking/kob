

# Unified Business App Rebuild — Full Plan

## Current State Summary

The platform currently has **two separate merchant/business interfaces**:
1. **Merchant Portal** (`/merchant`) — A desktop sidebar-based dashboard with 40+ pages covering payments, travel, POS, compliance, storefront, and enterprise features.
2. **Business PWA** (`/biz`) — A mobile-first app with bottom navigation, FAB quick actions, and 20 pages covering home, wallet, orders, products, till, storefront, staff, analytics, and more.

Both share the same backend (`gateway_merchants`, `merchant_staff_roles`, `useMerchantContext` hook) but have duplicated UI and fragmented UX.

---

## What We Are Building

A **single, unified Business App** that replaces both `/merchant` and `/biz` with one professional, responsive application that works seamlessly on mobile and desktop. The app will feature:

- Modern, clean UI following the platform's "Modern Premium" design language
- Responsive layout (mobile bottom-nav, desktop sidebar)
- Full feature parity with existing merchant + business pages
- Walkthrough onboarding, owner/staff login, and registration
- Admin management panel for the unified app

---

## Implementation Plan

### Phase 1: Foundation & Onboarding (Steps 1-4)

**Step 1 — New App Shell & Responsive Layout**
- Create a new `UnifiedBusinessLayout` component that detects viewport size
- Mobile: Bottom navigation with 5 tabs (Home, Orders, + FAB, Products, More) + frosted glass styling
- Desktop: Collapsible sidebar with grouped navigation sections
- Shared header with notification bell, profile menu, and search
- Keep the `/biz` route prefix for continuity

**Step 2 — Splash Screen & Walkthrough**
- Rebuild `BusinessSplash` with branded animation (logo + app name transition)
- Create a `BusinessWalkthrough` using the existing `WalkthroughCarousel` component
- 3-4 slides: "Manage Your Business", "Accept Payments Anywhere", "Track Performance", "Grow Your Team"
- Store walkthrough completion in localStorage; skip on subsequent visits
- Configurable via `institution_walkthroughs` table for white-label support

**Step 3 — Authentication Screens**
- Rebuild `BusinessAuth` with a polished role selection (Owner vs Staff)
- Owner flow: Email/phone login with PIN verification (reuse `MobileAuthForm`)
- Staff flow: Phone + PIN login (reuse existing `StaffPinLogin` pattern)
- Password reset integration
- Session guard with single-session enforcement

**Step 4 — Registration Flow**
- Keep the existing multi-step registration (Business Info → Contact → Settings → Review)
- Modernize UI with step indicators, smooth transitions, and field validation
- Post-registration: mandatory PIN setup → redirect to home

### Phase 2: Core Business Features (Steps 5-9)

**Step 5 — Home Dashboard**
- Revenue hero card with privacy toggle (eye/off)
- Stats grid: Today's Revenue, Orders, Available Balance, Pending
- Quick actions row (Receive Payment, New Order, Open Till, View Wallet)
- Recent transactions list with real-time updates via Supabase Realtime
- Greeting header with merchant name and notification badge

**Step 6 — Orders & Transactions Module**
- Unified orders page with tabs: All, Pending, Completed, Refunded
- Order detail view with timeline, payment info, and refund action
- Quick order creation flow
- Search and date-range filtering
- Desktop: table view; Mobile: card list

**Step 7 — Products & Inventory**
- Product catalog with grid/list toggle
- Product create/edit form (name, price, images, variants, SKU)
- Inventory tracking per location
- Barcode/SKU scanning support (camera-based)
- WooCommerce sync status indicator

**Step 8 — Payments & Wallet**
- Wallet overview: Available, Pending, Ledger balances
- Fund wallet flow
- QR receive payment screen
- Payment links management (create, share, track)
- Payout requests and settlement history
- Escrow management

**Step 9 — POS Till**
- Full-screen till interface with cart
- Payment methods: QR Wallet, Cash, Mobile Money
- Receipt generation
- Shift management and cash drawer tracking
- Real-time payment notifications with sound alerts

### Phase 3: Advanced Features (Steps 10-14)

**Step 10 — Customers & CRM**
- Customer list with search
- Customer detail (transaction history, total spend)
- Subscription management (create, cancel, track)
- Coupon creation and management

**Step 11 — Analytics & Reporting**
- Revenue charts (daily, weekly, monthly)
- Top products and categories
- Customer acquisition metrics
- Advanced analytics with export capability
- Fee breakdown and estimator

**Step 12 — Travel Services Module**
- Service setup and management
- Routes and trips configuration
- Seating plans editor
- Timetable management
- Booking management and ticket scanner
- Counter booking and discount management

**Step 13 — Storefront & Marketplace**
- Store profile customization (logo, banner, description)
- Store visibility toggle (publish/unpublish)
- Product showcase configuration
- Store QR code and share link
- Payment plans (installments)

**Step 14 — Staff & Operations**
- Staff invitation and role management
- Multi-location setup
- Staff portal permissions (section-level access control)
- Activity log per staff member

### Phase 4: Configuration & Enterprise (Steps 15-17)

**Step 15 — Settings & Profile**
- Business profile editing
- Settlement account management (Bank, MoMo, PayPal, Card, RTGS)
- API key management (view/rotate)
- Webhook configuration
- Notification preferences

**Step 16 — Compliance**
- KYB status tracker with document upload
- Dispute management
- Setup checklist with progress bar

**Step 17 — Enterprise Features**
- Custom branding configuration
- White-label settings
- Bulk operations (payouts, refunds, imports)
- Subaccount management

### Phase 5: Admin & Cleanup (Steps 18-19)

**Step 18 — Admin Business App Management**
- Enhanced `/admin/business-app-management` dashboard
- Merchant overview with KPIs (total merchants, GMV, active users)
- Feature flag toggles per merchant
- Revenue trend charts
- Deep links to merchant app instances
- Merchant suspension/activation controls
- Walkthrough slide management

**Step 19 — Route Migration & Cleanup**
- Update `App.tsx` routing to map all features under `/biz/*`
- Redirect legacy `/merchant/*` routes to `/biz/*` equivalents
- Remove deprecated components
- Update `DashboardRouter` to route merchants to `/biz/home`
- Update all internal links and navigation references

---

## Technical Architecture

```text
/biz                    → Splash screen
/biz/walkthrough        → Onboarding walkthrough
/biz/auth               → Owner/Staff login selection
/biz/register           → Multi-step business registration
/biz/reset-password     → Password reset

/biz/home               → Dashboard
/biz/orders             → Orders list
/biz/products           → Product catalog
/biz/wallet             → Wallet & balances
/biz/till               → POS Till
/biz/receive            → QR payment receive
/biz/customers          → Customer CRM
/biz/analytics          → Analytics dashboard
/biz/travel/*           → Travel services (6 sub-routes)
/biz/storefront         → Store management
/biz/staff              → Staff & locations
/biz/settings           → Business settings hub
/biz/compliance         → KYB & disputes
/biz/more               → All features menu
```

**Key Patterns Preserved:**
- `useMerchantContext` hook for identity resolution (owner vs staff)
- `SessionGuard` with `appContext="biz"`
- Single-session enforcement via `useSingleSession`
- Supabase Realtime for payment notifications
- `TenantProvider` for white-label branding
- Staff restricted to allowed sections only

**Design System:**
- White "bold flat-card" aesthetic with `rounded-3xl` corners
- Frosted glass bottom navigation on mobile
- Collapsible sidebar on desktop with grouped sections
- Framer Motion animations throughout
- Emerald accent color palette
- 48px minimum tap targets

---

## Execution Strategy

This is a large rebuild. To maintain stability, we will implement it **phase by phase**, starting with Phase 1 (Foundation & Onboarding), and each phase will be a separate conversation thread to keep changes manageable and testable.

Shall I proceed with **Phase 1** implementation?

