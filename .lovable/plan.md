

## Analysis: Customer App Management Page

After reviewing the full 1122-line `CustomerAppManagement.tsx` file, the page **is correctly implemented** for customer app management. Here's the evidence:

### What's Already Correct
1. **Title**: "Customer App Management" with Smartphone icon
2. **Config source**: Reads from `customer_app_config` key inside `app_config` JSONB (line 738)
3. **Customer-specific tabs**: Linked Accounts, Piggy Bank, Njangi (not present in banking)
4. **Customer-specific features**: 16 toggles (QR Scan, Transfer, Request, Bills, Split Bills, Pay Links, Njangi, Piggy Bank, Rent Reporting, etc.)
5. **Saves to correct key**: `customer_app_config` (line 497)
6. **Customer-specific preview**: Shows the 5-tab bottom nav with raised QR Scan button

### The Likely Confusion
The page shares some data tabs (Accounts, Transactions, Cards, Credit Scores) with the banking app, which is **intentional** — customer app users interact with the same underlying accounts/transactions. The "No linked accounts found" message the user saw is correct since no customers have linked accounts yet.

### Improvements to Make for Clarity

1. **Add distinguishing header banner** — Add a colored banner or description that clearly says "Configure the customer-facing mobile app experience" with a direct link to preview the customer app (`/app/:institutionId/home`)
2. **Add "Open Customer App" button** in the institution header card — links directly to `/app/{institutionId}/home` so admins can preview the live customer app
3. **Rename ambiguous tabs** — Change "Accounts" → "Customer Accounts", "Transactions" → "Customer Transactions" to differentiate from the banking app view
4. **Add customer-specific stats** — Replace generic stat cards: add "Active Customers" (profiles with linked accounts), "MoMo Users", "Bank-Linked Users" counts instead of just reusing banking stats
5. **Add empty state guidance** — When no linked accounts exist, show a helpful message like "No customers have linked accounts yet. Share your customer app link to get started: `/app/{institutionId}`"

### Files to Modify
- `src/pages/admin/CustomerAppManagement.tsx` — All changes in this single file

### Implementation Details

**Institution header card** (around line 832):
- Add an "Open Customer App" button that opens `/app/{selectedInstitution}/home` in a new tab
- Add a subtitle: "Customer Mobile App Configuration"

**Stat cards** (around line 850):
- Replace or augment with: MoMo Orange users, MoMo MTN users, Bank-linked users, View-only users (already exists)

**Tab labels** (around line 862):
- "Accounts" → "Customer Accounts"
- "Transactions" → "Customer Transactions"  
- "Cards" → "Customer Cards"

**Empty states** (various tab contents):
- Add contextual help text and the shareable customer app URL

