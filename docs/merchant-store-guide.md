# Merchant Portal — Complete User Guide

**Platform:** Kang Open Banking (KOB)  
**Last Updated:** 2026-03-09  
**Version:** 5.0

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard & Analytics](#dashboard--analytics)
3. [Payments & Transactions](#payments--transactions)
4. [Money Out (Payouts, Settlements, Refunds)](#money-out)
5. [Storefront & Marketplace](#storefront--marketplace)
6. [Payment Plans & Subscriptions](#payment-plans--subscriptions)
7. [Travel Services](#travel-services)
8. [Configuration](#configuration)
9. [Compliance](#compliance)
10. [Enterprise Features](#enterprise-features)
11. [Operations](#operations)
12. [FAQ](#faq)

---

## 1. Getting Started {#getting-started}

### Registration
1. Navigate to `/merchant/register`
2. Provide your business name, email, and phone number
3. Submit KYB (Know Your Business) documentation
4. Wait for admin approval — you'll receive a notification when your account is activated

### Merchant Dashboard
After approval, your dashboard at `/merchant` shows:
- **Revenue overview** — Total volume, successful charges, pending settlements
- **Recent transactions** — Last 10 payment events
- **Quick actions** — Create payment link, view payouts, manage storefront

---

## 2. Dashboard & Analytics {#dashboard--analytics}

### Basic Analytics (`/merchant/analytics`)
- Transaction volume over time
- Success/failure rates
- Top payment methods

### Advanced Analytics (`/merchant/advanced-analytics`)
- **Revenue Trends** — Daily revenue chart with area visualization
- **Payment Method Distribution** — Pie chart breakdown (Mobile Money, Card, Bank Transfer)
- **Transaction Status Breakdown** — Bar chart of successful, pending, and failed transactions
- **KPI Cards** — Total revenue, transaction count, success rate, unique customers
- **Average Order Value** — Computed from successful charges
- **Net Settlement** — Revenue minus completed payouts
- **Time Period Filter** — 7 days, 30 days, 90 days, or 1 year
- **Export** — Download analytics data for external reporting

### Fee Dashboard (`/merchant/fees`)
- View fee structures applied to your transactions
- Breakdown by transaction type

---

## 3. Payments & Transactions {#payments--transactions}

### Transactions (`/merchant/transactions`)
View all payment events with filtering by:
- Status (successful, pending, failed)
- Date range
- Payment method
- Amount range

### Payment Links (`/merchant/payment-links`)
Create shareable payment links for quick collection:
1. Click **Create Link**
2. Set amount, currency, and description
3. Share the generated URL with your customers

### Subscriptions (`/merchant/subscriptions`)
Track recurring billing:
- Active subscription count
- Upcoming renewals
- Failed payment retries

### Customers (`/merchant/customers`)
Customer database with:
- Transaction history per customer
- Total spend tracking
- Contact information

---

## 4. Money Out {#money-out}

### Fund Wallet (`/merchant/fund-wallet`)
Add funds to your merchant wallet for payouts and operations.

### Payouts (`/merchant/payouts`)
Initiate transfers to bank accounts or mobile money:
1. Select beneficiary (or enter new details)
2. Enter amount and narration
3. Confirm with your PIN
4. Track payout status in real-time

### Settlements (`/merchant/settlements`)
Automated settlement of collected funds:
- View settlement schedule
- Track pending vs completed settlements
- Download settlement reports

### Refunds (`/merchant/refunds`)
Process refunds for completed transactions:
1. Find the original transaction
2. Enter refund amount (full or partial)
3. Confirm — funds are returned to the customer's payment method

### Bulk Operations (`/merchant/bulk-operations`) ⭐ Enterprise
Process large-scale operations via CSV upload:

#### Supported Bulk Operations:
| Operation | CSV Headers | Description |
|-----------|------------|-------------|
| **Bulk Payouts** | `recipient_account, bank_code, amount, currency, narration` | Send payments to multiple recipients |
| **Bulk Refunds** | `transaction_ref, amount, reason` | Refund multiple transactions at once |
| **Customer Import** | `email, name, phone, metadata` | Import customer database from CSV |

#### How to Use:
1. Select the operation type tab (Payouts, Refunds, or Customers)
2. Click **Download Template** to get the correct CSV format
3. Fill in your data and click **Upload CSV**
4. Monitor progress in the **Operation History** table
5. View success rates and error details per job

---

## 5. Storefront & Marketplace {#storefront--marketplace}

### Store Setup (`/merchant/storefront`)
Build your online presence with a 7-step setup wizard:

1. **Basic Info** — Store name, description, slug
2. **Business Details** — Category, location (all 10 Cameroon regions supported)
3. **Contact** — Phone, email, social links
4. **Branding** — Logo upload, cover images
5. **Shipping** — Delivery zones, rates, providers (DHL, EMS Cameroon, FedEx)
6. **Payment Settings** — Accepted methods, minimum order
7. **Review & Publish** — Preview and go live

### Marketplace Visibility
Once published, your store appears in:
- Consumer app marketplace search
- Category browsing
- Featured store sliders (admin-curated)

### Product Management
- Add products with variants (size, color, etc.)
- Set prices in XAF
- Upload product images
- Track inventory levels per location
- Automatic low-stock email notifications

---

## 6. Payment Plans & Subscriptions {#payment-plans--subscriptions}

### Managing Plans (`/merchant/plans`)
Create recurring billing plans for customers:

1. Click **New Plan**
2. Configure:
   - **Plan Name** — e.g., "Monthly Pro", "Annual Basic"
   - **Amount** — Price per interval (in XAF)
   - **Currency** — Default XAF
   - **Billing Interval** — Day, Week, Month, or Year
   - **Interval Count** — e.g., "every 2 months"
   - **Trial Period** — Optional free trial in days
   - **Active** — Toggle visibility to customers
3. Save the plan

### Plan Management:
- **Edit** — Update name, amount, interval at any time
- **Activate/Deactivate** — Toggle plan visibility without deleting
- **Delete** — Remove plans with no active subscribers
- **Subscriber Count** — Real-time count of active subscriptions per plan

### Dashboard Stats:
- Total plans created
- Active plans count
- Total active subscribers across all plans

---

## 7. Travel Services {#travel-services}

For transport and travel businesses:

| Feature | Path | Description |
|---------|------|-------------|
| Service Setup | `/merchant/travel-services` | Configure your transport service |
| Routes & Trips | `/merchant/travel-routes` | Define routes with stops and pricing |
| Seating Plans | `/merchant/travel-seating` | Visual seat layout editor |
| Timetable | `/merchant/travel-timetable` | Schedule departure times |
| Bookings | `/merchant/travel-bookings` | Manage customer reservations |
| Ticket Scanner | `/merchant/travel-scanner` | QR code scanner for validation |
| Counter Booking | `/merchant/travel-counter` | In-person ticket sales |
| Staff Roles | `/merchant/travel-staff-roles` | Staff access management |
| Discounts | `/merchant/travel-discounts` | Promotional pricing rules |

---

## 8. Configuration {#configuration}

### API Keys (`/merchant/api-keys`)
Basic API key viewer for existing integrations.

### API Key Management (`/merchant/api-key-management`) ⭐ Enterprise
Full API key lifecycle management:

#### Creating Keys:
1. Click **Create Key**
2. Enter a **label** (e.g., "Mobile App", "Website Checkout")
3. Select **environment** (Sandbox or Live)
4. Click **Generate Key**
5. ⚠️ The **secret key** is shown only once — copy it immediately

#### Key Management:
- **View/Copy** — Toggle key visibility, copy to clipboard
- **Revoke** — Immediately disable a compromised key
- **Usage Tracking** — See when each key was last used

#### Security Best Practices:
- Never expose secret keys in client-side code
- Use public keys for frontend, secret keys for backend only
- Rotate production keys every 90 days
- Immediately revoke any compromised key

### Webhooks (`/merchant/webhooks`)
Configure event notifications:
1. Add an endpoint URL
2. Select events to subscribe to (payment.success, refund.created, etc.)
3. Test the webhook with a sample payload
4. Monitor delivery status and retry attempts

### Settlement Accounts (`/merchant/settlement-accounts`)
Configure where your funds are settled:
- Bank account details
- Mobile Money accounts
- PayPal (where available)

### Subaccounts (`/merchant/subaccounts`)
Split payments across multiple recipients for marketplace or multi-vendor setups.

---

## 9. Compliance {#compliance}

### KYB Status (`/merchant/kyb`)
Track your Know Your Business verification:
- Document submission status
- Verification progress (5-step tracker)
- Approval/rejection notifications

### Disputes (`/merchant/disputes`)
Handle payment disputes and chargebacks:
- View dispute details and customer claims
- Submit evidence (receipts, delivery proof)
- Track resolution timeline

---

## 10. Enterprise Features {#enterprise-features}

> Enterprise features require the **Enterprise plan tier**. Contact your account manager or upgrade via your merchant settings.

### Custom Branding (`/merchant/branding`)
Fully customize your payment experience:

#### Colors Tab:
- **Primary Color** — Main brand color for buttons and headers
- **Secondary Color** — Supporting accent color
- **Accent Color** — Highlight and CTA elements
- **Text Color** — Body text appearance
- **Background Color** — Page background
- Live **palette preview** strip

#### Typography Tab:
- Choose from 8 professional font families:
  Inter, DM Sans, Space Grotesk, IBM Plex Sans, Outfit, Manrope, Plus Jakarta Sans, Nunito Sans
- Live preview of heading + body text in your selected font

#### Assets Tab:
- **Logo URL** — Your brand logo for checkout pages
- **Favicon URL** — Browser tab icon
- **Checkout Title** — Custom heading (e.g., "Complete Your Payment")
- **Receipt Footer** — Custom message on receipts
- **Powered By Toggle** — Show/hide "Powered by KANG" badge

#### Preview Tab:
- Live mock checkout page rendered with all your branding settings
- See exactly how customers will experience your checkout

### White-Label Options (`/merchant/white-label`)
Remove all platform branding:

#### Custom Domain:
1. Enter your domain (e.g., `pay.yourdomain.com`)
2. Add a CNAME record pointing to `checkout.kangopenbanking.com`
3. Click **Verify DNS** to confirm setup
4. Green badge appears when domain is verified and active

#### Branding Controls:
| Toggle | Description |
|--------|-------------|
| Hide Platform Branding | Remove all KANG branding from customer-facing pages |
| Branded Receipts | Use your branding on payment receipts |
| Branded Checkout | Use your branding on checkout pages |
| Branded Emails | Use your branding on transactional emails |

#### Email Configuration:
- **From Name** — Sender name on transactional emails
- **Email Domain** — Custom sending domain (e.g., `mail.yourdomain.com`)

#### Legal & Support Links:
- Terms of Service URL
- Privacy Policy URL
- Support Email
- Support/Help Center URL

### Advanced Analytics (`/merchant/advanced-analytics`)
Deep business intelligence dashboard:
- Revenue trend charts with gradient fills
- Payment method distribution (donut chart)
- Transaction status breakdown (bar chart)
- Configurable time periods (7d, 30d, 90d, 1y)
- KPI cards with period-over-period trends
- Average order value calculation
- Net settlement overview

---

## 11. Operations {#operations}

### Locations & Staff (`/merchant/locations`)
Multi-location business management:

#### Locations:
1. Click **Add Location**
2. Enter: Name, Address, City, Country, Phone
3. View staff count per location
4. Edit or delete locations as needed

#### Staff Management:
1. Click **Add Staff**
2. Configure:
   - **Full Name** and **Email**
   - **Role** — Admin, Manager, or Cashier
   - **Location** — Assign to specific location or "All Locations"
   - **PIN** — 4-6 digit code for POS terminal authentication
3. Staff can log in at `/merchant/staff-login` with their PIN

#### Staff Roles:
| Role | Permissions |
|------|------------|
| **Admin** | Full access to all merchant features |
| **Manager** | Manage inventory, process sales, view reports |
| **Cashier** | Process sales and refunds at POS terminal |

### WooCommerce Sync (`/merchant/woo-sync`)
Bidirectional product synchronization:

#### Dashboard:
- Connected store count and status
- Total sync runs with success/failure rates
- Last sync timestamp

#### Actions:
- **Import** — Pull products from WooCommerce into KOB
- **Sync Now** — Trigger immediate inventory synchronization
- **Refresh** — Reload sync history

#### Sync History Table:
- Store URL
- Status (Success, Running, Failed)
- Products synced count
- Duration
- Error messages (if any)

#### Merge Strategies:
- `woo_source_of_truth` — WooCommerce data overwrites KOB
- `kob_source_of_truth` — KOB data overwrites WooCommerce
- `newest_wins` — Most recently updated record wins

---

## 12. FAQ {#faq}

### How do I upgrade to Enterprise?
Contact support or your account manager. Enterprise unlocks: Custom Branding, White-Label, Advanced Analytics, API Key Management, Bulk Operations, and dedicated support.

### Can I have multiple storefronts?
Currently, each merchant account supports one storefront. Contact support for multi-brand setups.

### How long do settlements take?
Standard settlements process within 24-48 hours. Enterprise merchants may configure same-day settlements.

### What currencies are supported?
Primary currency is **XAF** (Central African CFA franc). Multi-currency support is available for Enterprise merchants.

### How do I connect my WooCommerce store?
1. Install the KOB plugin on your WordPress site
2. Generate WooCommerce REST API keys (Settings → Advanced → REST API)
3. Enter your store URL and API keys via the POS connector
4. Products will be imported automatically

### What happens if a bulk operation fails?
Failed records are logged with error details. You can view the error breakdown in the Operation History table and re-upload corrected records.

### How do I reset my staff PIN?
Go to Locations & Staff → Staff tab → Edit the staff member → Enter a new PIN.

---

## Support

- **Email:** support@kangopenbanking.com
- **Developer Docs:** [Developer Portal](/developer)
- **API Status:** [Status Page](/developer/status)
