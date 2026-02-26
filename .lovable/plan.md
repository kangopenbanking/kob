

# Kang Open Banking -- Multi-Tenancy PWA Ecosystem Master Plan

This is the persistent, living plan for all PWA apps. It will be updated after each phase is completed and tested.

---

## Architecture Overview

```text
                    ┌─────────────────────────────────────────────┐
                    │         Kang Open Banking Platform          │
                    │              (Single Monorepo)              │
                    ├─────────────┬──────────────┬────────────────┤
                    │  /bank/:id  │  /merchant   │  /app          │
                    │  Banking    │  Merchant    │  Customer      │
                    │  PWA        │  PWA         │  PWA           │
                    │  (Phase 1)  │  (Phase 2)   │  (Phase 3)     │
                    └─────────────┴──────────────┴────────────────┘
                                        │
                    ┌───────────────────────────────────────────┐
                    │  Multi-Tenancy Layer (institutions table) │
                    │  Each bank = institution record           │
                    │  Theming, branding, routing per tenant    │
                    └───────────────────────────────────────────┘
```

**Multi-tenancy model:** Each bank/FI is an `institution` record. The Banking App routes include the institution ID as a URL parameter (`/bank/:institutionId/*`). Theming (colors, logo, name) is loaded from the institution record. Each bank's customers see a branded, isolated experience.

---

## Design System (Enforced Across All Apps)

| Element | Rule |
|---------|------|
| Backgrounds | Solid colors only. No gradients on cards, buttons, or sections |
| Icons | Lucide React outline icons only. No emojis anywhere |
| Cards | `rounded-2xl border bg-card` with solid accent color strips |
| Buttons | Solid fill (`bg-primary`) or outline (`border border-primary`). No gradient fills |
| Typography | `font-semibold tracking-tight` headings, `text-sm` body |
| Bottom Nav | 56px height, 5 tabs, outline icon + label, active = solid primary |
| Spacing | 16px page padding, 12px card gaps |
| Animations | `framer-motion` page transitions (slide), card press scale(0.98) |
| Charts | Recharts with solid-color fills |

---

## Shared Pre-Auth Flow (All Apps)

Every app follows this linear flow before reaching the main dashboard:

```text
Splash Screen (2s auto-advance)
    │
    ▼
Walkthrough (3-4 swipeable slides)
    │
    ▼
Login / Sign Up
    │
    ▼
[If new user] Apply for Account
    │
    ▼
[If no KYC] KYC Onboarding Wizard
  ├── Step 1: Personal Info
  ├── Step 2: ID Document Upload (front + back)
  ├── Step 3: Selfie Capture
  └── Step 4: Review + Submit
    │
    ▼
Main App Dashboard
```

### Shared Components to Build

| Component | File | Purpose |
|-----------|------|---------|
| SplashScreen | `src/components/pwa/SplashScreen.tsx` | Animated logo + institution name, auto-advances after 2s |
| WalkthroughCarousel | `src/components/pwa/WalkthroughCarousel.tsx` | Swipeable slides with Lucide illustrations, dot indicators, Skip/Next |
| MobileAuthForm | `src/components/pwa/MobileAuthForm.tsx` | Mobile-optimized login/signup with phone or email |
| AccountApplication | `src/components/pwa/AccountApplication.tsx` | Apply for bank account form (if not yet a customer) |
| KYCOnboardingWizard | `src/components/pwa/KYCOnboardingWizard.tsx` | 4-step wizard: info, ID upload, selfie, review |
| BottomNavigation | `src/components/pwa/BottomNavigation.tsx` | Reusable 5-tab bottom nav with outline icons |
| PWATopBar | `src/components/pwa/PWATopBar.tsx` | Sticky top bar with institution logo, greeting, notifications bell |
| TenantProvider | `src/components/pwa/TenantProvider.tsx` | Context provider that loads institution branding by URL param |

---

## Phase 1: Banking App (Current Phase)

**Route:** `/bank/:institutionId/*`
**Role guard:** `personal` role + verified customer of that institution
**Multi-tenancy:** Institution branding (name, logo, primary color) loaded from `institutions` table

