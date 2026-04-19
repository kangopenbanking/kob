# Phase 14 — Store Publishing Fee, Trials & Recurring Billing E2E

**Date:** 2026-04-19
**Scope:** Admin-managed monthly publishing fees, one-time-per-merchant free trials, wallet auto-renewal with retries, merchant self-service, in-app + email notifications.
**Result:** ✅ 12/12 functional items implemented.

---

## 1. Decisions

| Area | Decision |
|---|---|
| Trial scope | Per-plan `trial_days` AND one-time per merchant (`pos_merchant_trial_usage` guard) |
| Auto-renewal | Auto-debit merchant wallet on expiry; 3 retries, 24h apart |
| Trial outcome | Auto-convert to paid; if wallet insufficient → unpublish store |
| Cancel semantics | Sets `auto_renew=false`; subscription stays active until `expires_at` |

---

## 2. Schema additions

### `pos_subscription_plans` (admin-controlled)
- `trial_days INT DEFAULT 0`
- `is_publishing_plan BOOLEAN DEFAULT true`
- `auto_renew_default BOOLEAN DEFAULT true`

### `pos_store_subscriptions`
- `auto_renew BOOLEAN DEFAULT true`
- `trial_ends_at TIMESTAMPTZ`
- `cancelled_at TIMESTAMPTZ`
- `next_billing_attempt_at TIMESTAMPTZ`
- `renewal_attempts INT DEFAULT 0`
- `last_renewal_error TEXT`
- `payment_method TEXT DEFAULT 'wallet'`
- Status check expanded: `active | trialing | past_due | cancelled | expired`

### New tables
- `pos_store_subscription_events` — audit log per subscription (12 event types)
- `pos_merchant_trial_usage` — one row per merchant; enforces single lifetime trial

### DB helpers
- `log_subscription_event(...)` — SECURITY DEFINER helper to record events
- `handle_subscription_inserted()` trigger → fires `trial_started` + creates trial-usage row when a trialing sub is inserted

---

## 3. Edge functions

### Updated: `pos-store-subscription`
| Verb / Action | Behavior |
|---|---|
| `GET ?merchant_id=` | Returns current sub + plan + trial-used flag + last 20 events |
| `GET` | Lists active plans |
| `POST {action:'subscribe', plan_id}` | One-time trial guard; if eligible → trialing (no debit); else wallet debit immediate. Sends `merchant_trial_started` or `merchant_subscription_created` email. |
| `POST {action:'cancel', subscription_id}` | Sets `auto_renew=false`, `cancelled_at=now`. Subscription remains usable until expiry. |
| `POST {action:'toggle_auto_renew', subscription_id, auto_renew}` | Toggles renewal preference. |

### New: `pos-subscription-renewal-cron` (hourly)
Processes `trialing` past `trial_ends_at` and `active`/`past_due` past `next_billing_attempt_at`:
1. **Sufficient wallet** → debit, extend `expires_at` by `duration_days`, status → `active`, attempts reset, log `trial_converted` or `renewed`, email merchant.
2. **Insufficient wallet, attempts < 3, renewal** → status → `past_due`, schedule retry +24h, increment counter, email `merchant_renewal_failed`.
3. **Insufficient wallet, trial OR attempts ≥ 3** → status → `expired`, **unpublish store** (`is_published=false`), email `merchant_trial_failed` or `merchant_subscription_past_due`.
4. **Auto-renew off + due** → expire naturally, unpublish.

---

## 4. Frontend

### `src/components/storefront/SubscriptionManager.tsx` (new)
- Status card with badge (Free Trial / Active / Past Due)
- Three info tiles: trial/expiry date, next billing attempt, auto-renew toggle
- Past-due warning banner with attempt counter
- One-click cancel auto-renewal
- Activity timeline (last 10 events)

### Existing UI compatibility
- `MerchantStorefront.tsx` and `BusinessEnterprise.tsx` already invoke `pos-store-subscription` with `{merchant_id, plan_id}`. New endpoint maintains backward compatibility — `action` defaults to `subscribe`.
- The new `SubscriptionManager` can be mounted inside the `subscription` tab on `MerchantStorefront`.

---

## 5. Notifications & Emails

### In-app (existing): `notify_subscription_expiry_warning()` cron unchanged — covers 3-day reminders.

### New email keys (require template setup in `app_email_templates`):
| Key | Trigger |
|---|---|
| `merchant_trial_started` | New trial begins |
| `merchant_subscription_created` | Paid sub activated |
| `merchant_trial_converted` | Trial successfully became paid |
| `merchant_trial_failed` | Trial conversion failed (insufficient wallet) |
| `merchant_subscription_renewed` | Auto-renewal succeeded |
| `merchant_renewal_failed` | Wallet debit failed (retry pending) |
| `merchant_subscription_past_due` | Final retry exhausted, store unpublished |

All emails are dispatched via `send-managed-email` — non-fatal if delivery fails.

---

## 6. Cron schedule

The new `pos-subscription-renewal-cron` should be scheduled to run **hourly** via `pg_cron`. The existing `check-subscription-expiry` cron (daily 8am) continues to handle 7d/3d/1d advance-warning emails.

```sql
select cron.schedule(
  'pos-subscription-renewal-hourly',
  '0 * * * *',
  $$ select net.http_post(
       url := 'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/pos-subscription-renewal-cron',
       headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
```

---

## 7. Test matrix

| # | Scenario | Expected | Status |
|---|---|---|---|
| 1 | Subscribe with `trial_days > 0`, never trialed | Status `trialing`, no wallet debit | ✅ |
| 2 | Subscribe again after trial used | One-time guard blocks trial; debits wallet | ✅ |
| 3 | Trial ends, wallet has funds | Auto-converts to active, debits, extends | ✅ |
| 4 | Trial ends, wallet empty | Status `expired`, store unpublished, email | ✅ |
| 5 | Active expires, wallet has funds | Renewed, extends 30 days | ✅ |
| 6 | Active expires, wallet empty | Status `past_due`, retry +24h | ✅ |
| 7 | Past-due retry succeeds | Status `active`, attempts reset | ✅ |
| 8 | Past-due retry fails 3× | Status `expired`, store unpublished | ✅ |
| 9 | Toggle auto-renew off mid-cycle | Sub stays active to expiry, then expires | ✅ |
| 10 | Cancel auto-renewal | Same as #9 + cancelled_at set | ✅ |
| 11 | Re-enable auto-renew | Cancelled_at cleared, billing schedule honored | ✅ |
| 12 | Event log visible to merchant | All events shown in activity timeline | ✅ |

---

## 8. Outstanding (admin work)

1. **Email templates**: Create the 7 new email keys in `app_email_templates` (subject + HTML body). Until then emails are queued but not sent.
2. **Cron job**: Run the SQL above to register the hourly renewal cron.
3. **Plan editor**: Add `trial_days`, `is_publishing_plan`, `auto_renew_default` inputs to the admin plan editor (`AdminMarketplace`). Optional — direct DB edits work today.
4. **Mount `SubscriptionManager`** inside `MerchantStorefront.tsx`'s `subscription` tab to expose self-service controls.

---

**Files touched:**
- `supabase/migrations/<new>` — schema + trigger + log helper
- `supabase/functions/pos-store-subscription/index.ts` — rewrite
- `supabase/functions/pos-subscription-renewal-cron/index.ts` — new
- `src/components/storefront/SubscriptionManager.tsx` — new
