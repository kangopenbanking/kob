

# Plan: Multi-Tenancy Apps Showcase Page

## Overview

Create a new standalone page at `/apps` that showcases the Kang Open Banking multi-tenancy PWA ecosystem. This page will be a visually striking, animated landing page explaining how each institution gets its own branded app experience, with live links to the Banking App (Phase 1) and placeholder sections for Merchant and Customer apps (Phases 2 and 3).

## Design Approach

- Solid color backgrounds with accent sections (no gradients on cards/buttons per design system)
- `framer-motion` stagger animations for section reveals and card entrances
- Lucide outline icons throughout, no emojis
- Animated phone mockup frames showing app screenshots
- Color-coded sections per app (blue for Banking, green for Merchant, purple for Customer)
- Institution selector demo showing how branding changes per tenant

## Files to Create

### 1. `src/pages/Apps.tsx`
The main showcase page with these sections:

**Hero Section** -- Full-width solid primary background with animated headline: "One Platform, Every Bank's Own App". Animated phone mockup with floating UI elements. Subtitle explaining multi-tenancy.

**How It Works** -- 3-step animated flow:
1. Institution registers on the platform (Building2 icon)
2. Branding is applied automatically (Palette icon)  
3. Customers access their bank's dedicated app (Smartphone icon)

Each step animates in with staggered delays using framer-motion.

**Banking App Card (Phase 1 -- Live)** -- Large featured card with:
- Solid blue accent strip
- Key features list (Wallet, Payments, Cards, History, KYC)
- "Launch Demo" button linking to `/bank/f493095b-037a-40cf-82bc-3a3ab74550dd`
- Status badge: "Live"
- Animated feature icons

**Merchant App Card (Phase 2 -- Coming Soon)** -- Muted card with:
- Solid green accent strip
- Planned features list
- "Coming Soon" badge
- Disabled button

**Customer App Card (Phase 3 -- Coming Soon)** -- Muted card with:
- Solid purple accent strip
- Planned features list
- "Coming Soon" badge
- Disabled button

**Multi-Tenancy Demo Section** -- Visual showing how the same app renders with different institution branding (color swatches, logo placeholders, institution name).

**Technical Architecture Section** -- Clean diagram showing the route structure (`/bank/:id`, `/merchant/:id`, `/app/:id`) with TenantProvider context explanation for developers.

**CTA Section** -- "Register Your Institution" button linking to `/register`.

### 2. Route Registration in `src/App.tsx`
- Add `<Route path="/apps" element={<Layout><Apps /></Layout>} />` 

## Key Implementation Details

- All animations use `framer-motion` `motion.div` with `whileInView` triggers for scroll-based reveals
- App cards use `motion.div` with `whileTap={{ scale: 0.98 }}` for press feedback
- The page is designed so that when Phase 2/3 apps are built, only the status badge and button need updating (from "Coming Soon" to "Live" with the correct link)
- The feature lists for each app are defined as typed arrays, making future updates trivial
- A link to this page will be added to the main navigation or referenced from the Index page's portal section

## Estimated Changes
- **New:** `src/pages/Apps.tsx` (~350 lines)
- **Modified:** `src/App.tsx` (add 1 route + 1 import)

