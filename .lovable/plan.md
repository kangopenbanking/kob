

## Plan: Implement Enterprise Package Features (Gated to Enterprise Subscription)

### Overview
Build out the five Enterprise-exclusive features (Custom Branding, API Access, Multi-location Inventory, Dedicated Account Manager, SLA Guarantee) as functional tabs/sections in the Merchant Storefront, gated behind an Enterprise plan check. When the merchant's active subscription is not an Enterprise plan, these features show a locked state prompting upgrade.

### Database Changes

**1. Add `tier` column to `pos_subscription_plans`** (migration)
```sql
ALTER TABLE pos_subscription_plans ADD COLUMN tier text NOT NULL DEFAULT 'standard';
```
Then update existing Enterprise plan data:
```sql
UPDATE pos_subscription_plans SET tier = 'enterprise' WHERE name ILIKE '%enterprise%';
```

**2. Add enterprise fields to `pos_store_profiles`** (migration)
```sql
ALTER TABLE pos_store_profiles 
  ADD COLUMN custom_brand_json jsonb DEFAULT '{}',
  ADD COLUMN sla_tier text DEFAULT null,
  ADD COLUMN account_manager_id uuid DEFAULT null,
  ADD COLUMN api_access_enabled boolean DEFAULT false;
```

### Frontend Implementation

**3. Create `src/components/storefront/EnterpriseGate.tsx`**
- A reusable lock overlay component that wraps Enterprise-only content
- Shows plan name badge + "Upgrade to Enterprise" CTA when `isEnterprise` is false
- Renders children normally when `isEnterprise` is true

**4. Create `src/components/storefront/EnterpriseFeaturesTab.tsx`**
A new tab containing five sections:

- **Custom Branding**: Color picker for primary/secondary colors, custom font selection, branded receipt header/footer text. Saved as `custom_brand_json` on `pos_store_profiles`.
- **API Access**: Display API key management (link to existing merchant keys system via `gateway-merchant-keys` edge function). Show endpoint docs, usage stats preview.
- **Multi-location Inventory**: Full CRUD for merchant locations using existing `pos-manage-locations` edge function. List locations, add new ones, edit, and view per-location stock levels.
- **Dedicated Account Manager**: Display assigned manager contact info (from `account_manager_id` → profiles lookup), or "Pending assignment" state. Include a "Request callback" button.
- **SLA Guarantee**: Display SLA tier details (99.9% uptime, response times), link to SLA terms, show current month uptime from existing SLA monitoring data.

**5. Update `src/pages/merchant/MerchantStorefront.tsx`**
- Derive `isEnterprise` from `subscription?.pos_subscription_plans?.tier === 'enterprise'` (or plan name fallback)
- Add "Enterprise" tab to the TabsList
- Import and render `EnterpriseFeaturesTab` inside the new TabsContent
- On the subscription plan cards, highlight Enterprise features with lock icons for non-enterprise plans

**6. Update `src/pages/KobPOS.tsx`**
- Add an "Enterprise" badge and visual lock indicators on the Enterprise pricing card features
- Add a dedicated "Enterprise Features" section below pricing explaining each feature in detail

### Technical Notes
- The `pos-manage-locations` edge function already supports full CRUD for locations and staff — the multi-location UI will consume this directly
- The `gateway-merchant-keys` edge function already handles API key generation — the API Access section reuses this
- Custom branding JSON structure: `{ primary_color, secondary_color, font, receipt_header, receipt_footer }`
- All Enterprise features are **read-only/locked** unless `isEnterprise === true`, ensuring no bypass

