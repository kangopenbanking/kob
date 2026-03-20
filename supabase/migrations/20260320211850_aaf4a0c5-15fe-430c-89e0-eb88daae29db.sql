
INSERT INTO public.product_manuals (manual_type, section_title, section_slug, content, sort_order, is_active)
VALUES
('merchants', 'Welcome to Your Business Dashboard', 'welcome-getting-started', '# Welcome to Your Business Dashboard

Welcome to the Kang Business Dashboard — your all-in-one control centre for managing payments, products, staff, and customers.

This guide walks you through **every feature** step by step, in plain language. No technical background needed.

## Who Is This Guide For?

- **Business owners** who want to accept payments online and in-store
- **Store managers** who handle day-to-day operations
- **Staff members** who process orders and serve customers

## What You Will Learn

1. Set up your business profile and go live
2. Accept payments via Mobile Money, bank transfer, and cards
3. Manage your product catalogue and inventory
4. Process orders and track deliveries
5. Use the Point of Sale (POS) system
6. Manage staff roles and permissions
7. Track your revenue with analytics and reports
8. Handle refunds and disputes
9. Set up webhooks and API integrations
10. Upgrade your subscription plan

## How to Navigate This Guide

- Use the **sidebar** on the left to jump to any section
- Click **Mark Complete** after finishing each lesson
- Your progress is saved automatically
- Use the **Glossary** button for quick definitions of key terms

> **Tip:** Start from the beginning if you are new. If you already have an account, skip to the section you need.', 1, true),

('merchants', 'Creating Your Business Account', 'creating-business-account', '# Creating Your Business Account

Before you can start accepting payments, you need to register your business on Kang.

## Step-by-Step Registration

### Step 1: Open the Business App
Go to the Kang Business App from the website by clicking **For Business** or directly at the /biz route.

### Step 2: Sign Up or Log In
- If you already have a Kang personal account, simply log in
- If you are new, tap **Sign Up** and create an account with your email and password

### Step 3: Start Business Onboarding
Fill in your **Business Name**, **Business Type**, **Country**, **Phone Number**, and **Business Email**.

### Step 4: Submit for Review
Tap **Submit**. Your business will be reviewed and approved, usually within minutes.

## What Happens After Approval?

Once approved, you get:
- A **Business Dashboard** with all management tools
- A **Wallet** to receive and manage funds
- Access to **Payment Links**, **POS**, and **Product Management**

> **Important:** Make sure your business name and contact details are correct. Customers will see this on receipts and payment pages.', 2, true),

('merchants', 'Understanding Your Dashboard', 'dashboard-overview', '# Understanding Your Dashboard

Your dashboard gives you a quick snapshot of how your business is doing.

## Balance Card
- **Available Balance** — Money you can withdraw or use right now
- **Pending Balance** — Money from recent transactions not yet settled
- **Currency** — Displayed in your local currency (e.g., XAF)

## Today''s Summary
- **Today''s Revenue** — Total money received today
- **Today''s Orders** — Number of orders placed today

## Quick Actions
Shortcut buttons for common tasks:
- **Create Order** — Start a new POS order
- **Add Product** — Add a new item to your catalogue
- **Payment Link** — Generate a payment link to share
- **View Reports** — Jump to your analytics page

## Recent Activity
A list of your most recent transactions showing customer name, amount, payment method, and status.

> **Tip:** Check your dashboard at the start and end of each business day.', 3, true),

('merchants', 'Setting Up Your Business Profile', 'business-profile-setup', '# Setting Up Your Business Profile

Your business profile is what customers see when they pay you.

## How to Access
Go to **Settings → Business Profile**.

## Basic Information

| Field | What to Enter | Example |
|---|---|---|
| Business Name | Your official name | Marie''s Fashion House |
| Display Name | Short name for receipts | Marie''s |
| Business Type | Your industry | Retail / Restaurant / Services |
| Description | What you do (1-2 sentences) | Modern African fashion |

## Contact Details

| Field | What to Enter |
|---|---|
| Phone | Business phone number |
| Email | Customer enquiry email |
| Website | Your URL (optional) |
| Address | Physical address |

## Logo and Branding
- **Logo** — Upload a square image (at least 200×200 pixels)
- **Cover Image** — A banner for your storefront (optional)

> **Tip:** Businesses with logos see up to 40% higher payment completion rates.', 4, true),

('merchants', 'Managing Your Business Wallet', 'wallet-funds-management', '# Managing Your Business Wallet

Your wallet is where all payment income is collected.

## Viewing Your Balance
- **Available Balance** — Money you can use or withdraw
- **Pending Balance** — Payments being processed (settles within 24 hours)

## Funding Your Wallet

1. Tap **Fund Wallet**
2. Enter the amount
3. Choose a payment method (in priority order):
   - **Linked Bank Account** — Instant transfer
   - **Partner Bank Transfer** — Instant credit via Kang partner banks
   - **Mobile Money** — MTN MoMo, Orange Money (1-5 minutes)
4. Confirm and pay

## Withdrawing Funds

1. Tap **Withdraw**
2. Enter the amount
3. Select your bank account
4. Confirm

> **Note:** Withdrawals may take 1-3 business days depending on your bank.', 5, true),

('merchants', 'Managing Your Products', 'product-management', '# Managing Your Products

Products are the items or services you sell.

## Adding a New Product

1. Go to **Products** → **Add Product**
2. Fill in:

| Field | Required? | Description |
|---|---|---|
| Product Name | Yes | e.g., "Cotton T-Shirt" |
| Price | Yes | The selling price |
| Category | No | e.g., "Clothing" |
| SKU | No | Unique inventory code |
| Stock Quantity | No | How many in stock |
| Image | No | Upload a photo |

3. Tap **Save Product**

## Editing and Deleting
- Tap any product to edit, then **Save Changes**
- Use the three-dot menu to **Delete** (permanent)

## Custom Attributes
Add variations like Size (S, M, L, XL) or Colour with different prices per variant.

## Inventory Tracking
- Stock reduces automatically with each order
- Low stock notifications alert you
- Out-of-stock items hide from your storefront', 6, true),

('merchants', 'Accepting Payments', 'accepting-payments', '# Accepting Payments

## Payment Methods

| Method | Settlement Time |
|---|---|
| Mobile Money (MTN MoMo, Orange Money) | Instant to 5 min |
| Bank Transfer | 1-24 hours |
| Card (Visa, Mastercard) | 1-3 business days |
| Kang Wallet | Instant |
| QR Code (Scan and Pay) | Instant |

## Payment Links

1. Go to **Payment Links** → **Create Payment Link**
2. Enter amount, description, and optional customer email
3. Tap **Create** and share via WhatsApp, SMS, or email

### Tracking
- **Active** — Waiting for payment
- **Paid** — Customer has paid
- **Expired** — Past expiry date

## QR Code Payments

1. Go to **Storefront → QR Pay**
2. Enter amount (or leave blank for any amount)
3. Show the QR code to your customer

> **Tip:** Print your QR code and display it at your checkout counter.', 7, true),

('merchants', 'Using the Point of Sale (POS)', 'pos-system', '# Using the Point of Sale (POS)

The POS turns your phone or tablet into a cash register.

## Making a Sale

### Step 1: Add Items
- Tap a product to add it to the cart
- Use the search bar or category filters to find products

### Step 2: Adjust Quantities
- Tap **+** or **−** to change quantity
- Tap the delete icon to remove an item

### Step 3: Apply Discounts (Optional)
Enter a percentage or fixed amount discount.

### Step 4: Choose Payment Method
- **Cash** — Enter amount received, POS calculates change
- **Mobile Money** — Sends payment request to customer
- **Card** — Customer taps or inserts their card
- **QR Code** — Customer scans to pay
- **Split Payment** — Part cash, part digital

### Step 5: Complete the Sale
Receipt is generated automatically. You can print, share via WhatsApp, or email it.

## Key Features

| Feature | Description |
|---|---|
| Quick Search | Find products by name or SKU |
| Barcode Scanner | Scan barcodes on supported devices |
| Offline Mode | Sell without internet, syncs later |
| Receipt Customisation | Add your logo and custom message |
| Customer Selection | Link sales to customer records |', 8, true),

('merchants', 'Managing Orders', 'order-management', '# Managing Orders

Every sale creates an order.

## Order Statuses

| Status | Meaning |
|---|---|
| Pending | Waiting for payment |
| Paid | Payment received |
| Processing | Being prepared |
| Shipped | Dispatched to customer |
| Delivered | Customer received it |
| Cancelled | Cancelled before fulfilment |
| Refunded | Money returned |

## Updating an Order
Tap any order to update status, add tracking info, add notes, or print the receipt.

## Filtering Orders
Search by order number, customer name, status, date range, or payment method.

## Processing Refunds

1. Open the order → tap **Refund**
2. Enter refund amount (full or partial)
3. Add a reason
4. Confirm

The customer is notified automatically.

> **Tip:** Keep order statuses updated for accurate fulfilment tracking.', 9, true),

('merchants', 'Analytics and Reports', 'analytics-reports', '# Analytics and Reports

## Revenue Overview
View revenue by Today, This Week, This Month, or Custom Range.

## Key Metrics

| Metric | Description |
|---|---|
| Total Revenue | All money received |
| Total Orders | Orders completed |
| Average Order Value | Revenue ÷ Orders |
| Top Products | Best sellers by quantity or revenue |
| Payment Methods | MoMo vs. Bank vs. Card breakdown |

## Customer Insights
- New vs. Returning customers
- Top spenders
- Customer growth over time

## Exporting Reports
1. Select date range
2. Tap **Export**
3. Choose CSV or PDF

## Advanced Analytics (Professional/Enterprise)
- Revenue forecasting
- Conversion rate tracking
- Cohort analysis
- Real-time widgets

> **Tip:** Review analytics weekly to spot trends.', 10, true),

('merchants', 'Managing Staff and Permissions', 'staff-management', '# Managing Staff and Permissions

## Adding Staff

1. Go to **Settings → Staff**
2. Tap **Invite Staff**
3. Enter name, email, phone, and role
4. Tap **Send Invite**

## Staff Roles

| Role | Access Level |
|---|---|
| Owner | Full access, billing, can delete business |
| Manager | Products, orders, staff, analytics (no billing) |
| Cashier | POS and orders only |
| Viewer | Read-only dashboard and orders |

## Changing Roles
Find the staff member → three-dot menu → **Change Role**.

## Removing Staff
Three-dot menu → **Remove from Business**. Access revoked immediately.

## Multi-Location (Professional/Enterprise)
- Assign staff to specific locations
- Filter reports by location

> **Tip:** Give each person only the access they need.', 11, true),

('merchants', 'Managing Your Customers', 'customer-management', '# Managing Your Customers

Customer records are created automatically when people buy from you.

## Customer List
View name, contact details, total spent, order count, and last purchase date.

## Adding Manually
Tap **Add Customer** → enter name, email, phone, and notes.

## Customer Details
Click any customer to see purchase history, total spent, favourite products, and notes.

## Using Customer Data
- Send payment links to specific customers
- Track loyalty and top spenders
- Follow up on unpaid orders

> **Tip:** Always ask for a phone number or email at checkout to build your database.', 12, true),

('merchants', 'Shipping and Delivery', 'shipping-delivery', '# Shipping and Delivery

## Setting Up Shipping
Go to **Storefront → Shipping**.

### Methods

| Method | Description |
|---|---|
| Flat Rate | Fixed delivery fee |
| Free Shipping | No charge |
| By Location | Different rates per city/region |
| By Weight | Based on total order weight |
| Pickup | Customer collects from your location |

## Processing a Shipment
1. Open the paid order
2. Tap **Mark as Shipped**
3. Enter tracking number
4. Confirm

Customers are notified automatically at each stage.

> **Tip:** Offer free shipping above a certain amount to increase order values.', 13, true),

('merchants', 'Creating Invoices', 'invoicing-billing', '# Creating Invoices

## How to Create

1. Go to **Invoicing** → **Create Invoice**
2. Fill in customer, items, tax, discount, due date, and notes
3. Tap **Send Invoice**

The invoice includes a **Pay Now** button for instant payment.

## Invoice Statuses

| Status | Meaning |
|---|---|
| Draft | Not yet sent |
| Sent | Delivered to customer |
| Viewed | Customer opened it |
| Paid | Payment received |
| Overdue | Past due date |
| Cancelled | Voided |

## Managing Invoices
- Edit drafts before sending
- Resend unpaid invoices
- Download as PDF
- Duplicate for similar invoices

> **Tip:** Set clear due dates and enable automatic reminders for overdue invoices.', 14, true),

('merchants', 'Your Online Storefront', 'storefront-online-store', '# Your Online Storefront

## Setting Up
Go to **Storefront** and complete your store profile with name, description, logo, cover image, and contact info.

## Storefront Tabs

| Tab | What It Does |
|---|---|
| Products | Manage listed products, toggle visibility, set featured items |
| Payment Plans | Create subscriptions or instalment plans |
| QR Pay | Generate and download QR codes for payments |
| Shipping | Configure delivery options and zones |
| Integrations | Connect WooCommerce and other services |
| Custom Attributes | Create product variations (size, colour) |

## Sharing Your Storefront
Share your unique storefront URL on social media, WhatsApp, email signatures, and business cards.

> **Tip:** Keep your storefront updated with fresh products and accurate stock levels.', 15, true),

('merchants', 'Subscription Plans and Upgrades', 'subscription-plans', '# Subscription Plans and Upgrades

## Available Plans

| Plan | Best For | Key Features |
|---|---|---|
| Starter (Free) | New businesses | Basic POS, 50 products, 1 staff |
| Professional | Growing businesses | Unlimited products, 10 staff, analytics, invoicing |
| Enterprise | Large businesses | Unlimited staff, multi-location, API, priority support |

## How to Upgrade

1. Go to **Settings → Plan**
2. Select your plan
3. Pay via Wallet Balance, Mobile Money, Bank Transfer, or Card
4. Plan activates immediately

## Downgrading
Select a lower plan in Settings. Takes effect at end of billing period.

> **Important:** Remove excess staff before downgrading if needed.', 16, true),

('merchants', 'Webhooks and API Integration', 'webhooks-api', '# Webhooks and API Integration

## Webhooks

### Setting Up
1. Go to **Settings → Webhooks** → **Add Webhook**
2. Enter your URL, select events, and set a secret key
3. Save

### Events Available
- payment.completed, payment.failed
- order.created, refund.processed

### Testing
Tap **Send Test** to verify your endpoint receives notifications.

## API Keys

1. Go to **Settings → API Keys**
2. Use your **Publishable Key** (client-side) and **Secret Key** (server-side only)

### API Capabilities
- Create charges, list transactions, manage products
- Process refunds, check balances

## Webhook Logs
View all webhooks sent in the last 30 days with status and retry options.

> **Tip:** Always verify webhook signatures using HMAC hashes.', 17, true),

('merchants', 'Handling Disputes and Refunds', 'disputes-refunds', '# Handling Disputes and Refunds

## Processing a Refund

1. Open the order → tap **Refund**
2. Enter amount (full or partial) and reason
3. Confirm

### Refund Timeline

| Method | Speed |
|---|---|
| Kang Wallet | Instant |
| Mobile Money | 1-5 minutes |
| Bank Transfer | 3-7 business days |
| Card | 5-14 business days |

## Disputes

When a customer disputes a charge:

1. You receive a notification
2. You have **7 days** to submit evidence (delivery proof, communications, photos)
3. The dispute is reviewed

### Statuses
- **Open** — Awaiting your response
- **Under Review** — Evidence submitted
- **Won** — Funds returned to you
- **Lost** — Funds returned to customer

> **Tip:** Most disputes can be avoided with good customer service and proactive refunds.', 18, true),

('merchants', 'WooCommerce Integration', 'woocommerce-integration', '# WooCommerce Integration

Connect your WordPress site to accept Kang payments.

## Setup Steps

### 1. Register
Go to **Storefront → Integrations** → WooCommerce Registration. Enter store name, site URL, and email.

### 2. Download Plugin
You receive an API Key, Client Secret, and Webhook Secret. Download the ZIP file.

### 3. Install on WordPress
Plugins → Add New → Upload Plugin → Install → Activate.

### 4. Configure
WooCommerce → Settings → Payments → Enable Kang Open Banking → Enter credentials → Save.

### 5. Test
Place a test order and verify it appears in your Kang dashboard.

## Data Syncing
View WooCommerce transactions in **Merchant → WooCommerce Sync**. Export as CSV or JSON.

## Troubleshooting

| Issue | Solution |
|---|---|
| Plugin missing | Ensure WooCommerce is active first |
| Payments failing | Verify API key and secret |
| Webhooks not working | Check URL is publicly accessible |

> **Tip:** Always test with a small payment before going live.', 19, true),

('merchants', 'Notifications and Alerts', 'notifications-alerts', '# Notifications and Alerts

## Types

### Payment
- Payment Received, Payment Failed, Refund Processed

### Orders
- New Order, Order Updated, Order Cancelled

### Account
- Low Balance, Settlement Completed, Staff Added, Security Alert

### Business
- Plan Expiry Warning, Feature Updates, Compliance Alerts

## Where to Find Notifications
- **Bell Icon** in the top bar
- **Email** for important alerts
- **SMS** for critical security alerts
- **In-App Banners** for urgent messages

## Preferences
Go to **Settings → Notifications** to toggle channels (in-app, email, SMS).

> **Tip:** Keep payment and security notifications always enabled.', 20, true),

('merchants', 'Security and Best Practices', 'security-best-practices', '# Security and Best Practices

## Account Security
- Use a strong password (12+ characters, mixed types)
- Enable **Two-Factor Authentication** in Settings → Security
- Review active sessions and log out unused devices

## Payment Security
- Never share your API Secret Key
- Verify webhook signatures with HMAC hashes
- Use HTTPS on your website
- Review transactions daily

## Staff Security
- Each staff member gets their own account
- Assign minimum required role
- Remove access immediately when someone leaves

## If Something Goes Wrong
1. **Suspicious activity** — Change password, contact support
2. **Unauthorised transaction** — Report it in the transaction details
3. **Account locked** — Use password reset or contact support

> **Tip:** Train your staff on basic security practices and review access permissions regularly.

---

Congratulations! You have completed the Merchant Training Guide. Go back to the **Overview** to review any section, or download the PDF for offline reference.', 21, true)
ON CONFLICT DO NOTHING;
