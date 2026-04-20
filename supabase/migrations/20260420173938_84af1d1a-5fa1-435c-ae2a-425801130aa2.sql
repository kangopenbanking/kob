BEGIN;
UPDATE public.product_manuals SET section_title='Welcome to Your Business Dashboard', content=$kob$## What this dashboard does for your business

Your Business Dashboard is the control center for everything you sell, every payment you accept, and every customer you serve. Whether you run a small shop, a growing online store, or several physical locations, this is where you watch your business operate in real time.

### What you can do from one place

- **Accept payments** by Mobile Money (MTN, Orange), bank card, USSD, bank transfer, or cash at the counter.
- **Manage your products** — add new items, change prices, track stock, and run promotions.
- **Run a Point of Sale** for in-store sales, with receipts, barcodes, and a cash drawer.
- **Track orders** from the moment they come in until they're delivered or picked up.
- **Get paid out** to your bank account or mobile money wallet on a schedule that suits you.
- **Invite your team** and give each person the right level of access.
- **See how your business is doing** with clear charts on sales, top products, and busy hours.

### Who this is for

Anyone running a business in Cameroon — from a single-shop owner to a multi-branch retailer or an online merchant. No technical background needed. If you can use a smartphone, you can run your business here.

### A safe place to start

Nothing you do here goes live until you're ready. You can add test products, send yourself test invoices, and explore every feature before turning on real payments. When you're ready to go live, complete the verification steps in **Settings → Business Profile** and you'll be accepting real money the same day.

### Your first 10 minutes

1. Confirm your business name and contact details under **Profile**.
2. Add one test product so you can see how listings work.
3. Send yourself a test invoice — try paying it with mobile money.
4. Add one team member so they can help you set up.
5. Bookmark this dashboard on your phone for quick access.

> **Tip:** The search bar at the top finds anything — orders, customers, settings — in one keystroke.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='welcome-getting-started';

UPDATE public.product_manuals SET section_title='Creating Your Business Account', content=$kob$## Set up your business in under 5 minutes

Before you can accept payments or list products, we need a few details about your business. This protects you, your customers, and keeps you compliant with Cameroonian financial regulations (COBAC).

### Step 1 — Tell us who you are

You'll be asked for:
- **Business name** — exactly as it appears on your registration documents.
- **Business type** — sole trader, SARL, SA, NGO, cooperative, or informal sector.
- **Industry** — retail, restaurant, services, online store, etc. This helps us recommend the right tools.
- **Country and city** of your main location.

### Step 2 — Verify your identity (KYB)

KYB stands for *Know Your Business*. By law, we need to confirm a real person is behind the account. Have these ready:

| Document | Why we ask |
|---|---|
| National ID or passport (owner) | Proves who you are |
| Business registration (RCCM) | Proves the business exists |
| Tax number (Numéro Contribuable) | Required for invoices |
| Recent utility bill or bank statement | Confirms business address |

Upload clear photos — a phone camera works fine. Most accounts are verified within 1 business day.

### Step 3 — Add your payout details

Where should we send your money? You can connect:
- A **bank account** (any Cameroonian bank).
- A **mobile money wallet** (MTN MoMo or Orange Money).
- Both — and choose which one to use per payout.

### Step 4 — Pick how you'll get paid

Choose the payment methods you want to accept. Most merchants enable everything: card, mobile money, USSD, and bank transfer. You can change this any time.

### What happens next

You'll see a green **Verified** badge as soon as we approve your documents. Until then, you can still explore the dashboard, add products, and run test transactions in sandbox mode. Real payments only switch on after verification.

> **Need help?** Email merchants@kangopenbanking.com or use the in-app chat. We answer in French and English.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='creating-business-account';

UPDATE public.product_manuals SET content=$kob$## Your business at a glance

The dashboard home page shows you what matters most, right when you log in. Everything is designed so you can answer three questions in seconds:

1. **How much money came in today?**
2. **What needs my attention right now?**
3. **How am I doing compared to last week?**

### The four key numbers

At the top of the page you'll always see:

- **Today's revenue** — total amount received today, in XAF.
- **Orders today** — how many transactions completed.
- **Pending actions** — orders to ship, disputes to resolve, refunds to approve.
- **Wallet balance** — money available to pay out.

Each card is clickable. Tap "Pending actions" and you jump straight to the list.

### The activity feed

