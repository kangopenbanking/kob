
# Production Readiness Plan — Merchant Module + KOB Platform

Scope is large. To stay safe and reviewable, work is split into **8 phases**, each ending in a checkpoint where you approve before I touch anything in the next phase. Phases 0–2 are **read-only discovery**; phases 3+ make changes only after your explicit `APPROVE` per finding.

## Guardrails (apply to every phase)
- Sandbox/test environment only; no production data mutations.
- All Standing Orders 1–10 + Docs Orders P1–P10 enforced.
- Direct Backend Mandate: edge calls hit `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1`.
- No schema renames/drops without version bump + your approval.
- Every fix ships with: diff, justification (cited standard), rollback steps.

---

## Phase 0 — Backend health & discovery (read-only)
- `cloud_status` Test + Live; confirm `ACTIVE_HEALTHY`.
- Inventory: merchant tables, RLS, `/merchant/*` routes, `gateway-merchant-*` + related edge functions.
- Endpoint coverage matrix vs `public/openapi.json` (Standing Order 1 lock check).
- Output: `MERCHANT_DISCOVERY.md` under `/mnt/documents/`.

## Phase 1 — Database & RLS audit (read-only)
- `supabase--linter` Test + Live.
- RLS coverage check on every `gateway_*` and `merchant_*` table.
- `SECURITY DEFINER` + `search_path = public` audit on all functions.
- GRANTs check (anon/authenticated/service_role) per public-schema mandate.
- Output: findings list — Critical/High/Medium/Low — with proposed migrations (not yet applied).

## Phase 2 — Edge function audit (read-only)
- For each merchant edge fn: JWT validation in code, CORS headers, Zod input validation, idempotency keys + row-level locks on financial mutations, error envelope (RFC 7807, 63-code catalog).
- Log scan (last 24h) for 4xx/5xx hotspots via `analytics_query`.
- Output: per-function score card.

## Phase 3 — UI & navigation audit (browser-driven)
- Browser walkthrough of every `/merchant/*` route at 1040×669 + mobile viewport.
- For each page: CTA click, form submit (happy + invalid), empty/error/loading states, network 200s, no console errors.
- Output: per-page pass/fail table with screenshots.

## Phase 4 — KOB API integration & webhooks
- End-to-end: KYB submit → admin approve → API key mint → charge → webhook delivery → settlement → statement export → payout.
- Webhook signature validation + replay protection.
- Pay-by-Bank intent → redirect → callback round-trip in sandbox.
- Mobile/PWA sync: `kob_pos_pay` QR bridge consumer↔merchant.

## Phase 5 — Security & pen-test pass
- OWASP Top 10 sweep on merchant surfaces (IDOR via `merchant_id` swap, SSRF in webhook URLs, XSS in storefront product fields, SQLi via RPC params, JWT tampering).
- Cross-merchant RLS isolation tests (Merchant A cannot read Merchant B rows).
- Secret hygiene: `fetch_secrets` audit, no secrets in client bundle, no plaintext keys at rest.
- `security--run_security_scan` + ignore-with-justification or fix.

## Phase 6 — Apply fixes (gated)
- Group findings into approval batches (Critical → High → Medium).
- For each batch: present diffs + rollback → wait for `APPROVE: <id>` → apply migration / edit / deploy → re-verify.
- Standing Order 6 version bumps applied where OpenAPI touched.

## Phase 7 — Production-readiness gates
- E2E suite (`e2e/authenticated/`) green, including the new `admin-email-send-test.spec.ts`.
- Deploy edge fns; verify with `curl_edge_functions`.
- Re-run `supabase--linter`; expect zero Critical/High.
- Sign artifacts (`openapi.json.sig`, postman, SDK READMEs).
- Final reports: `MERCHANT_FULL_AUDIT_REPORT.md` + `.json` in `/mnt/documents/`.

---

## What I need from you before starting Phase 0
1. **Authorization model** — confirm: read-only tools (DB selects, linter, logs, browser observe, `curl GET`) run without per-step approval; any write/migration/deploy waits for `APPROVE: <id>`.
2. **Priority flows for Phase 4** — pick top 3: (a) KYB onboarding, (b) API key lifecycle, (c) Charge→webhook→settlement, (d) Pay-by-Bank, (e) Payouts, (f) Staff RLS.
3. **Sandbox merchant account** — should I use an existing seeded merchant, or create one via the standard KYB flow at the start of Phase 4?
4. **Stop conditions** — pause and report if I find: (a) any unencrypted secret, (b) cross-tenant RLS leak, (c) missing webhook signature verification? Confirm Y/N.

Reply with answers + `START PHASE 0` to begin.
