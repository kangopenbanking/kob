# kang/openbanking-php — changelog

Pinned in lockstep with the OpenAPI SSOT (`KOB_SDK_VERSIONS.php`). Verify
your install with `https://kangopenbanking.com/SHA256SUMS.txt` and the
Ed25519 signature at `/sdk-downloads/sdk-php-composer.json.sig`.

## 1.6.1 — 2026-05-29 · aligned to OpenAPI v4.49.0

**Additive**

- Resources for Phase 10.2–10.5: `Ussd`, `Agents`, `GatewayQr`, `Offline`,
  `RemittanceCemac`. Idiomatic Laravel facade entries (`KOB::agents()`, …).
- Resources for Phase 11 admin governance: `Admin\Webhooks`, `Admin\ApiKeys`
  with `create / rotate / suspend / revoke / usage` methods.
- Postman environment scaffolds at `config/kob-postman.php` matching the
  sandbox + production downloads.

**Fixed**

- `VerifyWebhookSignature` middleware reads `x-kob-signature` case-insensitively
  to match new admin send-test-webhook deliveries.

## 1.5.x – 1.3.x

Rolled into 1.6.1 — never separately published.

## 1.2.0 — 2026-05-04 · aligned to OpenAPI v4.29.3

`submitPayment` now requires `payment_id`, `consent_id`, `amount`, `currency`,
`debtor_account`, `creditor_account`. Legacy `instructed_amount` / `risk`
removed. See `public/sdk-downloads/SDK_RELEASE_NOTES.md` for the migration diff.

## 1.1.0 — 2026-04-26

Baseline aligned to OpenAPI v4.28.x.
