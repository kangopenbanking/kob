## KOB Merchant QR Acceptance for External Virtual Card Apps — v4.31.0

Lets third-party virtual-card issuers (a) discover KOB merchants and their EMVCo MPQR payloads, (b) decode any scanned EMVCo QR, and (c) push a card-funded payment through the existing PISP rail using their own client-credentials token.

Fully additive — no operationId, schema, or path renames (Standing Orders 1, 2, 4).

---

### 1. Database (one new migration)
- New table `partner_card_tokens` (no PAN — `network_token` + `last4` only). RLS: admin-read.
- Extend `qr_card_payments`:
  - new columns `source` (`user`/`partner`), `partner_client_id`, `partner_cardholder_ref`, `partner_card_token_id`
  - `virtual_card_id` becomes nullable (partner-mode rows debit a token instead).
- New public view `merchant_qr_directory` over `gateway_merchants` (active + KYB-approved only). `grant select to anon, authenticated`.
- Refresh `admin_qr_payments_audit` view + `get_admin_qr_payments_audit()` RPC to expose new partner columns.

### 2. New edge functions
- `merchants-qr-directory` (GET) — paginated public list (`country`, `category`, `cursor`, `limit`).
- `merchants-qr-get` (GET) — returns merchant info + a freshly built EMVCo MPQR payload for `{id}` (static or dynamic when `?amount=…&ref=…`).

### 3. Update `qr-initiate-payment`
- Detect auth mode: user JWT (existing) **or** `client_credentials` access token (new).
- Partner mode requires:
  - scope `payments:qr` on the access token,
  - header `X-Partner-Cardholder-Ref`,
  - body `partner_card_token_id` + `auth_evidence` (partner-attested SCA per PSD2 RTS Art. 18) instead of `virtual_card_id` + `pin_token`.
- Add error codes:
  - `QR_007` 403 missing `payments:qr` scope
  - `QR_008` 404 partner card token unknown/revoked
  - `QR_009` 412 SCA evidence missing/expired

### 4. Documentation (Orders P5/P6/P9/P10)
- Bump SSOT `src/config/version.ts` → `4.31.0`.
- `public/openapi.json` + `.yaml` add operations `merchantsQrDirectoryList`, `merchantsQrGet`, partner-mode parameters on `paymentsQrInitiate`. New error codes documented.
- New `docs/governance/CHANGELOG-v4.31.0.md`.
- Prepend entry in `public/changelog.json` + `public/CHANGELOG.md` + root `CHANGELOG.md`.
- New `docs/developer-portal/payments/qr-merchant-directory.md` (cURL + Node + Python + PHP).
- Update `docs/developer-portal/payments/qr-initiate.md` with partner-mode section.
- Regenerate `public/postman/Kang_Open_Banking_API_latest.postman_collection.json`.

### 5. SDK additions (Node / Python / PHP)
- New `qr` namespace exposing `directory.list()`, `merchant.get(id)`, `payments.initiate(input)`.

### 6. Admin & UX
- `src/pages/admin/QRPaymentsAudit.tsx` adds **Source** column (`user` / `partner:<client_id>`).

### 7. Tests
- Vitest fixtures for directory pagination + merchant QR generation.
- New Deno test in `qr-initiate-payment` exercising partner-mode auth branch.
- New Playwright spec `e2e/authenticated/qr-partner-flow.spec.ts`.

### Compliance citations
- EMVCo MPM v1.1 §4 + §6 · ISO 4217 / 18245 / 3166-1 · PSD2 RTS Art. 18 + 36(1)(b) · FAPI 1.0 Adv §5.2.2 · RFC 7807 · PCI DSS v4.0 §3.4.

### Out of scope
- Storing real PANs (network tokens only).
- Visa/MC card-network certification (partner responsibility).
- Any modification of existing operationIds, paths, or schemas.

Approve to switch to build mode and implement all of the above.