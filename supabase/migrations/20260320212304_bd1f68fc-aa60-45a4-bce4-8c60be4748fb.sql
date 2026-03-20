
INSERT INTO public.product_manuals (manual_type, section_title, section_slug, content, sort_order, is_active)
VALUES

('merchants', 'Enterprise Features Overview', 'enterprise-features', '# Enterprise Features Overview

The Enterprise plan unlocks powerful tools for businesses that need more control, scale, and brand customisation.

## What You Get with Enterprise

| Feature | Description |
|---|---|
| **Multi-Location Management** | Manage multiple branches from one dashboard |
| **Unlimited Staff** | Add as many team members as you need |
| **Advanced Analytics** | Revenue forecasting, cohort analysis, real-time widgets |
| **API Access** | Full programmatic access to all Kang services |
| **Custom Branding** | Your logo, colours, and CSS on checkout pages |
| **White-Label Checkout** | Your own domain on the payment experience |
| **Priority Support** | Faster response times and dedicated assistance |
| **Bulk Operations** | Process payouts and refunds in bulk via CSV |

## How to Upgrade to Enterprise

1. Go to **Settings → Plan** or tap the **Upgrade** banner
2. Select **Enterprise**
3. Review the pricing and features
4. Pay using your wallet balance, Mobile Money, bank transfer, or card
5. Enterprise features activate immediately

> **Tip:** If your wallet balance is not enough, the system shows a shortfall panel with quick funding options. You can fund the exact amount needed and complete the upgrade in one flow.', 22, true),

('merchants', 'Custom Branding', 'custom-branding', '# Custom Branding

Make your checkout pages look like your own brand. Customers see your logo, colours, and style — not a generic payment page.

## Accessing Custom Branding

1. Go to **Settings → Branding** (or **Storefront → Branding** in some layouts)
2. You will see the branding editor

## What You Can Customise

### Logo

1. Click **Upload Logo**
2. Select a square image (PNG or JPG, at least 200×200 pixels)
3. Your logo appears on:
   - Payment pages
   - Receipts and invoices
   - Email notifications
   - Your storefront

### Favicon

1. Click **Upload Favicon**
2. Select a small square image (ICO, PNG, or SVG, ideally 32×32 or 64×64 pixels)
3. This appears in the browser tab when customers visit your payment page

### Brand Colours

Set your primary colour to match your brand. This affects:
- Buttons on your checkout page
- Links and highlights
- Progress indicators

Enter your colour as a hex code (e.g., #2563EB for blue) or use the colour picker.

### Custom CSS (Advanced)

For precise control over the checkout appearance:

1. Toggle **Enable Custom CSS**
2. Enter your CSS rules in the code editor
3. Preview the changes in real-time
4. Click **Save**

**Example — Change the checkout button style:**
```css
.checkout-button {
  border-radius: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
```

> **Warning:** Custom CSS is powerful but can break the layout if used incorrectly. Test thoroughly after making changes.

## Preview and Save

- Use the **Preview** panel to see how your branding looks on a sample checkout page
- Click **Save Branding** to apply changes
- Changes take effect immediately on all new payment sessions

> **Tip:** Keep your branding consistent with your website and social media. Customers trust payment pages that look familiar.', 23, true),

('merchants', 'White-Label Checkout', 'white-label-checkout', '# White-Label Checkout

White-label lets you serve your checkout page on your own domain — for example, **pay.yourbusiness.com** instead of a Kang URL. Your customers never see the Kang brand.

## Why Use White-Label?

- **Trust** — Customers stay on your domain throughout the payment process
- **Branding** — The entire experience looks and feels like your own product
- **Professionalism** — Ideal for agencies, SaaS platforms, and enterprise merchants

## Setting Up White-Label — Step by Step

### Step 1: Go to White-Label Settings

1. Navigate to **Settings → White-Label**
2. You will see the domain configuration panel

### Step 2: Enter Your Custom Domain

Type the domain you want to use for your checkout. For example:
- **pay.yourbusiness.com** (recommended — use a subdomain)
- **checkout.yourbusiness.com**

> **Important:** Use a subdomain (like pay. or checkout.) rather than your root domain. Your root domain should point to your main website.

### Step 3: Add DNS Records

You need to add a **CNAME record** at your domain registrar (where you bought your domain — e.g., GoDaddy, Namecheap, Cloudflare).

| Record Type | Name | Value |
|---|---|---|
| CNAME | pay (or checkout) | checkout.kangopenbanking.com |

**How to do this:**

1. Log in to your domain registrar
2. Go to **DNS Settings** or **DNS Management**
3. Click **Add Record**
4. Select **CNAME** as the record type
5. In the **Name** field, enter your subdomain (e.g., pay)
6. In the **Value** field, enter: **checkout.kangopenbanking.com**
7. Set TTL to **Auto** or **3600**
8. Save the record

### Step 4: Verify Your Domain

1. Go back to Kang **Settings → White-Label**
2. Click **Verify Domain**
3. The system checks that your DNS records are set up correctly
4. Verification can take **up to 72 hours** for DNS to propagate, but usually completes within 30 minutes

### Step 5: SSL Certificate

Once your domain is verified:
- An **SSL certificate** (HTTPS) is automatically provisioned
- Your checkout page becomes available at **https://pay.yourbusiness.com**
- All data is encrypted and secure

## Domain Verification Statuses

| Status | What It Means | What to Do |
|---|---|---|
| **Pending** | DNS records not yet detected | Wait for propagation or check your DNS settings |
| **Verified** | Domain is confirmed and ready | SSL is being set up automatically |
| **Active** | Everything is live | Your white-label checkout is working |
| **Failed** | DNS records are incorrect | Check and fix your CNAME record, then retry |

## Troubleshooting DNS Issues

### Domain not verifying?

1. **Check your CNAME record** — Make sure it points to checkout.kangopenbanking.com
2. **Remove conflicting records** — If you have an existing A record or other CNAME for the same subdomain, remove it
3. **Wait for propagation** — DNS changes can take up to 72 hours
4. **Check with a tool** — Use [DNSChecker.org](https://dnschecker.org) to verify your records are visible globally
5. **No proxy** — If using Cloudflare, set the DNS record to **DNS Only** (grey cloud), not **Proxied** (orange cloud)

### SSL not working?

- SSL is provisioned automatically after domain verification
- If it fails, click **Retry** in the white-label settings
- Make sure there are no **CAA records** blocking Let''s Encrypt on your domain

## Changing Your White-Label Domain

If you need to change your domain:

1. Go to **Settings → White-Label**
2. Remove the current domain
3. Enter the new domain
4. Set up DNS records for the new domain
5. Verify again

> **Important:** When you change your domain, the verification resets. Your old domain will stop serving the checkout page once removed.

## What Your Customers See

With white-label active, your customers experience:
- Payment page at **https://pay.yourbusiness.com**
- Your logo and brand colours
- No Kang branding visible
- Full SSL encryption (padlock icon in browser)
- All payment methods (MoMo, Bank, Card) available as normal

> **Tip:** Combine white-label with custom branding for the most professional checkout experience. Upload your logo, set your brand colour, and serve it all on your own domain.', 24, true),

('merchants', 'Multi-Location Management', 'multi-location', '# Multi-Location Management

If your business has multiple branches, outlets, or service points, Enterprise lets you manage them all from one dashboard.

## Adding a Location

1. Go to **Settings → Locations**
2. Tap **Add Location**
3. Enter:
   - **Location Name** (e.g., "Douala Main Branch")
   - **Address**
   - **Phone Number**
   - **Operating Hours**
4. Tap **Save**

## Assigning Staff to Locations

1. Go to **Settings → Staff**
2. Find the staff member
3. Tap **Assign Location**
4. Select the branch they work at
5. Save

Each staff member can be assigned to one or more locations. They only see data for their assigned locations.

## Location-Based Reports

Filter your analytics by location to see:
- Revenue per branch
- Orders per branch
- Top-selling products at each location
- Staff performance by location

## Location-Based POS

When a cashier logs in, the POS automatically loads the product catalogue and pricing for their assigned location.

> **Tip:** Use location reports to compare branch performance and identify your strongest and weakest outlets.', 25, true),

('merchants', 'Bulk Operations', 'bulk-operations', '# Bulk Operations

Process large volumes of payouts, refunds, or data updates in one go using CSV file uploads.

## Bulk Payouts

Send money to multiple recipients at once:

1. Go to **Payouts → Bulk Operations**
2. Download the **CSV template**
3. Fill in the template with:
   - Recipient name
   - Phone number or bank account
   - Amount
   - Currency
   - Reference/note
4. Upload the completed CSV file
5. Review the summary (total amount, number of recipients, any errors)
6. Confirm and process

## Bulk Refunds

Process multiple refunds simultaneously:

1. Go to **Refunds → Bulk Operations**
2. Download the template
3. Enter order IDs and refund amounts
4. Upload and confirm

## CSV Format Requirements

- **File type:** CSV (comma-separated values)
- **Encoding:** UTF-8
- **Headers:** Must match the template exactly
- **Amounts:** Numbers only, no currency symbols
- **Phone numbers:** Include country code (e.g., +237)

## Status Tracking

After submitting a bulk operation:
- Each item shows its individual status (Pending, Processing, Completed, Failed)
- You receive a summary notification when the batch completes
- Failed items can be retried individually

> **Tip:** Always start with a small batch (5-10 items) to test before processing hundreds of records.', 26, true),

('merchants', 'API Key Management', 'api-key-management', '# API Key Management

Enterprise merchants get full API access for building custom integrations.

## Types of API Keys

| Key Type | Purpose | Where to Use |
|---|---|---|
| **Publishable Key** | Identify your account in client-side code | Website, mobile app frontend |
| **Secret Key** | Authenticate server-side API calls | Your backend server only |
| **Webhook Secret** | Verify incoming webhook signatures | Your webhook endpoint |

## Creating API Keys

1. Go to **Settings → API Keys** (or **API Key Management** for advanced options)
2. Tap **Generate New Key**
3. Name your key (e.g., "Production Website" or "Mobile App")
4. Select the environment: **Live** or **Sandbox**
5. Copy and securely store all keys immediately — the secret key is only shown once

## Managing Keys

- **Rotate** — Generate a new key and deactivate the old one (recommended every 90 days)
- **Revoke** — Permanently disable a key if compromised
- **View Usage** — See how many API calls each key has made

## Sandbox vs Live

| Environment | Purpose |
|---|---|
| **Sandbox** | Test your integration without real money |
| **Live** | Process real payments |

Always develop and test in Sandbox first, then switch to Live when ready.

## Security Best Practices

- Never expose your Secret Key in client-side code or public repositories
- Store keys in environment variables, not in your codebase
- Use IP allowlisting to restrict which servers can use your keys
- Rotate keys regularly and after any staff changes

> **Tip:** If you suspect a key has been compromised, revoke it immediately and generate a new one. All pending transactions will continue to process.', 27, true)

ON CONFLICT DO NOTHING;
