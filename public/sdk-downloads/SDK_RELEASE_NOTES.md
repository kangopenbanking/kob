# Kang Open Banking — SDK release notes (v1.2.0 → v1.6.1)

Aligned to **OpenAPI v4.49.0** (2026-05-29). Published alongside the Phase 10/11
spec release. All three official SDKs (Node, PHP, Python) are pinned to **v1.6.1**
in lockstep with `KOB_SDK_VERSIONS` in `src/config/version.ts`.

> Verify your downloads against `https://kangopenbanking.com/SHA256SUMS.txt`
> (also exposed machine-readable at `/downloads-checksums.json`).

---

## v1.6.1 — Phase 11 (current, aligned to OpenAPI v4.49.0)

**Highlights**

- **Postman parity** — environments (sandbox + production) now prefill
  `base_url`, `api_key`, `webhook_secret`, `idempotency_key`,
  `accept_language`, `spec_url`, `spec_version`, `postman_import_url`,
  `key_issuer_url`, `merchant_id`. Matches the live `/postman/*` artifacts.
- **Per-version OpenAPI export** — `/developer/spec-versions` exposes JSON +
  YAML downloads for every ratchet. The SDK README links them so integrators
  can pin a specific contract.
- **Admin governance APIs** are now generated into the SDK type surface
  (`/v1/admin/webhooks/test`, `/v1/admin/api-keys`, `…/rotate`, `…/suspend`,
  `…/revoke`).
- **Ratchet coverage** — adds typings for the Phase 10.2–10.5 modules:
  USSD sessions, agent banking, QR + offline payments, CEMAC remittance.

**Standing Orders honoured**

- Order 1 (Lock): no `operationId`/path/schema renames.
- Order 2 (Ratchet): purely additive over v1.2.0; no removed methods.
- Order 6 (Version Gate): bumped in lockstep with OpenAPI minor `4.46.0 → 4.49.0`.
- Order P7 (Changelog Rule): public entry in `/changelog.json`.

## v1.6.0

Internal rollup leading to v1.6.1. Not separately published; integrators should
upgrade directly from 1.2.0 to 1.6.1.

## v1.5.x / 1.4.x / 1.3.x

Track API minor releases v4.30 – v4.46 (Phases 1–10.3). Additive only.
Method-level diffs are documented in the OpenAPI changelog at
`/developer/changelog`.

## v1.2.0 — Phase A (aligned to OpenAPI v4.29.3)

**Breaking inside `pisp.submitPayment` request shape**, additive at the API level.

`POST /v1/pisp/payment-submission` now requires the full payment instruction:

| Field             | Type        | Notes                                   |
| ----------------- | ----------- | --------------------------------------- |
| `payment_id`      | string      | Returned from `payments` create call.   |
| `consent_id`      | string      | PISP consent reference.                 |
| `amount`          | string      | Zero-decimal currencies (XAF, XOF).     |
| `currency`        | enum        | `XAF` / `XOF` / `EUR` / `USD`.          |
| `debtor_account`  | string      | 23-digit BEAC RIB.                      |
| `creditor_account`| string      | 23-digit BEAC RIB.                      |

Removed (legacy, never publicly documented): `instructed_amount`, `risk`.

Migration (Node):

```diff
- await kob.pisp.submitPayment({ instructed_amount: { amount: '50000', currency: 'XAF' }, risk: { ... } });
+ await kob.pisp.submitPayment({
+   payment_id: 'pay_…', consent_id: 'pisp_consent_…',
+   amount: '50000', currency: 'XAF',
+   debtor_account: '10005-00001-09876543210-45',
+   creditor_account: '10005-00001-12345678901-23',
+ }, { idempotencyKey: crypto.randomUUID() });
```

## v1.1.0

Baseline aligned to OpenAPI v4.28.x.

---

## Verifying a download

```bash
curl -sSO https://kangopenbanking.com/SHA256SUMS.txt
curl -sSO https://kangopenbanking.com/sdk-downloads/sdk-node-package.json
sha256sum -c SHA256SUMS.txt --ignore-missing
```

Or programmatically:

```bash
curl -s https://kangopenbanking.com/downloads-checksums.json \
  | jq '.artifacts[] | select(.url=="/sdk-downloads/sdk-node-package.json")'
```
