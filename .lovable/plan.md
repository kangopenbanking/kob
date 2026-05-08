## Goal

Re-engineer the Virtual Card feature so that **Banks/Financial Institutions and Developers** can issue and manage USD virtual cards for their customers via the **Kora (Korapay) Issue Virtual Cards API** as the underlying middleware, exposed through the Kang Open Banking API. Add full admin oversight, a bank/developer management console, end-to-end tests, and public documentation + changelog refresh.

Reference: [https://developers.korapay.com/docs/issue-virtual-cards](https://developers.korapay.com/docs/issue-virtual-cards)  
                       [https://developers.korapay.com/docs/getting-started](https://developers.korapay.com/docs/getting-started)  
                      

---

## Scope & Access Model

- Cardholders are **end customers of a bank or developer tenant** (not direct Kang consumers).
- **Permitted issuers**: users with role `bank_admin`/`bank_staff` (scoped via `accounts.institution_id`) and `developer` (scoped via API key → tenant). Consumer self-service issuance is removed from the public PWA.
- **Admin** has full oversight: programs, KYC gating, balance/limits, suspend/terminate, audit, FX, fee config.
- All state-changing card operations must be **server-mediated via Edge Functions** with `idempotency_key` and `FOR UPDATE` row locks (per Financial Safety memory).

---

## Phase 1 — Discovery & Baseline (read-only)

1. Inventory current Cardyfie/Stripe-Issuing surfaces:
  - DB: `virtual_cards`, `virtual_card_programs`, `card_transactions`, `card_funding_transactions`, `stripe_cardholders`, `qr_card_payments`.
  - Edge: `supabase/functions/virtual-cards/index.ts` (267 lines, Cardyfie-based).
  - Frontend: `src/pages/VirtualCards.tsx`, `src/components/virtual-cards/*`.
2. Map gaps vs Kora API: cardholder creation, card issuance (USD), fund/withdraw, freeze/unfreeze, terminate, retrieve card, transactions, webhooks (`virtualcard.charge`, `virtualcard.refund`, `virtualcard.decline`, `virtualcard.termination`).
3. Capture baseline in `docs/virtual-cards/baseline-audit.md`.

## Phase 2 — Database Migrations (additive, ratchet rule)

New / extended tables:

- `virtual_card_programs`: add `issuer_provider` (enum: `kora`, `cardyfie_legacy`), `tenant_type` (`bank`|`developer`), `tenant_id`, `currency` default `USD`, `kyc_required_level`, `default_daily_limit`, `default_monthly_limit`, `auto_topup_enabled`.
- `virtual_cards`: add `kora_card_id`, `kora_cardholder_id`, `provider` (enum), `tenant_id`, `tenant_type`, `customer_external_id`, `issued_by_user_id`, `frozen_at`, `terminated_at`. Keep `stripe_card_id` nullable for legacy.
- New `kora_cardholders` (mirrors stripe_cardholders) with KYC status, doc refs.
- New `virtual_card_webhook_events` (provider, event_type, payload, signature_verified, processed_at, idempotency_key UNIQUE).
- New `virtual_card_audit_log` (actor, action, before/after JSON, ip, ua).
- Triggers: validation trigger ensuring `tenant_id` matches issuer's institution; `update_updated_at` triggers.
- RLS:
  - Bank staff: `tenant_type='bank' AND tenant_id = resolveInstitutionId(auth.uid())`.
  - Developer: `tenant_type='developer' AND tenant_id = current_developer_tenant()`.
  - Admin via `has_role(auth.uid(),'admin')`.
  - End-customer view via signed token only (no direct RLS read).
- All new SECURITY DEFINER functions: `SET search_path = public`.

## Phase 3 — Kora Middleware Layer (Edge Functions)

Create `supabase/functions/_shared/kora-client.ts`:

- `koraRequest(method, path, body, idempotencyKey)` with HMAC signing per Kora docs, retries, 429 backoff, structured error mapping → RFC 7807 codes.
- Webhook signature verification (`x-korapay-signature`, HMAC-SHA256 of raw body).

New consolidated function `virtual-cards-v2` (replaces inline Cardyfie calls). Actions:

- `create-program` (admin)
- `create-cardholder` (bank/dev) — KYC payload
- `issue-card` — POST `/virtual-cards`
- `fund-card` / `withdraw-from-card` — atomic ledger debit + Kora call inside DB transaction
- `freeze` / `unfreeze` / `terminate`
- `get-card` (returns masked PAN, last4, exp; full PAN only via short-lived signed reveal endpoint)
- `list-transactions` — paginated from Kora with local cache
- `reveal-card` — issues a 60s signed URL with step-up MFA (per MFA memory)

New `kora-webhook` function (verify_jwt=false; signature verified in code; fail-closed; idempotent on `event.id`). Updates ledger, status, emits Realtime event for UI.

New `virtual-cards-admin` function for admin-only ops (force-terminate, refund, reissue, override limits).

## Phase 4 — Tenant Resolution & Auth

- Reuse `resolveInstitutionId` (Staff Privacy memory) for bank scoping.
- Developer tenant resolved via `kob_api_keys` JWT claims (per API Client Governance memory).
- Step-up MFA required for: reveal PAN, terminate, fund > threshold, withdraw.
- All financial mutations use `idempotency_key` (UUID v4) and `FOR UPDATE` locks.

## Phase 5 — Public REST API (OpenAPI v4 → v5 minor bump)

Add under `/v1/issuing/`:

- `POST /cardholders`, `GET /cardholders/{id}`
- `POST /cards`, `GET /cards`, `GET /cards/{id}`
- `POST /cards/{id}/fund`, `POST /cards/{id}/withdraw`
- `POST /cards/{id}/freeze`, `POST /cards/{id}/unfreeze`, `POST /cards/{id}/terminate`
- `GET /cards/{id}/transactions`
- `POST /cards/{id}/reveal` (step-up)
- Webhook event docs: `card.issued`, `card.charged`, `card.refunded`, `card.declined`, `card.terminated`.

Compliance with Standing Orders 1–10:

- Bump `info.version` minor (additive, e.g. 4.31.0 → 4.32.0).
- New schemas referenced; no dead components.
- Cite ISO 8583 + PCI-DSS scope reduction notes in `description`.
- 63 RFC 7807 error codes maintained; add `card_kyc_required`, `card_insufficient_funds`, `card_provider_unavailable`, `card_terminated`.

## Phase 6 — Frontend

### Bank/Developer Management Console (`/bank/issuing` and `/developer/issuing`)

- Dashboard: cards issued, active, frozen, monthly spend, decline rate.
- Programs tab (read-only for bank, request changes via admin workflow).
- Cardholders list + KYC status + create.
- Cards list with filters; card detail drawer (mask PAN, freeze/unfreeze, terminate, fund, withdraw, transactions, audit).
- Webhook delivery viewer (read-only).
- Built with existing shadcn/Tailwind tokens, Lucide outline icons, no gradients/emojis.

### Admin Console (`/admin/issuing`)

- Programs CRUD, provider toggle (kora/cardyfie_legacy), tenant assignment.
- Global card search, force actions, refund, audit log viewer.
- Provider health (`virtual-cards-health` preflight: Kora reachability, signature key present, webhook last-seen).
- FX & fee configuration per program.

### Removals / Migrations

- Hide `/virtual-cards` consumer route behind feature flag (kept for legacy data view only).
- Replace Cardyfie program selector with Kora-aware programs.

## Phase 7 — Documentation & Changelog (Public)

- New `/developer/docs/issuing` section with: overview, KYC flow, lifecycle diagram (ASCII), code examples in cURL/Node/Python (+PHP/Java/Go for quickstart) per Order P9.
- Working sandbox examples seeded against Kora sandbox (Order P5). Smoke test added.
- Update `/openapi.json` + `/openapi.yaml` (public, ungated — Order P4).
- Update Postman collections (sandbox + production).
- Changelog entry `docs/governance/CHANGELOG-v4.32.0.md` within 48h (Order P7).
- Standards Index entry under `/developer/standards`.
- 301 redirect any old `/docs/virtual-cards` URL (Order P2).

## Phase 8 — End-to-End Testing

Vitest unit tests:

- `kora-client.test.ts` — signing, retry, error mapping.
- `virtual-cards-v2.test.ts` — RBAC, idempotency, ledger atomicity.
- `kora-webhook.test.ts` — signature verify, replay protection.

Playwright E2E (`e2e/authenticated/issuing-bank-flow.spec.ts`, `issuing-developer-flow.spec.ts`, `issuing-admin-flow.spec.ts`):

1. Bank staff creates cardholder → issues card → funds → simulates Kora charge webhook → sees txn → freezes → terminates.
2. Developer issues via API key (sandbox) → asserts webhook delivered.
3. Admin force-terminates and refunds; audit log entry visible.
4. Reveal-PAN flow gated by step-up MFA.
5. Negative paths: insufficient KYC, insufficient funds, frozen card decline.

CI:

- Add `.github/workflows/issuing-e2e.yml` running preflight (env keys present) + Playwright suite against sandbox.
- Extend `direct-backend-guard.test.ts` to cover new endpoints.
- Add `kora-preflight.mjs` script (mirrors `firebase-otp-preflight.mjs`).

## Phase 9 — Secrets & Config

Required (will request via `add_secret` once plan approved):

- `KORA_PUBLIC_KEY`, `KORA_SECRET_KEY`, `KORA_ENCRYPTION_KEY`, `KORA_WEBHOOK_SECRET`, `KORA_BASE_URL` (sandbox vs live per env).

## Phase 10 — Rollout

1. Deploy migrations (Test) → seed Kora sandbox program.
2. Run full E2E green.
3. Publish docs + changelog.
4. Feature-flag `issuing.kora_enabled` per environment via existing admin settings pattern.
5. Publish to Live; monitor `virtual_card_webhook_events` and provider health page for 48h.

---

## Technical Notes

- Kora returns card details in clear text only at creation; we store **only** `last4`, `brand`, `exp_month/year`, `kora_card_id`. Full PAN/CVV is **never persisted** — fetched on demand via reveal endpoint with short-lived token.
- Currency: USD only at launch; FX from XAF/XOF wallet uses existing FX engine (zero-decimal currency memory).
- Ledger entries tagged `card_fund`, `card_withdraw`, `card_charge`, `card_refund`, `card_fee` for reconciliation.
- All admin destructive actions go through maker-checker (Banking Risk Operations memory).

## Deliverables Checklist

- Migrations + RLS
- `kora-client.ts`, `virtual-cards-v2`, `kora-webhook`, `virtual-cards-admin`, `virtual-cards-health`
- Bank/Developer/Admin UIs
- OpenAPI v4.32.0 + Postman + SDK regen
- Public docs + changelog + standards index
- Vitest + Playwright suites + CI workflow
- Preflight script
- Secrets requested