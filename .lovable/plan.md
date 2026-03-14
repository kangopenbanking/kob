

# Public Developer Documentation — Stripe/Flutterwave Model

## Problem
Every `/developer/*` route is wrapped in `ProtectedRoute > RoleGuard`, requiring login + developer/tpp role. This blocks anyone from reading API docs without an account — unlike Stripe, Flutterwave, Paystack, etc., which make all documentation publicly readable.

## Approach: Public Docs + Gated Tools

Split the ~80 developer routes into two categories:

### Public (no auth required) — ~60 routes
All **read-only documentation and guides**: overview, getting-started, API references (AISP, PISP, gateway, mobile money, banking, webhooks, etc.), error codes, rate limits, currencies, countries, changelog, SDK pages, code examples, status page, integration guides.

### Protected (auth required) — ~10 routes  
**Interactive tools** that touch user data: sandbox environment, API keys, certificate management, API playground, API console, webhook testing, sandbox data generator, API testing tool, sandbox usage/webhooks.

## Technical Plan

### 1. Create `PublicDeveloperLayout` component
A new layout component identical to `DeveloperLayout` but without auth dependency. Shows the same sidebar navigation, breadcrumbs, and professional chrome. Instead of `UserProfileMenu`, shows a "Sign In" / "Get API Keys" CTA for unauthenticated visitors. If the user IS logged in, shows their profile menu as normal.

### 2. Restructure routes in `App.tsx`
```text
Current:
  /developer/* → ProtectedRoute → RoleGuard → DeveloperLayout

New:
  /developer/* (public docs)  → PublicDeveloperLayout (no guard)
  /developer/* (tools)        → ProtectedRoute → RoleGuard → DeveloperLayout
```

Specifically, move all documentation routes out of the protected block into a new public block using `PublicDeveloperLayout`, while keeping sandbox, API keys, certificates, playground, console, webhook testing, and data generator inside the existing protected block.

### 3. Update `DeveloperLayout` sidebar
Add subtle lock icons next to protected items so public visitors can see what's available after signup. Link those items to `/auth` for unauthenticated users.

### 4. SEO benefit
Public pages become crawlable by Google, Bing, and API directories — matching the existing sitemap.xml and robots.txt that already list these URLs.

### Files to create
| File | Purpose |
|------|---------|
| `src/components/developer/PublicDeveloperLayout.tsx` | Public layout with optional auth, sign-in CTA |

### Files to modify
| File | Changes |
|------|---------|
| `src/App.tsx` | Split developer routes into public (PublicDeveloperLayout) and protected (existing DeveloperLayout) groups |
| `src/components/developer/DeveloperLayout.tsx` | Add lock icons on protected nav items for unauthenticated visitors |

### Security considerations
- No database queries or user-specific data exposed on public routes
- Interactive tools (sandbox, keys, certificates) remain fully gated behind `ProtectedRoute + RoleGuard`
- Inline `AuthRequiredAlert` components already in place on tools pages provide a second layer of defense
- Matches industry standard: Stripe, Flutterwave, Paystack, Adyen all use this exact pattern

