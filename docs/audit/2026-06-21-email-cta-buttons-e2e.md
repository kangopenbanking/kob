# Email CTA Buttons — E2E Audit (2026-06-21)

**Scope:** Every CTA button in every transactional and auth email template.
**Method:** Each CTA URL was loaded with headless Playwright against the live
preview at `http://localhost:8080`. A CTA passes when HTTP status `< 400`, the
NotFound marker is absent, and the SPA does not silently bounce to `/`.

## Result: **34 / 34 PASS**

Run the suite anytime with:

```bash
python3 e2e/email-cta-routes.py
```

## Issues found and fixed

| # | Template | Issue | Fix |
|---|---|---|---|
| 1 | `weekly-activity-digest` | `dashboardUrl` prop never supplied by the cron — the "Open your dashboard" button never rendered. | `send-weekly-activity-digest` now passes `dashboardUrl: ${APP_BASE_URL}/dashboard`. |
| 2 | `rent-payment-reminder` | Default CTA pointed to non-existent `https://kangopenbanking.com/app/rent-reporting`. | Switched to canonical `${APP_BASE_URL}/rent-reporting` via shared `appUrl()` helper. |
| 3 | `crediq-monthly-report`, `crediq-weekly-digest`, `crediq-score-change`, `crediq-tip-recommendation` | All defaulted to `kangopenbanking.com/app/credit` (wrong host + non-existent path). | All now default to `${APP_BASE_URL}/credit-score`. |
| 4 | `monthly-statement` | `send-monthly-statement` built `/statements?...` URL — no such route. | Updated to `/app/statements?...` which matches the actual nested customer-app route. |
| 5 | `welcome`, `payment-confirmation`, `payment-received`, `payout-processed`, `high-value-alert`, `login-alert`, `password-changed`, `api-key-created`, `kyc-status-update`, `loan-application-received`, `loan-status-update`, `merchant-onboarded`, `consent-authorized`, `consent-revoked`, `statement-ready`, `support-reply`, `support-ticket-created`, `chat-assigned` (18 templates) | **No CTA button at all** — users had to find the app on their own. | Added a `CtaButton` from new `_shared/transactional-email-templates/_cta.tsx`, routed to the relevant page (dashboard, security, loans, merchant, consents, support, KYC, developer portal, admin support chat). |

## Architecture: single source of truth for CTA URLs

Created `supabase/functions/_shared/transactional-email-templates/_cta.tsx`:

- `APP_BASE_URL` — reads `Deno.env.get('APP_BASE_URL')`, falls back to `https://info.kangfintechsolutions.com`.
- `appUrl(path)` — builds a full app URL.
- `<CtaButton href label fallbackPath />` — renders the canonical primary CTA. If `href` is missing or not absolute, it uses `appUrl(fallbackPath)`.

Every template now imports from `_cta.tsx`; future template changes flow through a single, tested path.

## Full PASS matrix

| Template | CTA label | Destination path |
|---|---|---|
| signup | Confirm your email | /auth |
| magic-link | Sign in | /auth |
| recovery | Reset password | /auth |
| invite | Accept invite | /auth |
| email-change | Confirm email change | /auth |
| welcome | Open your dashboard | /dashboard |
| payment-confirmation | View transaction | /dashboard |
| payment-received | Open your wallet | /dashboard |
| payout-processed | View payout details | /merchant |
| high-value-alert | Review transaction | /dashboard |
| login-alert | Review security settings | /security |
| password-changed | Review security settings | /security |
| api-key-created | Open developer portal | /developer |
| kyc-status-update (approved) | Open your dashboard | /dashboard |
| kyc-status-update (requires action) | Complete verification | /kyc-verification |
| kyc_incomplete_reminder | Complete verification | /kyc-verification |
| loan-application-received | View loan status | /loans |
| loan-status-update | View loan details | /loans |
| merchant-onboarded | Open merchant dashboard | /merchant |
| consent-authorized | Manage consents | /consents |
| consent-revoked | Manage consents | /consents |
| statement-ready | Download statement | /dashboard |
| weekly-activity-digest | Open your dashboard | /dashboard |
| monthly-statement | Download statement (PDF) + CSV | /app/statements?period=… |
| support-ticket-created | Open support chat | /support |
| support-reply | Open support chat | /support |
| chat-assigned (agent) | Open admin support chat | /admin/support-chat |
| support-agent-invite | Sign in to Agent Console | /support-agent |
| admin-email-queue-alert | Open admin dashboard | /admin/invite-email-history |
| crediq-monthly-report | View full report / Upgrade | /credit-score |
| crediq-weekly-digest | View my score | /credit-score |
| crediq-score-change | See what changed | /credit-score |
| crediq-tip-recommendation | View my tips | /credit-score |
| rent-payment-reminder | Open Rent Reporting / Record now | /rent-reporting |

## Files changed

- **new** `supabase/functions/_shared/transactional-email-templates/_cta.tsx`
- **edited** 22 templates under `supabase/functions/_shared/transactional-email-templates/`
- **edited** `supabase/functions/send-weekly-activity-digest/index.ts` — pass `dashboardUrl`
- **edited** `supabase/functions/send-monthly-statement/index.ts` — fix `/app/statements` path
- **edited** `supabase/functions/rent-payment-reminders/index.ts` — use canonical host + `/rent-reporting`
- **new** `e2e/email-cta-routes.py` — Playwright regression suite

## Status: PASS