### Screens

| Screen | Route | Bottom Nav Tab | API Endpoints |
|--------|-------|---------------|---------------|
| Splash | `/bank/:id` | -- | -- |
| Walkthrough | `/bank/:id/welcome` | -- | -- |
| Auth | `/bank/:id/auth` | -- | `auth.signUp`, `auth.signInWithPassword` |
| Apply for Account | `/bank/:id/apply` | -- | `institution-customer-create` |
| KYC Wizard | `/bank/:id/kyc` | -- | `kyc-submit`, storage `kyc-documents` |
| Home | `/bank/:id/home` | Home | `aisp-accounts`, `aisp-balances`, `credit-score-fetch` |
| Payments | `/bank/:id/payments` | Payments | `pisp-domestic-payment`, `mobile-money-charge`, `mobile-money-transfer` |
| Cards | `/bank/:id/cards` | Cards | `virtual-card-create`, `virtual-card-transactions`, `virtual-card-update-status`, `virtual-card-topup` |
| History | `/bank/:id/history` | History | `aisp-transactions`, `gateway-list-charges`, `data-export` |
| More | `/bank/:id/more` | More | Links to sub-screens |
| Send Money | `/bank/:id/payments/send` | -- | `pisp-domestic-payment` |
| QR Pay | `/bank/:id/payments/qr` | -- | Browser camera API + QR generation |
| Savings | `/bank/:id/more/savings` | -- | `savings-*` |
| Loans | `/bank/:id/more/loans` | -- | `loan-*` |
| Credit Score | `/bank/:id/more/credit` | -- | `credit-score-fetch` |
| Settings | `/bank/:id/more/settings` | -- | `profiles` table |
| Alerts | `/bank/:id/more/alerts` | -- | Realtime subscriptions |

### Home Screen Layout

```text
┌──────────────────────────────┐
│ [Logo]  Good morning, John  🔔│  <- PWATopBar (outline bell icon)
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │  Total Balance           │ │  <- Solid color card (e.g. bg-primary)
│ │  XAF 2,450,000     [eye]│ │     Hide/show toggle
│ └──────────────────────────┘ │
│                              │
│ [Accounts] ← horizontal scroll → │  <- Multi-currency account cards
│ ┌────────┐ ┌────────┐ ┌────┐│
│ │XAF     │ │EUR     │ │USD ││
│ │2.45M   │ │1,200   │ │800 ││
│ └────────┘ └────────┘ └────┘│
│                              │
│  ◉ Send    ◉ Receive  ◉ Pay │  <- Quick action circles (outline icons)
│  ◉ Top Up  ◉ QR Code        │
│                              │
│ ─── KYC Status ──────────── │  <- Expandable alert card
│ │ Identity: Verified    [v] │ │
│                              │
│ ─── Recent Transactions ─── │
│ │ MTN MoMo  -15,000  Feb 26││  <- TransactionItem rows
│ │ Salary   +450,000  Feb 25││
│ │ Electricity -8,500 Feb 24││
│                              │
├──────────────────────────────┤
│ Home  Pay  Cards  History More│  <- BottomNavigation
└──────────────────────────────┘
```

### Files to Create (Phase 1)

**PWA Infrastructure:**
- `public/manifest.json`
- `public/icons/icon-192.png`, `icon-512.png` (placeholder)

**Shared PWA Components (8 files):**
- `src/components/pwa/SplashScreen.tsx`
- `src/components/pwa/WalkthroughCarousel.tsx`
- `src/components/pwa/MobileAuthForm.tsx`
- `src/components/pwa/AccountApplication.tsx`
- `src/components/pwa/KYCOnboardingWizard.tsx`
- `src/components/pwa/BottomNavigation.tsx`
- `src/components/pwa/PWATopBar.tsx`
- `src/components/pwa/TenantProvider.tsx`

