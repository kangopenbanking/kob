# Card Issuing v3 — Nium-first, Kora-fallback

Rebuild the virtual/digital/physical card issuing stack so Nium is the default provider (aligned with https://docs.nium.com/docs/cards), Kora remains a resilient fallback, and the capability is exposed uniformly through the Kang Open Banking API, developer docs, homepage, and the Consumer PWA.

## Goals
- Nium becomes the primary issuer for **Virtual**, **Digital (tokenized/wallet)**, and **Physical** cards.
- Kora stays wired as an automatic fallback when Nium is unavailable or a program is Kora-only.
- One consistent card domain surface for banks, developers, and consumers — no split brains.
- Public docs, OpenAPI, SDKs, changelog, homepage section, and Consumer PWA all updated in the same version bump.
- Full E2E audit + light pen-test pass, no regressions to existing Nium global accounts, PTP, KYC, or ledger modules.

## Scope map (surgical, additive first — Standing Orders 1, 2, 4, 6)

### 1. Backend — provider abstraction
- New `supabase/functions/_shared/card-issuer.ts` — thin router with `issueVirtual`, `issueDigital`, `issuePhysical`, `getCard`, `freeze`, `unfreeze`, `terminate`, `setLimits`, `reveal` (PAN/CVV via secure ephemeral token), `provisionToWallet` (Apple/Google Pay push provisioning payload).
- Extend `_shared/nium-client.ts` with Nium Cards endpoints (create cardholder, issue card, controls, 3DS OTP, tokenization, transactions webhook parsing).
- Keep `_shared/kora-client.ts` untouched; use as fallback path.
- Provider selection order: `NIUM` (default) → `KORA` (fallback) → hard fail with RFC 7807. Selection is per-tenant and per-program, overridable by admin.

### 2. Edge functions (new + refactor)
- `cards-v3` — canonical CRUD + lifecycle (replaces `virtual-cards-v2` for new traffic; v2 kept read-only for 1 minor version per Standing Order 1).
- `cards-v3-reveal` — separate function, stricter auth + step-up MFA required, short-TTL response.
- `cards-v3-webhook` — accepts Nium **and** Kora card events, normalized to one internal event schema, HMAC verified, replay-safe (reuses `nium_webhook_audit` pattern).
- `cards-v3-provision` — Apple/Google Pay push-provisioning payload signing.
- Idempotency keys mandatory on all mutating routes.

### 3. Database (migration, additive)
- `card_programs` (tenant_id, provider enum `nium|kora`, brand, currency default XAF, bin_range, physical_enabled, digital_enabled).
- `cards` extended: `provider`, `provider_card_id`, `form_factor` (`virtual|digital|physical`), `wallet_tokens[]`, `spend_controls jsonb`, `state`, `last4`, `expiry_masked`.
- `card_events` audit table.
- `card_shipments` for physical (address, courier, tracking, status).
- All tables: RLS + `GRANT` per project rules; `has_role()` for admin overrides.

### 4. OpenAPI + SDKs + Postman (Standing Orders 3, 5, 6, 7)
- Bump `info.version` minor (v4.52.x → v4.53.0 — new endpoints only, no breaking removals).
- Add `/v1/cards`, `/v1/cards/{id}`, `/v1/cards/{id}/freeze|unfreeze|terminate|limits|reveal|provision`, `/v1/cards/webhooks` schemas.
- Add `CardProgram`, `Card`, `CardEvent`, `SpendControl`, `WalletToken`, `PhysicalShipment` components (each referenced — no dead components).
- Regenerate Node/Python/PHP SDKs (`packages/sdk-*`), Postman collection + sig files, snapshot history under `public/openapi-history/`.
- `public/changelog.json` + `docs/governance/CHANGELOG-v4.53.0.md` (within 48h rule).

### 5. Developer docs (Orders P1, P4, P5, P6, P9)
- New pages under `/developer/guides/`:
  - `card-issuing-overview` (Nium default, Kora fallback, provider matrix, compliance summary from Nium docs — BIN sponsorship, PCI DSS scope, 3DS, tokenization).
  - `issue-virtual-card`, `issue-physical-card`, `digital-wallet-provisioning`, `card-webhooks`, `card-controls-and-limits`.
- Multi-language snippets: cURL, Node, Python (+ PHP/Java/Go on quickstart).
- Standards Index + StandardsComplianceRow updated with card scheme + PCI references.

### 6. Homepage
- New "Card Issuing" section on `src/pages/Index.tsx` (or existing home composition) matching the interactive-image style already used for Global Accounts / Open Banking sections. Copy focused on: Virtual in seconds, Physical worldwide, Apple/Google Pay, PCI-DSS scope reduction via Nium, XAF default.

### 7. Consumer PWA (mobile-first, no noise)
- Refactor `/app/cards` (`CustomerCards.tsx`) to Nium-backed flow:
  - Empty state → "Get your card" CTA.
  - Card carousel (virtual, digital, physical) with freeze, reveal (step-up PIN), controls, transactions.
  - "Add to Apple Wallet" / "Add to Google Pay" buttons (push-provisioning payload).
  - Physical card order flow: address confirm → shipping → tracking.
  - "How cards work" `HowItWorksFlow` guide above hero, matching Global Accounts pattern.
  - FAQ moved to `/app/help` under new "Cards" category.
- Bank-side (`BankIssuingPage`) and Developer-side (`DeveloperIssuingPage`) consoles updated to show provider column + fallback status.

### 8. Compliance & security
- PCI scope note: PAN/CVV never touch our DB — Nium-hosted iframe or reveal-token pattern only.
- Step-up MFA (existing `step-up` module) mandatory for `reveal`, `terminate`, `limits > threshold`.
- Financial mutation lockdown: all card writes go through edge functions; no client-side writes.
- BEAC PoP whitelist untouched; card cross-border spend documented as retail, not payout.

### 9. E2E + pen-test
- New GitHub workflow `.github/workflows/card-issuing-e2e.yml` running:
  - Nium sandbox happy path (issue → fund → transaction webhook → freeze → terminate).
  - Kora fallback path (force `NIUM_DISABLED=true`).
  - Webhook signature negative tests (wrong HMAC, replay, malformed).
  - Reveal without step-up → 401; with step-up → 200 short-lived.
  - RLS negative tests (bank A cannot read bank B cards).
  - Idempotency replay (same key twice → single card).
- Playwright smoke on `/app/cards`, `/bank/:id/issuing`, `/developer/guides/card-issuing-overview`.
- Light pen test: authz matrix, IDOR on `/v1/cards/{id}`, rate-limit headers, PAN never in logs (grep guard in CI).

### 10. Rollout
- Feature flag `cards_v3_enabled` per tenant; default ON for new tenants, opt-in migration for existing.
- Legacy `virtual-cards-v2` retained read-only for one minor version, then deprecated with `x-maturity: deprecated` in spec.

## Deliverables checklist
- [ ] Migration + RLS + GRANTs
- [ ] `_shared/card-issuer.ts` + Nium card client extension
- [ ] `cards-v3`, `cards-v3-reveal`, `cards-v3-webhook`, `cards-v3-provision` edge functions
- [ ] OpenAPI v4.53.0 + SDKs + Postman + changelog
- [ ] 6 new developer doc pages with working sandbox examples
- [ ] Homepage Card Issuing section
- [ ] Consumer PWA `/app/cards` rebuild + Bank/Dev console updates
- [ ] `card-issuing-e2e.yml` workflow + Playwright smoke
- [ ] Memory update: new `mem://features/card-issuing-nium-primary` note

## Open decisions I need from you before building

1. **Nium card program credentials** — do you already have a Nium **cards** sandbox program (separate from the wallets/global-accounts credentials), or should I scaffold the code + doc for the program IDs and you'll add the secrets after (`NIUM_CARD_PROGRAM_ID`, BIN, funding account)?
2. **Physical card fulfilment scope** — enable physical ordering in this release, or ship Virtual + Digital first and gate Physical behind a follow-up flag?
3. **Consumer eligibility** — allow all KYC-verified consumers to self-issue a virtual card, or restrict to consumers whose institution has opted in?
4. **Legacy `virtual-cards-v2`** — keep read-only for one minor version (recommended, safest), or hard-cutover with a data migration into `cards_v3`?