Below the numbers, a live stream shows every event as it happens: a new order, a successful payment, a low-stock warning, a customer review. Think of it as the heartbeat of your business.

### Quick actions

The big buttons on the right let you do common tasks in one tap: New sale, Send invoice, Add product, Withdraw funds.

### Charts that tell a story

Scroll down for visual reports: Sales trend (7/30/90 days), Top products, Payment methods breakdown, Hourly heat map showing busy periods.

### Personalize your view

Click the gear icon to hide cards you don't use, rearrange sections, and pick light or dark mode. Your layout saves automatically.

> **Tip:** On mobile, swipe left on any card to see more detail without leaving the page.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='dashboard-overview';

UPDATE public.product_manuals SET content=$kob$## Make a great first impression

Your business profile is what customers see when they pay you, get a receipt, or visit your storefront. A complete profile builds trust and increases sales.

### What to fill in

**Basics** — appear on every receipt and invoice: business name, logo (512×512+), tagline, phone, email, physical address, business hours.

**Brand** — shape your storefront and checkout: primary color, secondary color, cover image, social links (Facebook, Instagram, WhatsApp Business).

**Legal** — required for compliance and tax: registered business name (RCCM), tax number, business category.

### Why a good profile matters

| Element | Impact |
|---|---|
| Logo + brand colors | Customers recognize your receipts and trust your checkout |
| Complete address | Mobile money reversals and refunds process faster |
| Business hours | Auto-replies tell customers when you're closed |
| Social links | Drives traffic from receipts back to your social pages |

### Multiple locations?

If you operate more than one branch, set the **head office** profile here. Each branch can later have its own address, hours, and even its own logo overlay.

### Going public

The toggle **"List in marketplace"** adds your business to the public Kang marketplace where customers can discover you. Switch off any time.

> **Tip:** Preview your storefront with the eye icon before publishing — it shows exactly what customers will see.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='business-profile-setup';

UPDATE public.product_manuals SET content=$kob$## Where your money lives before payout

Every payment your business receives lands first in your **Business Wallet**. From there you decide when and how to move it to your bank or mobile money.

### How the wallet works

1. A customer pays by card, mobile money, USSD, or transfer.
2. The funds clear (instant for mobile money, 1–2 days for cards).
3. The cleared amount appears as **available balance**.
4. You can spend it, pay out to bank, or save it as a buffer.

### The three balances

- **Available** — ready to use or withdraw right now.
- **Pending** — payments still clearing.
- **Reserved** — held back for refund risk (rare, new accounts only).

### Multi-currency support

If you sell across borders or accept foreign cards, hold balances in XAF, XOF, EUR, USD, NGN and more. Convert between currencies at the visible mid-market rate.

### Moving money out

| Method | Speed | Fee |
|---|---|---|
| Mobile Money (MTN/Orange) | Instant | 1% (capped) |
| Bank transfer (same-day) | 2–4 hours | Free above 50,000 XAF |
| Bank transfer (next-day) | Next business day | Free |

Set **automatic payouts** if you'd rather not think about it — daily, weekly, or when balance hits a threshold.

### Wallet history

Every credit and debit recorded with timestamp and reference. Filter by date, payment method, or customer. Export to Excel or CSV for your accountant.

### Safety

- All wallet movements require PIN or fingerprint.
- Large payouts (above your set limit) need 2-step approval.
- SMS and email confirmation for every payout.

> **Tip:** Keep a small buffer in your wallet to cover refunds — faster than pulling money back from your bank.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='wallet-funds-management';

UPDATE public.product_manuals SET content=$kob$## List, price, and stock everything you sell

The Products section is where you build your catalog — whether you sell 5 items or 5,000.

### Adding a product

Click **+ New Product** and fill in: name, price (XAF default), photos (up to 8), description, SKU/barcode (optional but recommended for POS), category.

### Variants

Selling t-shirts in 3 sizes and 4 colors? Use **variants**. Add the options once and the system creates each combination automatically. Each variant has its own price, stock count, and SKU.

### Pricing options

- **Single price** — one number, simple.
- **Tiered pricing** — bulk discounts (e.g., 10% off above 10 units).
- **Promotional price** — show strike-through and sale price.
- **Member price** — different price for logged-in customers.

### Stock and inventory

Turn on **Track inventory** and the system decreases stock automatically when a sale happens, warns when stock falls below your **reorder level**, and hides the product from your storefront when it hits zero (you can override this). For multi-location merchants, stock is tracked per branch.

