

## Gap Analysis

### Current State
- **CustomerHome**: Balance card + quick actions + transactions list. Functional but basic.
- **CustomerMore**: All 15 features in a flat 4-column grid of identical small icons. No grouping, no visual hierarchy.
- **12 feature pages**: All are identical "coming soon" placeholders (Transfer, Request, Bills, Invoices, Bank, SplitBills, PayLinks, CashOut, Recurring, Rewards, PiggyBank, Njangi, RentReporting, CreditScore).
- **CustomerActivity**: Basic flat transaction list, no filters or date grouping.
- **CustomerCards**: Minimal single card preview.

### Plan (6 tasks)

#### 1. Redesign CustomerHome with reference-inspired UI
Enhance the home screen drawing from the uploaded reference designs:
- **Upcoming Bills row**: Horizontal scroll of pastel pill cards (like the Evernote/Apple bill cards in image 1) showing due bills with amounts and brand icons
- **Spending Stats card**: A salmon/mint colored card showing "Monthly Stats" with earnings vs spending summary (inspired by image 1 right panel)
- **Enhanced balance card**: Add a period toggle (W/M/Y) like image 3, keep the navy hero card
- Add these as new section keys in `CustomerSectionKey` and `sectionOrder`

#### 2. Redesign CustomerMore with grouped service sections and varied card styles
Replace the flat grid with categorized sections using mixed card sizes:
- **Money Movement** (Transfer, Request, Cash Out, Pay Links): 2 large feature cards (half-width, tall, with description text) + 2 small icon cards
- **Payments & Bills** (Bills, Invoices, Split Bills, Recurring): Horizontal scroll of medium pastel cards
- **Savings & Goals** (Piggy Bank, Njangi, Rewards): 1 wide banner card + 2 square cards side by side
- **Financial Health** (Credit Score, Rent Reporting, Bank): 3 equal cards in a row with progress indicators
- **Account** section stays as list items (Settings, Alerts, Help)
- Each section uses different card dimensions, colors, and layouts for visual variety

#### 3. Build functional feature pages (batch 1: core money features)
Replace "coming soon" with real mock UIs:
- **CustomerTransfer**: Amount input, recipient selector (recent contacts row), account picker, confirm button
- **CustomerRequest**: Amount input, generate QR/link, share options
- **CustomerBills**: Bill categories grid (Electricity, Water, Internet, TV), biller search, payment form
- **CustomerCashOut**: Agent locator, amount input, withdrawal method selector

#### 4. Build functional feature pages (batch 2: financial services)
- **CustomerPiggyBank**: Savings goals with progress bars, create goal form, deposit/withdraw actions
- **CustomerNjangi**: Group savings circles, member list, contribution tracker, payout schedule
- **CustomerRewards**: Points balance card, earn/redeem tabs, reward catalog grid
- **CustomerCreditScore**: Score gauge visualization, score factors breakdown, tips list

#### 5. Build functional feature pages (batch 3: utilities)
- **CustomerInvoices**: Invoice list with status badges, create invoice form
- **CustomerSplitBills**: Split calculator, participant list, share breakdown
- **CustomerRecurring**: Scheduled payments list with toggle switches, add recurring form
- **CustomerRentReporting**: Rent payment history, landlord info, credit impact indicator
- **CustomerPayLinks**: Generate payment link, link history, share options

#### 6. Enhance CustomerActivity and CustomerCards
- **CustomerActivity**: Date-grouped sections (Today, Yesterday, This Week), filter chips (All, Income, Expenses, Transfers), search bar
- **CustomerCards**: Multiple card carousel, card controls (freeze, PIN, limits), recent card transactions

### Files Modified
- `src/components/customer-app/CustomerTenantProvider.tsx` (add new section keys)
- `src/pages/customer-app/CustomerHome.tsx`
- `src/pages/customer-app/CustomerMore.tsx`
- `src/pages/customer-app/CustomerActivity.tsx`
- `src/pages/customer-app/CustomerCards.tsx`
- All 12 feature page files (Transfer, Request, Bills, CashOut, PiggyBank, Njangi, Rewards, CreditScore, Invoices, SplitBills, Recurring, RentReporting, PayLinks)

### Technical Notes
- All pages use mock data (no database changes needed)
- Design follows the established palette: Navy `hsl(225,50%,22%)`, Salmon `hsl(0,60%,85%)`, Mint `hsl(150,40%,90%)`, Sky `hsl(210,80%,93%)`, Amber `hsl(45,70%,90%)`
- Cards use `rounded-3xl`, Lucide icons with `strokeWidth={1.5}`, framer-motion entrance animations
- Feature visibility respects `tenant.features` toggles throughout

