
# Giveting — Fundraising module for Kang Consumers App

A GoFundMe-inspired module inside the Customer PWA where KYC-verified users create causes/campaigns, any wallet user can donate from their Kang balance, and organisers withdraw raised funds to their wallet (or route to a linked bank/mobile-money account).

Design language follows the uploaded screens: deep forest green (`#0F3D2E`) primary, lime accent (`#B6F09C` / `#5FD068`) for CTAs, white surfaces, rounded 24px cards, bold sans-serif (existing app font), Lucide outline icons only. No gradients, no emojis. Fully responsive PWA, mobile-first.

---

## 1. User answers locked in
- Creator eligibility: **KYC-verified consumers only** (Youverify `approved`).
- Default withdrawal fee: **2.9% + 100 XAF** (row seeded in `fee_structures`, category `giveting_withdrawal`, editable in admin Fee Management).
- Catalogue: **17 GoFundMe categories** with multi-currency (XAF, XOF, EUR, USD, GBP). Donations converted through existing FX engine (XAF/XOF pegged 655.957 to EUR).

## 2. Navigation & routes (Customer PWA)
- Add new bottom-nav slot **"Giveting"** (heart-hand outline icon) between existing entries; wire via `bottom_nav_items` seed.
- Routes under `src/pages/customer-app/giveting/`:
  - `/giveting` — Fundraise home (my campaigns, empty state, "Start a fundraiser" CTA)
  - `/giveting/discover` — Discover feed (search, Location, Category, Time filters)
  - `/giveting/new` — Multi-step creation flow (category → beneficiary → goal & currency → story → cover media → review → ready-to-share)
  - `/giveting/c/:slug` — Public campaign detail (cover carousel, progress ring, donate/share CTAs, updates, donations, organiser, comments)
  - `/giveting/c/:slug/manage` — Organiser dashboard (goal card, donations list, updates, transfers, edit, preview)
  - `/giveting/c/:slug/donate` — Donate flow (amount → optional tip → PIN confirm → success/confetti)
  - `/giveting/c/:slug/donations` — Donor wall / recent + top
  - `/giveting/c/:slug/updates/new` — Post an update
  - `/giveting/c/:slug/withdraw` — Set-up transfers / request payout
  - `/giveting/notifications`, `/giveting/profile` — reused shell tabs

## 3. Database schema (new tables, all in `public`, all with GRANTs + RLS)
- `giveting_campaigns` — id, owner_user_id (FK profiles), slug (unique), title, story (text), category (enum 17), currency (XAF/XOF/EUR/USD/GBP), goal_amount (numeric), cover_media_url, gallery (jsonb), beneficiary_type (self/other/charity), beneficiary_name, beneficiary_relation, location_country, location_city, status (draft/pending/active/paused/completed/archived), verified_badge (bool), total_raised_minor (bigint, cached), donor_count (int, cached), published_at, created_at, updated_at.
- `giveting_donations` — id, campaign_id, donor_user_id (nullable for guest), donor_display_name, is_anonymous, amount_minor, currency, fx_rate_to_campaign, converted_amount_minor, tip_minor, comment, status (pending/succeeded/refunded/failed), payment_intent_id, idempotency_key (unique), created_at.
- `giveting_updates` — id, campaign_id, author_user_id, title, body, media_url, created_at.
- `giveting_comments` — id, campaign_id, author_user_id, donation_id (nullable), body, created_at.
- `giveting_followers` — campaign_id, user_id (composite PK).
- `giveting_withdrawals` — id, campaign_id, requested_by, destination_type (wallet/bank/momo), destination_ref, amount_minor, fee_minor, net_minor, status (pending/processing/settled/failed), idempotency_key, processed_at.
- Fee seed: insert row in `fee_structures` (`category='giveting_withdrawal', percentage=2.9, fixed_xaf=100`).
- Category seed: insert 17 rows into a new lookup `giveting_categories` (slug, label, icon, sort).

RLS summary:
- Campaigns: `SELECT` to anon/authenticated when `status='active'`; owner full manage; admin full.
- Donations: donor sees own; campaign owner sees all for own campaigns; admin all. Inserts blocked from client — mediated by edge function.
- Updates/comments: read matches parent campaign visibility; write by owner (updates) or any authenticated (comments).
- Withdrawals: owner read; admin all; writes edge-function only.

## 4. Edge Functions (all deployed under `supabase/functions/*`)
- `giveting-campaign-crud` — create draft, publish (checks KYC), edit, pause/archive, upload cover.
- `giveting-donate` — atomic: validate campaign active, lock donor wallet row `FOR UPDATE`, debit wallet via ledger, credit campaign escrow sub-wallet, insert donation, update cached totals, trigger notifications. Requires PIN via existing `PinConfirmDialog` → SCA token.
- `giveting-withdraw` — creates withdrawal request; requires PIN + KYC; posts fee (2.9% + 100 XAF, override lookup); debits escrow → credits owner wallet (or routes bank/momo via existing rails).
- `giveting-updates`, `giveting-comments` — CRUD.
- `giveting-public-lookup` — anon-friendly GET for `/giveting/c/:slug` and discover feed (paginated, cached).
- Reuses existing FX engine, ledger engine, PIN/SCA gating, and notification/email infra (new transactional templates: `giveting-donation-received`, `giveting-goal-milestone`, `giveting-withdrawal-processed`).

## 5. Component & UI work
- `CampaignCard`, `CampaignHero`, `ProgressRing`, `DonorRow`, `UpdatePost`, `OrganiserCard`, `CategoryChip`, `FilterBar`, `CreateFlow*` step components, `DonateSheet`, `ShareSheet`, `WithdrawSheet`, `AddOfflineDonationSheet`.
- Reuse `PinConfirmDialog`, `SuccessConfetti`, existing `SmoothCard`, form primitives, toasts.
- Empty states: "Your fundraiser is ready to share", "No donations yet", "Let's get to your goal…" — mirror uploaded screens with our brand colours.

## 6. Verification & E2E audit
After build:
- Vitest unit tests for fee calc, FX conversion, RLS policy shape.
- Playwright E2E under `src/test/giveting-e2e.test.ts`: create draft → publish → donate (2 currencies) → post update → withdraw → confirm balances.
- `supabase--linter` clean; deploy edge functions; `curl_edge_functions` smoke on donate + withdraw; check `security--run_security_scan` for new tables; confirm no regressions in existing cards, remittance, wallet flows.

## 7. Out of scope (this pass)
- Public web (non-PWA) campaign pages / SEO — can follow later using the public lookup edge function.
- Recurring monthly donations, employer match, tax-receipt PDFs — flagged for phase 2.
- Charity/501(c)(3)-style verified nonprofit onboarding — phase 2 (badge column already present).

Approve to proceed and I'll implement in this order: migration → edge functions → UI shell + routes → creation flow → detail + donate → manage/withdraw → E2E audit.
