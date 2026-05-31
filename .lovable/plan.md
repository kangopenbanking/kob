# Cloudflare Turnstile Prototype — Gate Developer Sandbox & Public Key Issuance

## Why Turnstile (vs ALTCHA / math captcha)
- **Invisible by default**, falls back to a managed challenge only when behavioural signals look bot-like — zero friction for legitimate developers.
- Free, no data sent to Google; site key is publishable, secret key stored server-side.
- 2-line drop-in `<Turnstile />` React component + a single `siteverify` call from the edge function.
- Token is **one-shot** (server-validated and consumed), which fits perfectly with one-time actions like "create sandbox account" or "mint API key".

## Scope (deliberately narrow — defense-in-depth, not authentication)

Turnstile is added **only** to the pre-auth and one-shot endpoints that cost us money or create durable records:

| Endpoint / Surface | Why it needs a bot gate |
|---|---|
| `developer-register-app` | One-shot app registration — scripted abuse pollutes `developer_apps` and burns rate-limit quota |
| `sandbox-create-account` | Creates `developer_sandbox_accounts` + seeds XAF test data — expensive write path |
| `sandbox-create-api-key` | Mints `sbx_` keys — abuse = key flooding, exhausts tier limits |
| `/developer/register` form (UI) | Public-facing signup; primary scripted-abuse vector |
| `/developer/sandbox` "Generate sandbox key" button | Public-facing one-click key issuance |

**Explicitly NOT touched** (out of scope, would hurt UX or break contracts):
- `api-keys-create`, `api-keys-rotate`, `api-keys-revoke` — these are admin/merchant operations behind RBAC; rate-limits already cover them.
- Any `/v1/*` REST endpoint in OpenAPI — Standing Order 1 (THE LOCK) forbids adding new required headers to versioned operations.
- Phone OTP flow — already gated by Firebase reCAPTCHA v2 Invisible + math captcha (separate decision).
- Authenticated app actions, payments, transfers — wrong layer; rate limits + SCA are the right controls.

## Architecture

```text
Browser                          Edge Function
-------                          -------------
<Turnstile siteKey>  ──token──▶  developer-register-app
                                      │
                                      ▼
                                 turnstile-verify (shared helper)
                                      │
                                      ▼
                                 https://challenges.cloudflare.com/
                                   turnstile/v0/siteverify
                                      │
                                      ▼
                                 success ──▶ continue
                                 fail    ──▶ 403 turnstile_failed
```

## Implementation — Prototype (additive, default OFF behind a flag)

### 1. Shared verifier
**New** `supabase/functions/_shared/turnstile.ts`
```ts
export async function verifyTurnstile(token: string, ip?: string): Promise<{ok: boolean; codes: string[]}> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return { ok: true, codes: ['turnstile_disabled'] }; // soft-off when not configured
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const j = await r.json();
  return { ok: !!j.success, codes: j['error-codes'] || [] };
}
```
**Fail-open when secret unset** = safe rollout: prototype can ship before user adds the secret.

### 2. Wire into 3 edge functions (early-return pattern)
At the top of each handler (after CORS, before body work):
```ts
const token = req.headers.get('x-turnstile-token') || (await req.clone().json()).turnstile_token;
const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0];
const flag = Deno.env.get('TURNSTILE_ENFORCE') === 'true';
if (flag) {
  const v = await verifyTurnstile(token || '', ip);
  if (!v.ok) return json({ error: 'turnstile_failed', codes: v.codes }, 403);
}
```
`TURNSTILE_ENFORCE` env flag lets us flip per-environment without redeploys.

Functions updated:
- `supabase/functions/developer-register-app/index.ts`
- `supabase/functions/sandbox-create-account/index.ts`
- `supabase/functions/sandbox-create-api-key/index.ts`

All three already require a logged-in user — Turnstile is a **second** layer, not a replacement for the JWT check.

### 3. Frontend widget
**New** `src/components/security/TurnstileWidget.tsx`
- Lazy-loads `https://challenges.cloudflare.com/turnstile/v0/api.js` once.
- Renders an invisible `<div>` with `data-sitekey={VITE_TURNSTILE_SITE_KEY}`, `data-callback`, theme = `auto`.
- Exposes `useTurnstile()` hook returning `{ token, reset, getToken }`.
- If `VITE_TURNSTILE_SITE_KEY` is unset, hook returns `{ token: null }` and pages render normally — **prototype works with or without the key configured**.

