

## Email Services Audit & Fix Plan

### Current Findings

The project has **three separate email sending systems**, each with different configurations:

| System | Sender Name | From Address | Status |
|--------|-------------|--------------|--------|
| **Lovable Transactional** (`send-transactional-email`) | `kob` | `noreply@api.kangopenbanking.com` | Uses Lovable queue (verified domain: `notify.api.kangopenbanking.com`) |
| **Lovable Auth** (`auth-email-hook`) | `kob` | `noreply@api.kangopenbanking.com` | Uses Lovable queue (same verified domain) |
| **Managed Email** (`managed-send-email`) | `Kang Open Banking` | Via Resend `RESEND_FROM` secret | **FAILING** — Resend rejects `kangopenbanking.com` as unverified |
| **Send Communication** (`send-communication`) | `Kang Open Banking` | Via Resend `RESEND_FROM` secret | **FAILING** — same Resend domain issue |
| **Send Bulk Communication** (`send-bulk-communication`) | `Kang Open Banking` | Via Resend `RESEND_FROM` secret | **FAILING** — same Resend domain issue |
| **Send Customer Invoice** (`send-customer-invoice`) | N/A | Via Resend `RESEND_FROM` secret | **FAILING** — same Resend domain issue |

### Issues to Fix

1. **Sender name "kob" is wrong** — The Lovable transactional and auth email systems use `SITE_NAME = "kob"` instead of `"Kang OB"`. The `from` field renders as `kob <noreply@...>`.

2. **Resend-based functions are all broken** — `managed-send-email`, `send-communication`, `send-bulk-communication`, and `send-customer-invoice` use Resend directly, but the domain `kangopenbanking.com` is not verified on Resend. The verified Lovable domain is `notify.api.kangopenbanking.com`.

3. **From address mismatch** — User wants `support@kangopenbanking.com` but the verified sender domain is `notify.api.kangopenbanking.com` (subdomain). The `FROM_DOMAIN` can show as root domain in the From header, but the actual sending must go through the verified subdomain.

### Plan

**Step 1: Fix Lovable email sender name**
- Update `SITE_NAME` from `"kob"` to `"Kang OB"` in:
  - `supabase/functions/send-transactional-email/index.ts` (line 7)
  - `supabase/functions/auth-email-hook/index.ts` (line 39)
- Update `FROM_DOMAIN` to use `kangopenbanking.com` (root) so the From header shows `Kang OB <noreply@kangopenbanking.com>`

**Step 2: Migrate Resend-based functions to use Lovable email queue**
- Refactor `managed-send-email` to enqueue emails via the Lovable `enqueue_email` RPC instead of Resend directly. This uses the verified `notify.api.kangopenbanking.com` domain and gets retry safety.
- Update the `from` field to `Kang OB <support@kangopenbanking.com>` as the display From address.
- Update `send-communication` similarly for its email path.
- Update `send-bulk-communication` similarly.
- Update `send-customer-invoice` similarly.

**Step 3: Deploy all updated functions**
- Deploy: `send-transactional-email`, `auth-email-hook`, `managed-send-email`, `send-communication`, `send-bulk-communication`, `send-customer-invoice`

**Step 4: Test email delivery**
- Send a test email via `managed-send-email` to verify delivery works with the correct sender name and address.

### Technical Detail

The verified Lovable email domain is `notify.api.kangopenbanking.com`. Emails must be sent through this domain's infrastructure. The `FROM_DOMAIN` (display domain in the From header) can be set to the root `kangopenbanking.com` since `display_from_root` is supported. The sender name will be `Kang OB` and the display address `support@kangopenbanking.com`.

