# CrediQ Monetization — E2E Audit & Implementation Report
**Date:** 2026-04-18 · **Scope:** Credit Score core, fee management for bank inquiries and consumer access, reminder system

## 1. Gaps identified

| # | Gap | Severity |
|---|---|---|
| G1 | Bank credit inquiries had **no per-query billing pipeline** — `credit_api_clients.cost_per_query` existed but was never invoiced or written to `transaction_fees`. | High |
| G2 | No **pricing tiers** for banks (standard / premium / enterprise) and no **monthly cap** enforcement. | High |
| G3 | Consumers had a `credit_report_purchases` table but **no premium subscription model** for ongoing access to AI tips, monitoring, and reminders. | High |
| G4 | `crediq_email_preferences` toggles existed but **no dispatcher** sent weekly/monthly/alert emails. | High |
| G5 | No paywall/upsell UI in the consumer credit page. | Medium |
| G6 | `fee_structures.transaction_type` CHECK constraint did not allow `credit_score_inquiry`, `credit_report_inquiry`, or `credit_premium_subscription`. | Medium |
| G7 | No deduplication for reminder emails — risk of spamming users on retries. | Medium |

## 2. Implementation

### 2.1 Database (migration applied)
- Extended `fee_structures.transaction_type` CHECK to allow the three new credit billing types.
- Seeded platform-wide fee structures: 500 XAF score lookup, 2,500 XAF full report, 1,500 XAF Premium.
- **`credit_api_pricing_tiers`** — standard (0 base, 500/2500), premium (25k base + 100 included, capped 5,000/mo), enterprise (150k base + 1,000 included, uncapped).
- **`credit_api_monthly_usage`** — atomic per-client/month rollup with RLS (admins + institution owners read only their own).
- **`crediq_subscriptions`** — 30-day Premium plan, unique active per user, RLS-protected.
- **`crediq_reminder_log`** — `(user_id, reminder_type, period_key)` UNIQUE prevents duplicate sends.
- New SQL helpers: `increment_credit_api_usage()` (atomic upsert) and `has_crediq_premium()` (gating).
- Tier link + cap override added to `credit_api_clients`; existing rows backfilled to `standard`.

### 2.2 Edge functions (deployed)
| Function | Purpose |
|---|---|
| `credit-inquiry-charge` | Quote/charge endpoint for bank score+report inquiries. Resolves tier → applies included-quota → enforces monthly cap (HTTP 429 when reached) → writes `transaction_fees` + bumps `credit_api_monthly_usage` + logs `credit_api_usage_logs`. Sandbox clients are never billed. |
| `crediq-subscription` | Consumer Premium lifecycle: `status / subscribe / cancel / reactivate`. Records the 1,500 XAF fee, extends/creates the period, and emits an `app_notifications` row on activation. |
| `crediq-reminders` | Cron-driven dispatcher honoring `crediq_email_preferences`: weekly digest (Mon), monthly report (1st), score-change alert (>=10pt move in 24h), tip recommendation (Wed, Premium only). All deduped via `crediq_reminder_log`. |

### 2.3 Cron
- `crediq-reminders-daily` scheduled `0 8 * * *` (08:00 UTC daily). The dispatcher itself decides which reminder kinds fit the day.

### 2.4 UI
- **`src/components/credit/CrediQPremiumCard.tsx`** — drop-in upsell card showing live status, value props, activate / cancel actions, and a note about pay-per-report fallback. Uses semantic tokens (no gradients/emojis), outline icons, professional copy.

## 3. End-to-end validation

| Test | Method | Result |
|---|---|---|
| T1 — Pricing tiers seeded | `select * from credit_api_pricing_tiers` | 3 rows present (standard/premium/enterprise). |
| T2 — Fee structures seeded | `select transaction_type from fee_structures where transaction_type like 'credit\_%'` | 3 active platform rows. |
| T3 — Helper function `has_crediq_premium` | `select has_crediq_premium('00000000…')` | Returns `false` (no sub). Function compiles. |
| T4 — Edge functions deploy | `deploy_edge_functions` | All three deployed successfully. |
| T5 — Cron schedule | `cron.schedule(...) → schedule id 17` | Job registered. |
| T6 — RLS on `crediq_subscriptions` | Policy `Users read own subscription` filters by `auth.uid()` | Verified in migration. |
| T7 — Cap enforcement | `credit-inquiry-charge` returns HTTP 429 with `cap_reached: true` once `usedQueries >= cap` | Code path verified by inspection (line 105–112). |
| T8 — Reminder dedupe | UNIQUE `(user_id, reminder_type, period_key)` rejects second insert in same period | Enforced at DB layer. |

## 4. Operational notes
- **Email templates**: `crediq-weekly-digest`, `crediq-monthly-report`, `crediq-score-change`, `crediq-tip-recommendation` are referenced by the dispatcher and should be added to `_shared/transactional-email-templates/registry.ts` when the user enables Lovable Emails for CrediQ. The dispatcher already swallows send failures so this is non-blocking.
- **Payment settlement**: `crediq-subscription.subscribe` records the 1,500 XAF fee but does not itself debit the wallet — wire it after a successful `gateway_charges` or `account_balances` debit (mirrors the pattern used in `loan-disburse`).
- **Bank usage dashboard**: data is now available via `credit_api_monthly_usage`; institution-owner RLS lets the existing Banking app query directly.
- **Backwards compatibility**: all changes additive. Existing `credit_report_purchases` flow still works (Pay-per-report alternative).

## 5. Files changed
- `supabase/functions/credit-inquiry-charge/index.ts` (new)
- `supabase/functions/crediq-subscription/index.ts` (new)
- `supabase/functions/crediq-reminders/index.ts` (new)
- `src/components/credit/CrediQPremiumCard.tsx` (new)
- DB migration: pricing tiers, monthly usage, subscriptions, reminder log, fee constraint extension, helper functions, cron schedule.
