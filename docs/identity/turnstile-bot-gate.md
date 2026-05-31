# Cloudflare Turnstile — Bot Gate for Developer Sandbox & Key Issuance

**Status:** Prototype shipped 2026-05-31. Default = shadow mode (logs only, never blocks).
**Owner:** Platform Security.

## What it gates

Cloudflare Turnstile is wired as a **second layer** in front of three internal edge functions
that mint durable records or credentials:

| Endpoint | Surface | Why |
|---|---|---|
| `developer-register-app` | `/developer/register` | Scripted abuse pollutes `api_clients` / `developer_apps` and burns rate-limit quota |
| `sandbox-create-account` | `/developer/sandbox`, `/developer/sandbox/console` | Creates `developer_sandbox_accounts` + seeds XAF test data |
| `sandbox-create-api-key` | same | Mints `sk_test_*` / `pk_test_*` / `whsec_test_*` / `sbx_*` credentials |

Turnstile is **NOT** added to:
- Any `/v1/*` REST endpoint (Standing Order 1 — THE LOCK: no new required headers).
- Authenticated app actions (payments, transfers, ledger writes — wrong layer; SCA + rate limits are correct controls).
- Admin/merchant key operations (`api-keys-create`, `api-keys-rotate`, `api-keys-revoke` — behind RBAC).
- Phone OTP (already gated by Firebase reCAPTCHA v2 + math captcha).

## Architecture

```text
Browser                                Edge Function
-------                                -------------
useTurnstile()  ──token──▶  developer-register-app / sandbox-create-account / sandbox-create-api-key
                                       │
                                       ▼
                                  _shared/turnstile.ts  ──siteverify──▶  challenges.cloudflare.com
                                       │
                                       ▼
                                  security_audit_logs (action='turnstile_check')
                                       │
                                       ▼
                                  ENFORCE flag on → 403 on fail
                                  ENFORCE flag off → continue (shadow)
```

## Configuration

Three env vars control behaviour:

| Name | Type | Where | Behaviour when unset |
|---|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` | Publishable (frontend `.env`) | Cloudflare → Turnstile → Site Key | Widget no-op, token = null, frontend works as before |
| `TURNSTILE_SECRET_KEY` | Runtime secret (Lovable Cloud) | Cloudflare → Turnstile → Secret Key | Verifier returns `{ ok: true, codes: ['turnstile_disabled'] }` — **fail-open** |
| `TURNSTILE_ENFORCE` | Runtime secret | Lovable Cloud | `!== 'true'` → shadow mode (log, never block). Set to `'true'` to enforce. |

**Authorized hostnames** to add in the Cloudflare Turnstile widget:
- `kob.lovable.app`
- `info.kangfintechsolutions.com`
- `kangopenbanking.com`
- `id-preview--342820e7-280a-44d3-88ce-2854c6d907ed.lovable.app`
- `localhost`

## Fail-open guarantees

The verifier returns `{ ok: true }` (allow) when:
- `TURNSTILE_SECRET_KEY` is not set (rollout safety).
- Cloudflare returns 5xx.
- Network/timeout (3 s) talking to `challenges.cloudflare.com`.

Result: a Turnstile outage cannot block legitimate developer signups.

## Observability

Every decision (allowed or denied, shadow or enforce) is written to
`security_audit_logs` with `action='turnstile_check'` and metadata:

```json
{
  "endpoint": "developer-register-app",
  "codes": ["..."],
  "shadow": true
}
```

Query during shadow-mode tuning:

```sql
SELECT decision, metadata->>'endpoint' AS endpoint, count(*)
FROM security_audit_logs
WHERE action = 'turnstile_check'
  AND created_at > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 3 DESC;
```

The existing realtime alert trigger on `security_audit_logs` will fire
`remittance_abuse_suspected`-style alerts if denied volume spikes — no
extra alerting code needed.

## Rollout

1. **Day 0** — code shipped (this PR). With no secrets set, runtime behaviour is unchanged.
2. **Day 1** — user creates Turnstile site at Cloudflare, sets `VITE_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`. `TURNSTILE_ENFORCE` stays unset.
3. **Day 1–7** — review `security_audit_logs` for false-positive rate. Target < 1%.
4. **Day 7+** — set `TURNSTILE_ENFORCE=true`. Rollback = unset the flag (no redeploy).

## Files

- `supabase/functions/_shared/turnstile.ts` — verifier + token extractor + audit logger
- `src/hooks/useTurnstile.ts` — React hook, lazy-loads CF script
- `src/components/security/TurnstileWidget.tsx` — mount point (no-op when disabled)
- `supabase/functions/developer-register-app/index.ts` — wired
- `supabase/functions/sandbox-create-account/index.ts` — wired
- `supabase/functions/sandbox-create-api-key/index.ts` — wired
- `src/pages/developer/DeveloperRegistration.tsx` — wired
- `src/pages/developer/Sandbox.tsx` — wired
- `src/pages/developer/SandboxConsole.tsx` — wired

## Not covered by this prototype (deliberate)

- Rate limiting — Turnstile is bot-shape detection, **not** volume control. Both are needed.
- Replacement of math captcha or Firebase reCAPTCHA — both stay in place.
- `/openapi.json` and any documented `/v1/*` REST path — unchanged. Standing Orders 1, 4, 6 satisfied.