### 4. Wire widget into 2 UI surfaces
- `src/pages/developer/DeveloperRegistration.tsx` — call `getToken()` in the submit handler, pass `turnstile_token` in body to `developer-register-app`.
- `src/pages/developer/Sandbox.tsx` (and/or `SandboxConsole.tsx`) — same pattern for the "Create sandbox account" and "Generate API key" buttons.

### 5. Audit logging
Log every Turnstile decision to existing `security_audit_logs`:
- `action: 'turnstile_check'`
- `decision: 'allowed' | 'denied'`
- `metadata: { codes, endpoint, ip_hash }`

Lets us see, in the existing admin security console, whether Turnstile is silently blocking real users before we ratchet enforcement on.

### 6. Admin observability
Tiny addition to `src/pages/admin/AdminRemittanceSecurity.tsx` filter dropdown (or its sibling) so admins can filter by `action = turnstile_check`. No new page — reuses existing infrastructure.

## Secrets needed (will request after approval)

| Name | Where | Notes |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | Lovable Cloud secrets (runtime) | From Cloudflare dashboard → Turnstile → site → Secret key |
| `VITE_TURNSTILE_SITE_KEY` | `.env` (publishable, safe in client) | Same dashboard, "Site key" |
| `TURNSTILE_ENFORCE` | Lovable Cloud secrets | `'true'` to enforce, anything else = log-only (shadow mode) |

User creates a free Cloudflare Turnstile site for `kob.lovable.app`, `info.kangfintechsolutions.com`, `kangopenbanking.com`, plus preview/dev hostnames — same domain list pattern as Firebase Authorized domains.

## Rollout plan (no breakage)

1. **Ship code with `TURNSTILE_ENFORCE=false`** — widget renders, token sent, edge function verifies but **never blocks**; only logs. Shadow mode for 3–7 days.
2. **Review `security_audit_logs`** — confirm false-positive rate < 1% on real signups.
3. **Flip `TURNSTILE_ENFORCE=true`** in dev → preview → production, one environment at a time.
4. **Rollback** = flip the env flag back to `false`. No code redeploy needed.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cloudflare Turnstile outage blocks signups | `verifyTurnstile` returns `{ok:true}` on 5xx from CF after 3s timeout — fail-open |
| Widget script blocked by user's adblocker | `useTurnstile()` returns null token → edge function (in `ENFORCE=false` mode) lets through → in `ENFORCE=true` mode shows a fallback message + math-captcha fallback path |
| Site-key/domain mismatch on new preview URLs | Domain registry doc updated alongside Firebase authorized-domains list |
| OpenAPI contract drift | Zero — Turnstile lives only on internal `/functions/v1/*` endpoints, **not** on any documented `/v1/*` REST path. No spec change, Standing Orders 1, 4, 6 satisfied. |

## What this prototype does NOT do

- Does **not** add Turnstile to authenticated payment/transfer/SCA flows (wrong layer).
- Does **not** remove or change any existing captcha (math captcha + Firebase reCAPTCHA stay).
- Does **not** modify `/openapi.json`, `/v1/*` endpoints, or any developer-portal public route.
- Does **not** replace rate-limiting — Turnstile is bot-shape detection, rate limits are volume control. Both are needed.

## Files to create
- `supabase/functions/_shared/turnstile.ts`
- `src/components/security/TurnstileWidget.tsx`
- `src/hooks/useTurnstile.ts`

## Files to edit (small, additive)
- `supabase/functions/developer-register-app/index.ts`
- `supabase/functions/sandbox-create-account/index.ts`
- `supabase/functions/sandbox-create-api-key/index.ts`
- `src/pages/developer/DeveloperRegistration.tsx`
- `src/pages/developer/Sandbox.tsx` (and `SandboxConsole.tsx` if it has its own button)
- `src/pages/admin/AdminRemittanceSecurity.tsx` — add `turnstile_check` filter option
- `docs/identity/security-posture.md` — document the new gate

## One decision for you before I implement

Approve any of:
1. **Ship the full prototype as scoped above** (5 surfaces, shadow-mode default).
2. **Narrower** — Turnstile only on `/developer/register` + `developer-register-app` to prove the pattern, expand later.
3. **Configure secrets first** — I draft the Cloudflare setup checklist, you create the Turnstile site and add the secrets, then I implement.
