

# Consumer & Business Dispute Portal — Gap Audit

## Findings Summary

### Consumer App (`/app/disputes` — `CustomerDisputes.tsx`)
| Feature | Status | Gap |
|---|---|---|
| Route registered in App.tsx | ✅ | — |
| File a dispute form | ✅ | — |
| Calls `gateway-file-dispute` edge function | ✅ | — |
| List disputes with status badges | ✅ | — |
| Detail dialog with timeline | ✅ | — |
| **Navigation link to page** | ❌ | **No link exists anywhere in the consumer app UI** — route exists but is unreachable from any menu, bottom nav, settings, or "More" page |
| Transaction selector (pick from recent txns) | ❌ | User must manually type a transaction ref — no dropdown of their recent transactions |
| Institution selector | ❌ | No way to specify which institution the dispute is against (the `institution_id` field is never sent) |
| Status filter/search | ❌ | No filtering — all disputes shown in a flat list |

### Business App (`/biz/disputes` — `BusinessDisputes.tsx`)
| Feature | Status | Gap |
|---|---|---|
| Route registered in App.tsx | ✅ | — |
| Evidence submission | ✅ | Fixed in prior iteration |
| Reachable via Compliance page | ✅ | — |
| **Activity timeline** | ❌ | No timeline — merchant desktop version has it but business PWA does not |
| **Detail dialog** | ❌ | No detail view — only inline evidence submission |
| **Status stats dashboard** | ❌ | No stats row like the merchant desktop version |
| **Search/filter** | ❌ | No search or status filter |
| **Add note capability** | ❌ | No note-adding via `dispute-lifecycle` |
| **Priority/overdue indicators** | ❌ | No visual warning for overdue evidence deadlines |

### Merchant Desktop (`/merchant/disputes` — `MerchantDisputes.tsx`)
| Feature | Status |
|---|---|
| Full stats dashboard | ✅ |
| Search + status filter | ✅ |
| Evidence submission with types | ✅ |
| Activity timeline | ✅ |
| Add notes via dispute-lifecycle | ✅ |
| Priority/overdue indicators | ✅ |
| **Complete — no gaps** | ✅ |

## Implementation Plan

### 1. Add Navigation Link for Consumer Disputes
Find the consumer app's account/settings/more page and add a "Disputes" menu item linking to `/app/disputes`.

### 2. Enhance Consumer Disputes Page
- Add a **transaction selector** — fetch recent transactions and show as a dropdown so users don't have to manually type refs
- Add **institution_id** to the dispute filing body — if user has linked accounts, show institution selector
- Add a **status filter** chip bar (All / Open / In Progress / Resolved)

### 3. Enhance Business Disputes Page to Match Merchant Desktop
- Add **stats row** (Total, Open, Investigating, Under Review, Won, Lost)
- Add **search + status filter**
- Add **detail dialog** with activity timeline (query `dispute_activities`)
- Add **"Add Note"** capability via `dispute-lifecycle`
- Add **priority badges** and **overdue evidence** visual warnings
- Add **evidence type selector** matching the merchant desktop pattern

## Files to Modify

| File | Action |
|---|---|
| Consumer app settings/account/more page (TBD — need to find the right file) | Add "Disputes" navigation link |
| `src/pages/customer-app/CustomerDisputes.tsx` | Add transaction selector, institution picker, status filter |
| `src/pages/business-app/BusinessDisputes.tsx` | Add stats, search, timeline, notes, priority indicators |

