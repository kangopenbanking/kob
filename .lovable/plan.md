

## Goal
Switch the Live Support portal canonical URL from `https://info.kangopenbanking.com/support-agent` to `https://info.kangfintechsolutions.com/support-agent` everywhere it appears (emails, edge functions, admin UI), then verify end‑to‑end.

## Why
The new email sender domain is `notify.info.kangfintechsolutions.com`. Support emails should link to a portal on the same root brand (`info.kangfintechsolutions.com`) so the From‑domain and click‑through domain align — this improves DMARC alignment, deliverability, and user trust, and removes the cross‑brand mismatch in current invites/SLA/chat notifications.

## Scope of changes

### 1. Shared edge function constant (single source of truth)
File: `supabase/functions/_shared/sendSupportEmail.ts`
- Update default `SUPPORT_PORTAL_URL` from `https://info.kangopenbanking.com/support-agent` → `https://info.kangfintechsolutions.com/support-agent`.
- Keep the `SUPPORT_PORTAL_URL` env override so it can be re‑pointed without a redeploy.
- Leave `APP_BASE_URL` logic intact (separate concern).

### 2. Email template sample/preview data
File: `supabase/functions/_shared/transactional-email-templates/support-agent-invite.tsx`
- Update any hard‑coded `info.kangopenbanking.com` sample link in `previewData` / fallback so admin previews match the live URL.
- Audit and update sibling templates (`support-chat-notify`, `support-sla-escalation`) for any hard‑coded portal URLs.

### 3. Admin UI — Support Chat dashboard
File: `src/pages/admin/AdminSupportChat.tsx`
- Update the displayed canonical URL card, the “Copy link” value, and the “Open Portal” anchor `href` to `https://info.kangfintechsolutions.com/support-agent`.

### 4. Admin UI — Email Logs / Health / Preview
File: `src/pages/admin/AdminSupportEmailLogs.tsx`
- Replace any references to the old portal domain in the preview iframe seed data, health‑check copy, or analytics labels.

### 5. Edge functions that compose links directly
Audit and patch any remaining direct usage:
- `supabase/functions/notify-support-agents/index.ts`
- `supabase/functions/support-invite-agent/index.ts`
- `supabase/functions/support-sla-escalation/index.ts`
- `supabase/functions/support-email-preview/index.ts`
- `supabase/functions/support-email-health/index.ts`

All of these should import `SUPPORT_PORTAL_URL` from `_shared/sendSupportEmail.ts` instead of hard‑coding strings. Anywhere a literal `info.kangopenbanking.com/support-agent` still exists → replace with the imported constant.

### 6. Deploy
Redeploy the affected functions in one batch:
`sendSupportEmail.ts` consumers → `support-invite-agent`, `notify-support-agents`, `support-sla-escalation`, `support-email-preview`, `support-email-health`, `support-email-retry`, `support-email-webhook`, `support-email-domain-status`.

### 7. End‑to‑end audit (executed after deploy)
1. **DNS / domain reachability**
   - `curl -I https://info.kangfintechsolutions.com/support-agent` → expect 200 and Lovable HTML (not Netlify/Cloudflare placeholder).
   - If it does not resolve to Lovable, surface the DNS step required (A → `185.158.133.1`, add custom domain in Project Settings → Domains) and stop the audit at this checkpoint.
2. **Static link audit** — `grep -R "info.kangopenbanking.com/support-agent"` across `src/` and `supabase/functions/` returns zero matches.
3. **Admin Chat dashboard** — load `/admin/support-chat`; verify the displayed URL, Copy button, and Open Portal href all show the new domain.
4. **Email Preview** — invoke `support-email-preview` for each of `support-agent-invite`, `support-chat-notify`, `support-sla-escalation`; confirm rendered CTA buttons point to `info.kangfintechsolutions.com/support-agent`.
5. **Live invite send** — trigger `support-invite-agent` against a test recipient; check `email_send_log` for `status = sent` and inspect rendered HTML in the log payload to confirm the link.
6. **Health card** — run the “Email health” test on `/admin/support-email-logs` and confirm last success timestamp updates.
7. **Click‑through** — open the link from the delivered email; should land on the support agent page on `info.kangfintechsolutions.com` (only succeeds once that subdomain points to Lovable).

## Risks / preconditions
- `info.kangfintechsolutions.com` must be added as a custom domain on this Lovable project and DNS pointed to `185.158.133.1` (or its CNAME equivalent in proxy mode). If it is not yet pointed, code changes will deploy cleanly but step 7 of the audit will fail with a placeholder/404 page — same class of issue we hit previously with `kangopenbanking.com`. The plan will report this clearly rather than silently pass.
- `notify.info.kangfintechsolutions.com` (sender) is already provisioned and DNS‑verifying; no change needed there.

## Deliverables
- Updated shared constant + all references using it.
- Updated admin UI showing the new portal URL.
- Redeployed edge functions.
- A short audit report inline in chat covering each of the 7 checks with PASS/FAIL.