### Bulk import

Long catalog? Download the CSV template, fill it in, and upload. The system shows a preview, flags errors, and imports in seconds.

### Organizing your catalog

Use **categories** and **collections** to group products. Collections can be seasonal ("Back to school"), thematic ("Made in Cameroon"), or promotional ("Friday deals").

### Going live

Each product has a **Draft / Published** toggle. Draft products are invisible to customers — useful for preparing a launch.

> **Tip:** Good photos increase sales by up to 40%. Use natural light, plain backgrounds, and at least 1000×1000 pixels.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='product-management';

UPDATE public.product_manuals SET content=$kob$## Get paid the way your customers want to pay

You can accept payments through 6 channels, all from one dashboard:

### 1. Mobile Money (most popular in Cameroon)
**MTN MoMo** and **Orange Money** — customers receive a USSD prompt or app push, funds confirmed in seconds. Fee: 1.5% (capped).

### 2. Bank cards
Visa, Mastercard, and local Afriland cards. Customers enter card details on a secure page. 3D-Secure (OTP from their bank) protects against fraud. Fee: 2.5% + 100 XAF.

### 3. USSD
Customers dial a short code (e.g., *126#) from any phone. Works without internet — perfect for rural customers. Fee: 1.5%.

### 4. Bank transfer
The system generates a unique reference number. Customer transfers from their bank app to your virtual account. Funds confirm automatically — no manual reconciliation. Free above 50,000 XAF.

### 5. Cash (in-person)
Use the POS to record a cash sale and print a receipt. Stock and reports update the same as a digital payment. No fee.

### 6. PayPal (international customers)
Accept payments in EUR, USD, GBP and convert to XAF. PayPal's standard rate.

### How customers pay you

- **Send a payment link** by SMS, WhatsApp, or email.
- **Show a QR code** at the counter — they scan and pay.
- **Embed a checkout button** on your website.
- **Use the POS** for face-to-face sales.
- **Send an invoice** for credit terms or bigger amounts.

### Smart payment routing

If a method fails (network down, insufficient funds), the system automatically suggests an alternative, so customers rarely abandon payment.

> **Tip:** Enable mobile money and card together — they cover 95% of Cameroonian customers.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='accepting-payments';

UPDATE public.product_manuals SET content=$kob$## Sell in person, fast

The POS turns any phone, tablet, or computer into a full cash register. No special hardware required, but you can plug in a barcode scanner, receipt printer, or cash drawer.

### Starting a sale

1. Open **POS** from the side menu.
2. Tap or scan products to add them to the cart.
3. Adjust quantities or apply a discount.
4. Tap **Charge**.
5. Choose payment method: cash, card, mobile money, or split.
6. Print or text the receipt.

The whole flow takes under 30 seconds for a regular sale.

### Shift management

Cashiers clock in with a 4-digit PIN. The POS tracks opening cash count, every sale/refund/void during the shift, and closing cash count with any variance. End-of-day reports show owner exactly what was sold, by whom, and any cash discrepancies.

### Hardware that works

- **Receipt printers** — any 58mm or 80mm Bluetooth/USB printer.
- **Barcode scanners** — any USB or Bluetooth scanner that types numbers.
- **Cash drawers** — open via printer kick or manual button.
- **Card readers** — coming soon for chip-and-PIN cards.

### Offline mode

Lost internet? The POS keeps working. Sales stored locally and sync to cloud the moment you're back online. No lost sales, ever.

### Multiple registers

Run the POS on several devices at once — all sync to the same dashboard. Stock decreases instantly across registers so you never oversell.

### Discounts and promotions

Percentage off, fixed amount, buy-one-get-one, loyalty redemption. Set staff permissions so only managers can apply discounts above a threshold.

> **Tip:** Use the **Hold sale** button to pause a transaction (e.g., customer forgot something) without losing the cart.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='pos-system';

UPDATE public.product_manuals SET content=$kob$## Stay on top of every sale

Every transaction — POS, online, invoice, marketplace — becomes an **order** in this section. Track it from payment to delivery.

### Order status

1. **Pending payment** — invoice sent, waiting on customer.
2. **Paid** — money confirmed in your wallet.
3. **Preparing** — you're packing or making it.
4. **Ready** — waiting for pickup or courier.
5. **Shipped / Out for delivery** — on its way.
6. **Delivered** — customer received it.
7. **Completed** — closed.

Orders can also be marked **Cancelled** or **Refunded**.

### What you see per order

Customer name/phone/email, items bought with quantities and prices, payment method and reference, delivery address, customer notes, and full audit trail of every status change.

### Notifying the customer

Each status change can automatically send the customer an SMS update, email with tracking, or WhatsApp message. You decide which channels are on per order type.

### Bulk actions

Select many orders to mark all as shipped, print all packing slips at once, or export to CSV for your delivery partner.

### Searching and filtering

Find any order by customer name, phone, order ID, date range, status, or payment method. Save common filters as views ("Today's pending", "Last week's refunds").

### Returns and exchanges

Customer wants to return? Open the order, click **Process return**, choose items and reason — system updates stock back, creates a refund (full or partial), and notifies the customer.

> **Tip:** Use the print button to generate a packing slip with item, quantity, and SKU — speeds up your warehouse.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='order-management';

UPDATE public.product_manuals SET content=$kob$## Know your business by the numbers

Good decisions need good data. The Analytics section turns every sale into clear, plain-language insight you can act on today.

### The dashboard reports

- **Sales over time** — daily, weekly, monthly with comparison to previous period.
- **Best-selling products** — top 10 by units and revenue.
- **Customer insights** — new vs returning, average order value, lifetime value.
- **Payment method breakdown** — channel preferences.
- **Busy hours and days** — when to staff up and run promotions.
- **Geographic spread** — where your customers are based.

### Custom reports

Pick a date range, choose metrics (revenue, units, customers, refunds), group by product/category/staff/branch/payment method. Save for one-click access later.

### Comparison mode

Toggle "vs previous period" on any chart to instantly see if you're up or down. Big changes highlighted in green or red.

### Export and share

Every report exports to PDF (board meetings), Excel (deeper analysis), CSV (accountant). Schedule reports to email weekly or monthly.

### Real-time vs historical

Dashboard updates in real time during the day. Historical reports recalculated nightly for speed.

### Alerts on metrics that matter

Set rules like "Tell me if today's sales drop below 100,000 XAF by 4pm" or "Notify me if any product hits low stock". Get an SMS, email, or in-app notification when triggered.

### Goal tracking

Set a monthly revenue goal and the dashboard shows progress as a bar at the top — green when on track, amber when behind, red when at risk.

> **Tip:** Look at the **Hour heatmap** weekly. It often reveals quiet hours you can fill with promos.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='analytics-reports';

UPDATE public.product_manuals SET content=$kob$## Build your team safely

As you grow, you'll add cashiers, managers, accountants, and warehouse staff. The Staff section lets each person do their job — and nothing more.

### Adding a team member

Click **Invite staff** and enter name, email or phone, role, branches they can access, and daily transaction limits if you want extra control. They receive an invitation, set a password, and log in immediately.

### Built-in roles

| Role | Can do |
|---|---|
| **Owner** | Everything, including delete account |
| **Manager** | All operations, view reports, manage staff |
| **Cashier** | Process sales, refunds (with approval), view their shift |
| **Accountant** | View reports, export data, no operational access |
| **Warehouse** | Update stock, fulfill orders, no payment access |
| **Marketing** | Manage products, promotions, storefront, no payments |

You can also create **custom roles** with exactly the permissions you choose.

### Branch-level access

For multiple locations, each staff member can be assigned to one or more branches. They only see data for their branches.

### Activity log

Every action — login, sale, refund, stock change, settings update — is recorded with the staff member's name and timestamp. Audit anything at any time.

### Approvals workflow

For risky actions (large refunds, big discounts, deleting orders), require manager approval. Cashier requests, manager gets a notification and approves with a tap.

### Removing access

If someone leaves, click **Suspend** and they immediately lose access. Their history stays for your records.

### Two-factor authentication

Strongly recommended for managers and owners. System supports SMS codes and authenticator apps.

> **Tip:** Set up roles before hiring — onboarding a new cashier then takes 2 minutes.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='staff-management';

UPDATE public.product_manuals SET content=$kob$## Build relationships, not just transactions

Every person who buys from you becomes a customer record. Use this section to know them better, keep them coming back, and serve them faster.

### Customer profiles

For each customer: contact details, total spent and number of orders, average order value, last visit and purchase, preferred payment method, your notes, full order history.

### Segments

Group customers automatically: **VIP** (top 10% by spend), **At risk** (no purchase in 60+ days), **New** (first purchase in last 30 days), **Bulk buyers** (typical order over a threshold). Run targeted promotions on each segment.

### Loyalty program

Reward repeat business with **points per purchase** (e.g., 1 point per 100 XAF), **tier rewards** (Bronze, Silver, Gold), **birthday bonuses**, **refer-a-friend** with cash credit on both sides. Customers see their balance on receipts and at checkout.

### Communication

Reach customers from their profile: send SMS or WhatsApp message, email a personal offer, add them to a campaign. All communication logged to the customer record.

### Privacy and data

Customers can request to see all data you hold (download as PDF), update their information, or be deleted. The dashboard handles all these requests in line with Cameroonian data protection law.

### Importing customers

Already have a customer list? Upload a CSV with name, phone, and email — duplicates are detected automatically.

> **Tip:** A simple "thank you" SMS after a first purchase increases repeat rate by 25%.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='customer-management';

UPDATE public.product_manuals SET content=$kob$## Get orders to customers, on time

Whether you deliver yourself, use couriers, or offer pickup, the Shipping section keeps it organized.

### Delivery options

- **Local delivery** (you or your team) — set zones by neighborhood and a fee per zone.
- **Courier integration** — DHL, Chronopost, local couriers; rates calculated automatically.
- **Pickup in store** — free, customer collects from your branch.
- **Same-day delivery** — for urgent orders within a city.

### Pricing rules

Flat fee per order, fee by weight or distance, free above a cart total (e.g., free over 25,000 XAF), first delivery free for new customers.

### Order packing flow

1. Order appears in **Orders → To prepare**.
2. Print the packing slip.
3. Pack the items, scan to confirm.
4. Print the shipping label.
5. Mark as **Shipped** — customer gets a tracking SMS.

### Tracking

If you use a courier with API integration, the order page shows live tracking. Otherwise paste in a tracking number manually and the customer sees it on their order page.

### Delivery proof

For high-value orders, require **proof of delivery**: photo of package, customer signature, or OTP confirmation by the receiver.

### Failed delivery

If delivery fails (no one home, wrong address), one tap creates a follow-up task, notifies the customer, and reschedules. No order falls through the cracks.

### Returns and reverse logistics

Generate a return label, customer drops at courier point or you pick up, inspect on receipt, approve refund.

> **Tip:** Add a "Special instructions" field at checkout — a small change that reduces failed deliveries by half.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='shipping-delivery';

UPDATE public.product_manuals SET content=$kob$## Get paid for services, B2B sales, and credit terms

Invoices are perfect when you sell on credit, do project work, or bill businesses. Send a professional invoice in under a minute.

### Creating an invoice

Click **New Invoice** and fill in customer (existing or new), line items (description, quantity, unit price, tax), due date, payment terms (Net 7/15/30 or custom), notes. The system calculates VAT (19.25% by default in Cameroon), sub-total, and grand total automatically.

### Sending the invoice

Email (beautifully formatted with your logo), WhatsApp (sends a PDF link), SMS (short text with a link), or print. Customer sees a "Pay now" button accepting every payment method you support.

### Recurring invoices

Bill the same customer regularly? Set monthly/weekly/quarterly/yearly, auto-send on a chosen day, auto-charge if customer saved a payment method. Perfect for subscriptions, retainers, rent.

### Tracking unpaid invoices

Dashboard shows total outstanding (money owed to you), overdue invoices in red, paid this month.

### Reminders

Automatic reminders 3 days before due, on due date, 7 days late, 30 days late. Edit the templates in your brand voice.

### Quotes and proformas

Send a **quote** before the work — customer accepts with one click and it converts to an invoice.

### Tax compliance

Each invoice is sequentially numbered (required by Cameroonian tax law) and stored permanently. Export all invoices in tax-ready format for your annual filing.

> **Tip:** Add your bank details and mobile money number at the bottom of every invoice — gives customers more ways to pay.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='invoicing-billing';

UPDATE public.product_manuals SET content=$kob$## A free online shop, ready in minutes

Every business gets a free online storefront at **kang.shop/your-business-name**. Customers browse, order, and pay — no separate website needed.

### What's included

Product listings with photos/prices/variants, shopping cart and secure checkout, all your payment methods, mobile-optimized (most customers shop on phones), your logo/colors/brand throughout, SEO-ready so Google can find your shop.

### Customizing your shop

In **Storefront → Design**: pick a theme (clean, bold, classic, modern), set primary and accent colors, add a hero banner with a promotion, pin featured collections, add an "About us" page, embed your social media feeds.

### Categories and navigation

Organize products into categories. Add a search bar, filters by price, and sort by popularity or newness.

### Promotions on your storefront

- **Banner promotions** at the top of the home page.
- **Discount codes** customers enter at checkout.
- **Bundle offers** — buy 3, save 10%.
- **Flash sales** with a countdown timer.

### Connecting a custom domain

Own a domain like **myshop.cm**? Point it at your Kang storefront in **Settings → Domain**. Customers see your domain, your logo, your shop.

### SEO and discoverability

Each product page is automatically indexed by Google, tagged with structured data (appears with photos in search results), and linked from your business profile in the Kang marketplace.

### Reviews and ratings

Customers can leave star ratings and reviews after purchase. Reply publicly, building trust with future shoppers.

### Analytics on visits

See visitor count, which products they look at, where they drop off, and conversion rate by traffic source.

### Going live

Flip the **Public** toggle. Your shop goes live instantly. Share the link on Facebook, Instagram, WhatsApp, printed materials.

> **Tip:** A clear, single hero banner with one offer converts better than five small banners.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='storefront-online-store';

UPDATE public.product_manuals SET content=$kob$## Choose the plan that fits your business

Kang Business comes in four plans. Start free and upgrade as you grow — no long-term contracts.

### The plans

| Plan | Monthly fee | Best for |
|---|---|---|
| **Starter** | Free | Trying it out, low volume |
| **Growth** | 9,900 XAF | Small shops doing 1M–5M XAF/month |
| **Pro** | 29,900 XAF | Multi-staff, multi-location |
| **Enterprise** | Custom | Chains, franchises, custom integrations |

All plans include unlimited products, customers, and transactions. You only pay payment processing fees per transaction.

### What unlocks at each tier

**Starter** — 1 staff account, POS and online storefront, basic reports, next-day payouts.

**Growth** — 5 staff accounts, same-day payouts, advanced analytics, custom invoice templates, email + WhatsApp customer messages, priority support.

**Pro** — Unlimited staff, multi-location, custom roles and permissions, API access, white-label checkout, dedicated account manager.

**Enterprise** — Bespoke integrations, custom contract terms, SLA guarantees, on-site training, multi-entity billing.

### Changing plans

Upgrade any time — instant access, billed pro-rata. Downgrade at the end of your current billing month.

### Payment for the plan

Charged automatically on the same day each month. Pay with mobile money, card, or have it deducted from your wallet balance.

### Trying premium features

**14-day free trial** on Pro from the plans page — full access, no card needed.

### Cancelling

Cancel any time from **Settings → Subscription**. Keep access until the end of the paid period. Data preserved for 12 months in case you reactivate.

> **Tip:** Most merchants find Growth pays for itself with same-day payouts alone — better cash flow, fewer overdrafts.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='subscription-plans';

UPDATE public.product_manuals SET content=$kob$## Connect Kang to your other tools

Use accounting software, an ERP, a custom website, or any other system? Plug it into Kang with webhooks and our REST API.

### What's a webhook?

A webhook is a message Kang sends to your system the moment something happens — a sale, refund, new customer. Your system reacts instantly without polling.

### Events you can subscribe to

`order.created`, `order.paid`, `order.shipped`, `order.completed`, `payment.succeeded`, `payment.refunded`, `customer.created`, `product.low_stock`, `payout.completed` — 24 event types in total.

### Setting up a webhook

1. Go to **Settings → Webhooks**.
2. Click **+ New endpoint**.
3. Enter the URL on your system that should receive events.
4. Pick which events to subscribe to.
5. Save — receive a **secret** to verify each message is genuinely from Kang.

### Security

Every webhook signed with HMAC-SHA256. Your system verifies the signature using the shared secret to confirm Kang sent it (not an impostor).

### Reliability

If your endpoint is down, Kang retries with exponential backoff for up to 72 hours. See all delivery attempts and re-send any event manually.

### The REST API

REST API at **api.kangopenbanking.com** lets you create products programmatically, pull order data into your accounting tool, initiate payments from your own checkout, sync customers two ways, build custom reports. Uses standard OAuth 2.0 with PKCE. Get your **API key** in **Settings → Developers**.

### Example integrations already built

WooCommerce, Shopify, OpenCart plugins; QuickBooks and Sage accounting sync; Mailchimp customer sync; Zapier (1,000+ apps).

### Sandbox first

Test everything against our sandbox at **sandbox.kangopenbanking.com** with free test credentials before going live.

> **Tip:** Use webhooks for real-time updates and the API for one-off lookups — together they cover every integration need.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='webhooks-api';

UPDATE public.product_manuals SET content=$kob$## Resolve issues quickly and fairly

Even with great service, sometimes a customer wants their money back or disputes a charge. The Disputes section helps you handle these professionally.

### Two types of money returns

**Refunds** — you initiate, by choice (returned product, your mistake, goodwill, subscription cancelled mid-period).

**Disputes (chargebacks)** — customer initiates through their bank (didn't recognize charge, goods didn't arrive, goods not as described).

### Issuing a refund

1. Open the order.
2. Click **Refund**.
3. Choose full or partial refund.
4. Pick the reason from the dropdown.
5. Add a note (optional).
6. Confirm.

Customer money returns to original method: mobile money instant, card 3–7 business days, bank transfer 1–2 business days.

### Refund limits

By default, any staff with refund permission can issue up to 50,000 XAF without approval. Above that, a manager must approve. Change limits in **Settings → Approvals**.

### Disputes (chargebacks)

When a customer disputes a charge: you get an alert, the disputed amount is held from your wallet (not lost — held), and you have **7 days** to respond with evidence.

Evidence to upload: receipt or invoice, proof of delivery (photo/signature/tracking), email or chat with customer, refund offered and refused.

We pass everything to the bank or card network. They decide: **You win** — money returns to your wallet. **You lose** — money stays with the customer. Most disputes are won when good evidence is provided.

### Reducing disputes

- Ship promptly and provide tracking.
- Respond to customer messages within 24 hours.
- Use clear product descriptions and photos.
- Get signed proof of delivery on high-value items.
- Process legitimate refund requests fast — happy customers don't dispute.

### Refund analytics

Dashboard tracks refund rate (% of orders), top reasons, staff with highest refund rate (could indicate training need), dispute win/loss rate.

> **Tip:** A clear, friendly returns policy on your storefront reduces disputes by 60%.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='disputes-refunds';

UPDATE public.product_manuals SET content=$kob$## Connect your WooCommerce site to Kang in 10 minutes

If your store runs on WooCommerce (WordPress), our official plugin connects it to Kang for payments, orders, and inventory sync.

### What the plugin does

- Adds **Mobile Money, Card, USSD, Bank transfer** as checkout options.
- Syncs every WooCommerce order into Kang's order list.
- Pushes inventory updates both ways — sell on Woo, stock decreases in Kang's POS too.
- Handles refunds — issue from either Woo or Kang and both update.
- Forwards customer data (with consent) for unified marketing.

### Installation

1. WordPress admin → **Plugins → Add New**.
2. Search **"Kang Open Banking"**.
3. Click **Install** and **Activate**.
4. **WooCommerce → Settings → Payments** — see new Kang payment methods.
5. Enable each method you want.

### Connecting your account

In plugin settings paste your **Kang API key** (Settings → Developers) and **Kang webhook secret** (auto-generated when you connect). Click **Test connection** — green tick means you're live.

### Going live

By default plugin runs in sandbox mode (safe to test with fake money). When ready: switch to **Live mode**, place a test real-money order to confirm. Done.

### Recurring payments and subscriptions

If you use **WooCommerce Subscriptions**, the plugin supports recurring billing through MoMo and cards. Customers save their payment method securely; renewal happens automatically.

### Inventory sync

Choose one-way (Kang → Woo), one-way (Woo → Kang), or two-way (last update wins).

### Multi-language and multi-currency

Plugin supports French and English. Multi-currency Woo stores convert at checkout using live FX rates.

### Troubleshooting

- **Payments not appearing in Woo?** Check webhook URL is reachable from internet.
- **Stock not syncing?** Check API key has `inventory:write` scope.
- **Customer can't pay?** Make sure the chosen payment method is enabled in both Kang and Woo.

The plugin's **Diagnostics** page runs a self-test and tells you exactly what's misconfigured.

### Support

Plugin issues: support@kangopenbanking.com (mention "WooCommerce plugin"). Most tickets resolved within 4 business hours.

> **Tip:** Run the integration in sandbox for at least 3 test orders before switching to live — catches 95% of misconfiguration issues.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='woocommerce-integration';

UPDATE public.product_manuals SET content=$kob$## Stay informed without being overwhelmed

The dashboard sends you and your team the right alerts at the right time, on the channels you choose.

### Where alerts arrive

**In-app** (bell icon), **Email** (address on user profile), **SMS** (phone on file), **WhatsApp** (instant priority alerts), **Push notifications** (Kang Business mobile app).

### Categories of alerts

| Category | Examples |
|---|---|
| **Sales** | New order, large sale, daily summary |
| **Payments** | Payment received, payout completed, payment failed |
| **Stock** | Low stock warning, out of stock, restock reminder |
| **Customers** | New review, complaint, VIP customer visit |
| **Operations** | Refund requested, dispute opened, staff clock-in/out |
| **Security** | New login, password change, large withdrawal |
| **System** | Maintenance window, plan upgrade, payment due |

### Customizing per category

For each category choose channels, quiet hours (e.g., no SMS between 9pm and 7am), threshold (e.g., only alert above 100,000 XAF), and who on your team gets it.

### Daily and weekly summaries

**Morning briefing** — yesterday's sales, today's pending, week-on-week comparison. **End-of-day** — total revenue, top product, anything needing attention tomorrow. **Weekly summary** — emailed every Monday with charts and insights.

### Alerts for staff

Each staff member sees notifications relevant to their role: cashiers (start-of-shift checklist, low till), warehouse (orders to pack, stock to receive), managers (approval requests, end-of-day variance).

### Snoozing and dismissing

Snooze for 1 hour/1 day/specific time. Dismiss alerts you've handled. Bulk mark as read when you're back from a break.

### Critical alerts

Some alerts (security breaches, large unauthorized withdrawals) are always sent on every channel and cannot be muted. Review and adjust in **Settings → Critical Alerts**.

> **Tip:** Set the morning briefing to arrive 30 minutes before you open — gives you a calm overview before the day starts.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='notifications-alerts';

UPDATE public.product_manuals SET content=$kob$## Keep your business and your money safe

Money is involved, so security is built in at every layer. Here's what's protecting you and what you should do to add an extra lock.

### What we do for you

- **Bank-grade encryption** — every page uses TLS 1.3.
- **PCI DSS compliant** — card data never stored on your or our servers.
- **Two-factor authentication** available on every account.
- **Continuous fraud monitoring** — unusual patterns trigger alerts.
- **Audit log** — every action permanently recorded.
- **Daily backups** — your data safe even if hardware fails.
- **24/7 security operations center** monitoring threats in real time.

### What you should do

#### Strong unique passwords
At least 12 characters, mix letters/numbers/symbols, different from your email password, use a password manager (1Password, Bitwarden) if you can.

#### Turn on two-factor authentication
**Settings → Security**, enable 2FA. You'll be asked for a code from your phone every time you log in from a new device. Stops 99% of account takeovers even if your password is stolen.

#### Limit staff permissions
Give each staff only the access they need. A cashier doesn't need to change bank details.

#### Set transaction limits
Daily withdrawal cap, single payout maximum, refund threshold needing manager approval. These caps stop both staff fraud and stolen-account drains.

#### Review the activity log weekly
Spend 5 minutes scanning for anything unusual: logins from countries you don't operate in, refunds at odd hours, settings changes you didn't make.

#### Use the mobile app for approvals
Big actions (large payouts, settings changes) can require a tap-to-approve from your registered phone. Even if your password is stolen, attackers can't move money without your phone.

#### Be aware of phishing
We will **never** ask for your password by email, SMS, or phone. Suspicious message claiming to be us? It's a scam — report to security@kangopenbanking.com.

### If you suspect a breach

1. Click **Lock account** in Settings — instantly disables all logins.
2. Change your password.
3. Email security@kangopenbanking.com.
4. We freeze withdrawals and walk you through recovery.

### Compliance certifications

**COBAC compliant** (Cameroon banking regulator), **GDPR-ready** for European customers, **PCI DSS Level 1** certified annually, **ISO 27001** information security.

> **Tip:** Set a calendar reminder to review staff access every 90 days — catches accounts of people who've left.$kob$, updated_at=now() WHERE manual_type='merchants' AND section_slug='security-best-practices';

COMMIT;