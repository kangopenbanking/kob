# Credit Score System — E2E Audit (Monthly Reports + API Enhancements)
**Date:** 2026-04-18  
**Scope:** Automated monthly + weekly credit score email delivery, end-to-end, across the Consumer / Banking / Business apps and the public Credit Score API.

---

## 1. Executive Summary

The CrediQ credit score system has a complete UI, scoring engine, and email **content** layer (`crediq-emails`), and pre-existing GitHub Actions cron workflows for monthly reports and weekly digests. However, three critical gaps were preventing automated delivery from working end-to-end:

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| G1 | GitHub workflows posted to a non-existent project ref (`ftwbtzbeqkqrdmxmyvvz`) instead of the live project (`wdzkzeahdtxlynetndqw`). | **Critical** | ✅ Fixed |
| G2 | The two cron-target edge functions (`crediq-send-monthly-report`, `crediq-send-weekly-digest`) **did not exist**. Cron pings were 404ing silently. | **Critical** | ✅ Fixed |
| G3 | Users with credit profiles had **no row** in `crediq_email_preferences` (0 of 1 enrolled), so even a working dispatcher would have skipped them all. | **Critical** | ✅ Fixed |
| G4 | No audit trail for batch sends — no way to verify a monthly run completed or to investigate failures. | High | ✅ Fixed (`crediq_report_dispatch_log`) |
| G5 | API surface gap — `credit-score-fetch` did not honor `force_refresh` correctly (already fixed in prior audit, re-verified). | Medium | ✅ Verified |

After this round: monthly reports automatically dispatch on the 1st of each month at 09:00 UTC; weekly digests every Monday at 08:00 UTC. Each dispatch is fully audited and idempotent per user.

---

## 2. Architecture Overview

```
┌─────────────────────────┐       ┌──────────────────────────────────┐
│ GitHub Actions          │       │ crediq-send-monthly-report (NEW) │
│ crediq-monthly-report   │──────▶│ - Pages crediq_email_preferences │
│ (cron: 0 9 1 * *)       │       │ - Iterates opted-in users         │
└─────────────────────────┘       │ - Invokes crediq-emails per user  │
                                  │ - Logs to dispatch_log            │
┌─────────────────────────┐       └──────────────┬───────────────────┘
│ GitHub Actions          │                      │
│ crediq-weekly-digest    │──┐                   ▼
│ (cron: 0 8 * * 1)       │  │   ┌──────────────────────────────────┐
└─────────────────────────┘  │   │ crediq-emails                     │
                             │   │  action: send-monthly-report      │
                             └──▶│  action: send-weekly-digest       │
                                 │  - Fetches credit_scores +         │
                                 │    credit_score_history            │
                                 │  - Renders HTML                    │
                                 │  - Calls send-communication        │
                                 └──────────────────────────────────┘
```

---

## 3. Gap-by-Gap Detail

### G1 — Wrong Supabase project ref in workflows
**Before**
```yaml
curl -X POST 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/crediq-send-monthly-report' ...
```
**After**
```yaml
curl -X POST 'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/crediq-send-monthly-report' \
  -H 'x-trigger-source: github-actions' ...
```
Added `x-trigger-source` header so the dispatch log records `triggered_by='github-actions'` vs ad-hoc admin runs.

### G2 — Missing dispatcher functions
Created `supabase/functions/crediq-send-monthly-report/index.ts` and `crediq-send-weekly-digest/index.ts`. Both:
- Insert a `crediq_report_dispatch_log` row at start.
- Page through preferences (1 000 rows / page, hard cap 5 000 users / run for safety).
- Invoke `crediq-emails` per user with the appropriate action.
- Catch & continue on per-user failures.
- Update the dispatch log row on completion (`sent_count`, `failed_count`, error sample).
- Accept `{ "user_id": "<uuid>" }` for manual single-user re-sends.

### G3 — Empty preferences table
Migration `20260418_credit_score_email_automation`:
- Backfills `crediq_email_preferences` for every existing `credit_profiles.user_id` with sane defaults (monthly + weekly + tips + score-change ON; marketing OFF).
- Adds trigger `trg_ensure_crediq_email_preferences` on `credit_profiles INSERT` to keep new users opted-in by default — they can disable any time from the in-app preferences screen.

### G4 — Missing dispatch audit trail
New table `crediq_report_dispatch_log` (admin-readable via `has_role(...,'admin')`) captures:
- `dispatch_type`, `started_at`, `completed_at`
- `total_users`, `sent_count`, `failed_count`
- `error_details` JSONB (first 50 errors with user_id + message)
- `triggered_by` ('cron' | 'github-actions' | 'manual')

This lets ops verify "did the April 1 monthly run go out?" with one query.

### G5 — API surface enhancements verified
Re-validated from prior credit audit:
- `credit-score-fetch` honors `force_refresh=true`.
- `credit-recompute` enforces 60 s rate limit.
- `credit-events-list` paginates with `limit` cap 100.
- `credit-score-engine` returns delta vs previous score.

---

## 4. Standardised Credit-Score API Contract

All endpoints under the `/credit-*` namespace now follow a uniform shape:

| Endpoint | Method | Body | Returns |
|----------|--------|------|---------|
| `credit-score-fetch` | POST | `{ user_id, force_refresh?, include_report? }` | `{ score, score_band, source, recent_events }` |
| `credit-recompute` | POST | (auth header only) | `{ score, band, delta, previous_score, factors }` |
| `credit-events-list` | GET/POST | `?limit=&offset=&from=&to=&type=` | `{ events, total, limit, offset }` |
| `credit-report-generate` | POST | `{ user_id, report_type, requester_type, purpose }` | Full report JSON |
| `credit-score-simulate` | POST | `{ simulation_type, amount }` | `{ projected_score, delta, factors }` |
| `credit-score-tips` | POST | (auth header only) | `{ tips: string[] }` |
| `crediq-send-monthly-report` | POST | `{ user_id? }` | `{ success, dispatch_id, total, sent, failed }` |
| `crediq-send-weekly-digest` | POST | `{ user_id? }` | `{ success, dispatch_id, total, sent, failed }` |

Recommendation: a future v5 of the API spec should consolidate these under `/v1/credit/*` paths (see API contract memory) — this audit unblocks the email pipeline and is non-breaking at the function level.

---

## 5. Verification Checklist

- [x] Migration applied (preferences backfilled + trigger installed + dispatch_log created).
- [x] `crediq-send-monthly-report` deployed.
- [x] `crediq-send-weekly-digest` deployed.
- [x] Workflow YAMLs point to the correct project ref.
- [x] Smoke test executed — see `dispatch_log` for run id.
- [x] Existing `crediq-emails` already supports both actions; no template changes needed in this round.

## 6. Recommended Follow-ups (Non-blocking)

1. Add a "Resend last monthly report" button in the admin CrediQ dashboard, calling `crediq-send-monthly-report` with `{ user_id }`.
2. Surface `crediq_report_dispatch_log` as an Admin → Communications → "Batch Email Runs" view.
3. Migrate the inline HTML in `crediq-emails` to React Email templates and register them in `transactional-email-templates/registry.ts` so previews land in Cloud → Emails (cosmetic; current HTML already renders correctly).
4. Add quiet hours / time-zone awareness — currently all users get the email at the cron tick; future enhancement to stagger by user TZ.
