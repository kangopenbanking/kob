

## Findings

4 pages remain as "coming soon" placeholders:
1. **CustomerBills.tsx** - Empty placeholder
2. **CustomerBank.tsx** - Empty placeholder  
3. **CustomerSettings.tsx** - Empty placeholder
4. **CustomerHelp.tsx** - Empty placeholder

Additionally, **CustomerAlerts.tsx** shows "No new alerts" with no functional UI.

All other feature pages (Transfer, Request, CashOut, PiggyBank, Njangi, Rewards, CreditScore, Invoices, SplitBills, Recurring, RentReporting, PayLinks, Activity, Cards, Scan) are already implemented with functional mock UIs.

## Implementation Plan (5 pages)

### 1. CustomerBills.tsx - Full bill payment UI
- Bill categories grid (Electricity, Water, Internet, TV, Phone, Insurance)
- Biller search with text input
- Selected biller payment form: account/meter number input, amount input, confirm button
- Recent bill payments history list
- Uses same design patterns: `rounded-3xl` cards, pastel colors, `framer-motion` animations

### 2. CustomerBank.tsx - Linked accounts management
- List of linked bank accounts with bank name, account number (masked), balance
- "Link New Account" button with bank selector
- Account details: tap to expand showing recent transactions
- Unlink account option per entry

### 3. CustomerSettings.tsx - App settings page
- Profile section: name, email, phone (editable)
- Security section: Change PIN, Biometric toggle, 2FA toggle
- Preferences section: Notification toggle, Language selector, Currency display
- App section: App version, Terms, Privacy Policy, Log Out button
- Each section as a card with list items and toggle switches

### 4. CustomerHelp.tsx - Help & support center
- FAQ accordion list (common questions)
- Contact options: Live Chat, Email, Phone cards
- Report a Problem form with subject + description
- Quick links: Terms, Privacy, Community

### 5. CustomerAlerts.tsx - Notifications center
- Alert list with types: transaction, security, promotion, system
- Filter chips (All, Transactions, Security, Promotions)
- Each alert card with icon, title, message, timestamp
- Mark as read / mark all read functionality
- Empty state when filtered results are empty

### Files Modified
- `src/pages/customer-app/CustomerBills.tsx`
- `src/pages/customer-app/CustomerBank.tsx`
- `src/pages/customer-app/CustomerSettings.tsx`
- `src/pages/customer-app/CustomerHelp.tsx`
- `src/pages/customer-app/CustomerAlerts.tsx`

### Technical Notes
- All pages use mock data (no database changes)
- Design follows established patterns: Lucide icons `strokeWidth={1.5}`, `framer-motion` entrance animations, pastel HSL color palette, `rounded-2xl`/`rounded-3xl` cards
- All interactive elements (toggles, buttons, inputs) will be functional with local state
- Each page will be tested in browser after implementation