**Banking App Layout + Pages (12 files):**
- `src/components/banking-app/BankingAppLayout.tsx`
- `src/pages/banking-app/BankSplash.tsx`
- `src/pages/banking-app/BankWalkthrough.tsx`
- `src/pages/banking-app/BankAuth.tsx`
- `src/pages/banking-app/BankApply.tsx`
- `src/pages/banking-app/BankKYC.tsx`
- `src/pages/banking-app/BankHome.tsx`
- `src/pages/banking-app/BankPayments.tsx`
- `src/pages/banking-app/BankCards.tsx`
- `src/pages/banking-app/BankHistory.tsx`
- `src/pages/banking-app/BankMore.tsx`
- `src/pages/banking-app/BankSendMoney.tsx`
- `src/pages/banking-app/BankQRPay.tsx`

**Shared Sub-Components (4 files):**
- `src/components/pwa/WalletCard.tsx`
- `src/components/pwa/QuickActions.tsx`
- `src/components/pwa/TransactionItem.tsx`
- `src/components/pwa/VirtualCardDisplay.tsx`

**Modified Files:**
- `src/App.tsx` -- Add `/bank/:institutionId/*` route group
- `vite.config.ts` -- Add `vite-plugin-pwa`
- `index.html` -- Mobile meta tags
- `.lovable/plan.md` -- This plan

### Implementation Order (Sequential, Tested)

1. PWA infrastructure (manifest, service worker, meta tags)
2. TenantProvider + SplashScreen + WalkthroughCarousel
3. MobileAuthForm + route registration in App.tsx
4. AccountApplication + KYCOnboardingWizard
5. BankingAppLayout + BottomNavigation + PWATopBar
6. BankHome (wallet, accounts, quick actions, recent transactions)
7. BankPayments (send, MoMo, QR)
8. BankCards (virtual card CRUD)
9. BankHistory (filters, search, export)
10. BankMore (savings, loans, credit, settings, alerts)
11. End-to-end testing of all screens and flows

### Completion Criteria (Phase 1)

- [ ] Splash screen shows institution branding, auto-advances
- [ ] 3-slide walkthrough with Skip/Get Started
- [ ] Login/Signup works with email + password
- [ ] New users can apply for a bank account
- [ ] KYC wizard: personal info, ID upload (front+back), selfie, review+submit
- [ ] Home screen shows wallet balance, accounts, quick actions, recent transactions
- [ ] Payments: send money, mobile money, QR generate/scan
- [ ] Cards: create, view, freeze, top up virtual cards
- [ ] History: filter, search, export transactions
- [ ] More: savings, loans, credit score, settings
- [ ] Bottom navigation works across all 5 tabs
- [ ] Multi-tenancy: different institution IDs show different branding
- [ ] PWA installable from mobile browser
- [ ] No emojis, no gradients, solid colors, outline icons throughout
- [ ] All Lucide icons used consistently
- [ ] Responsive on 375px mobile through 1440px desktop

---

## Phase 2: Merchant App (After Phase 1 Completion)

**Route:** `/merchant/*` (existing, to be upgraded with mobile-first PWA shell)
**Status:** Pending Phase 1 completion

### Planned Screens
- Splash, Walkthrough, Auth, KYB onboarding
- Dashboard (revenue, charges, payouts summary)
- Transactions (charges, refunds, disputes)
- Payment Links (create, manage, share)
- Settlements (payout history, bank accounts)
- More (subscriptions, API keys, webhooks, analytics, profile)

---

## Phase 3: Customer App (After Phase 2 Completion)

**Route:** `/app/*`
**Status:** Pending Phase 2 completion

### Planned Screens
- Splash, Walkthrough, Auth, KYC
- Wallet (multi-currency, P2P, top up)
- Payments (bills, QR, recurring, split)
- Cards (virtual + linked)
- History (full transaction ledger)
- More (CrediQ credit score, savings goals, loans, settings)

---

## Phase Tracking

| Phase | App | Status | Tested | Approved |
|-------|-----|--------|--------|----------|
| 1 | Banking App (`/bank/:id`) | **IN PROGRESS** | -- | -- |
| 2 | Merchant App (`/merchant`) | Pending | -- | -- |
| 3 | Customer App (`/app`) | Pending | -- | -- |

