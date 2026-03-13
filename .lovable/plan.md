

# Content Best Practices, Mobile Tap Targets & Structured Data Fixes

## Problems Identified

### 1. Footer Tap Targets Too Small (41% fail rate)
The footer renders all links at default text size (~16px height) with only `space-y-2` (8px) vertical gap. This produces tap targets of ~26-137px wide by ~16px tall — well below the 48x48px minimum. Nearly every footer link overlaps its neighbor.

### 2. Missing Descriptive Link Text
Footer links like "SLA", "FAQ", "PCI Scope" are generic labels. Search engines need descriptive `aria-label` or `title` attributes to understand destination content. The footer `<Link>` elements have no accessibility attributes.

### 3. Missing SEO/Structured Data on Key Product Pages
- **`/crediq`** (`CrediQ.tsx`) — No `<Helmet>`, no meta description, no structured data
- **`/for-merchants`** (`ForMerchants.tsx`) — Has Helmet but no structured data (Product schema)
- **`/piggybank`** (`PiggyBankInfo.tsx`) — Has Helmet but no structured data
- **`/njangi`** (`NjangiInfo.tsx`) — Has Helmet but no structured data  
- **`/rent-reporting`** (`RentReportingInfo.tsx`) — Has Helmet but no structured data
- **`/` (Index.tsx)** — No Helmet at all (relies only on static `index.html` meta)

### 4. Semantic HTML Gaps
Footer uses `<ul>/<li>` (good) but the overall `<footer>` lacks `aria-label`, `role="contentinfo"` is implicit but link groups lack `<nav>` wrappers for crawler comprehension.

---

## Implementation Plan

### A. Fix Footer Tap Targets (`src/components/Footer.tsx`)
- Increase `space-y-2` to `space-y-3` on link lists
- Add `py-2` padding to each `<Link>` to make minimum tap target 48px tall
- Add `min-h-[48px] inline-flex items-center` to ensure consistent sizing
- Add descriptive `aria-label` to ambiguous links (SLA, FAQ, PCI Scope, etc.)
- Wrap each footer section's `<ul>` in a `<nav aria-label="...">` for semantic grouping

### B. Add Structured Data to Product Pages

**`CrediQ.tsx`** — Add `<Helmet>` with title, meta description, and `SoftwareApplication` JSON-LD schema:
```json
{
  "@type": "SoftwareApplication",
  "name": "CrediQ Credit Score",
  "applicationCategory": "FinanceApplication",
  "description": "AI-powered credit scoring for Cameroon..."
}
```

**`ForMerchants.tsx`** — Add `Product` / `WebApplication` structured data for the merchant portal.

**`PiggyBankInfo.tsx`, `NjangiInfo.tsx`, `RentReportingInfo.tsx`** — Add `Product` structured data with appropriate `name`, `description`, `brand`, and `offers` fields.

### C. Add SEO Component to Index.tsx
Import and use the existing `<SEO>` component with homepage-specific structured data (already in `index.html` but adding dynamic Helmet ensures SPA navigation picks it up).

### D. Semantic HTML Improvements
- Add `aria-label="Footer navigation"` to `<footer>`
- Wrap footer link groups in `<nav>` elements
- Add descriptive `title` attributes to footer links with short labels

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/Footer.tsx` | Tap target sizing, aria-labels, nav wrappers, descriptive link text |
| `src/pages/CrediQ.tsx` | Add Helmet + SoftwareApplication JSON-LD |
| `src/pages/ForMerchants.tsx` | Add WebApplication JSON-LD structured data |
| `src/pages/PiggyBankInfo.tsx` | Add Product JSON-LD structured data |
| `src/pages/NjangiInfo.tsx` | Add Product JSON-LD structured data |
| `src/pages/RentReportingInfo.tsx` | Add Product JSON-LD structured data |
| `src/pages/Index.tsx` | Add SEO component import and usage |

No backend or database changes required.

