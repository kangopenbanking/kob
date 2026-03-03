

# Plan: Institution PWA URL Directory & Admin Management Page

## What We're Building

1. **A new admin page** (`/admin/institution-urls`) that lists all registered banks/financial institutions with their unique PWA URLs in a searchable, copyable table.

2. **Each institution gets a unique URL** in the format: `https://kob.lovable.app/bank/{institutionId}` — this is already the routing pattern used by the Banking App splash/onboarding flow. The new page simply surfaces these URLs for admin visibility and management.

3. **PWA Install Prompt enhancement** — the `PWAInstallPrompt` component will display the institution-specific URL so users know exactly what app link they're installing.

4. **Admin navigation update** — add the new page to the admin sidebar under the "Management" section.

## Changes

### 1. New Page: `src/pages/admin/InstitutionAppUrls.tsx`
- Fetch all institutions from the `institutions` table (id, name, type, status, logo_url, primary_color)
- Display a table with columns: Logo, Name, Type, Status, PWA URL, Actions (Copy URL, Open)
- The PWA URL = `https://kob.lovable.app/bank/{institution.id}`
- Search/filter by name
- Copy-to-clipboard button for each URL
- "Open" button to preview the PWA in a new tab

### 2. Update `src/components/admin/admin-navigation-config.ts`
- Add `{ title: "Institution App URLs", path: "/admin/institution-urls", icon: Link2 }` to the "Management" section

### 3. Update `src/App.tsx`
- Add route: `<Route path="institution-urls" element={<InstitutionAppUrls />} />`

### 4. Update `src/components/pwa/PWAInstallPrompt.tsx`
- Accept optional `appUrl` prop
- Display the institution-specific URL below the app name in the hero section so users see the link they're installing

### 5. Update `src/pages/banking-app/BankSplash.tsx`
- Pass `appUrl={window.location.origin + '/bank/' + institutionId}` to `PWAInstallPrompt`

