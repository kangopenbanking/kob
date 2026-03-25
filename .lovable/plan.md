

# Plan: Professional Remittance Partners & Corridors — International-Grade Admin UI + Auto-Seeding

## What You're Seeing Now

The `remittance_partners` and `remittance_corridors` tables exist but are **empty**. The admin page works (create/edit dialogs are functional) but the UI is basic and there's no automation for seeding standard international corridors.

## What We'll Build

### 1. Auto-Seed Default Partners & Corridors (Database Insert)

Populate the database with production-ready default partners and corridors matching international remittance standards:

**Partners** (5):
| Name | Display Name | Type |
|---|---|---|
| `thunes` | Thunes | Cross-border aggregator |
| `terrapay` | TerraPay | Mobile wallet network |
| `onafriq` | Onafriq (MFS Africa) | Pan-African mobile money |
| `kob_internal` | KOB Internal | Internal wallet-to-wallet |
| `flutterwave` | Flutterwave | Card/bank collections |

**Corridors** (12+ routes, Cameroon-first):
- FR→CM, GB→CM, US→CM, DE→CM, CA→CM (diaspora inbound)
- CM→CM (domestic wallet-to-wallet)
- NG→CM, GH→CM, KE→CM (Pan-African)
- CM→NG, CM→SN, CM→CI (outbound)

Each corridor includes realistic fee models (percentage + fixed), min/max amounts, delivery estimates, and KYC levels matching Wise/WorldRemit standards.

### 2. Redesign Admin Page — International-Grade UI

Transform `RemittancePartners.tsx` into a professional dashboard matching Wise/Flutterwave admin panels:

- **Stats bar**: Total partners, active corridors, coverage countries, avg delivery time
- **Partner cards**: Enhanced with logo placeholders, connection status indicator (green/amber/red), corridor count badge, last health check timestamp, and quick-action buttons (test connection, view corridors, toggle status)
- **Corridor table**: Enhanced with country flag emojis, delivery time in human-readable format ("~15 min", "1-2 hrs"), fee breakdown display, volume indicators, and inline toggle for active/inactive
- **Bulk actions**: "Seed Default Corridors" button for one-click setup
- **Partner detail drawer**: Shows API config, health history, linked corridors, and transaction volume
- **Corridor creation**: Smart defaults based on selected partner, country picker with flags instead of raw ISO codes, fee calculator preview showing "Customer sends €100 → Recipient gets 63,250 XAF"

### 3. Corridor Auto-Configuration Logic

Add a "Quick Setup" flow in the admin UI:
- Select partner → auto-suggests supported corridors based on partner type
- Pre-fills fee models, delivery times, and limits based on industry standards
- Bulk-create corridors with one click
- Toggle "Auto-sync FX rates" flag (stored in corridor metadata for future cron integration)

### Technical Details

**Files Modified (2):**
- `src/pages/admin/RemittancePartners.tsx` — Complete UI redesign (additive enhancement, same file)

**Files Created (1):**
- `src/components/admin/remittance/CorridorQuickSetup.tsx` — Quick setup wizard component

**Database (Data insert only, no schema changes):**
- INSERT 5 partners into `remittance_partners`
- INSERT 12+ corridors into `remittance_corridors`

**No schema changes. No existing files deleted. No routes changed.**

