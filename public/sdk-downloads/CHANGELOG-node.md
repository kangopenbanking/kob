# @kang/openbanking-node — changelog

Pinned in lockstep with the OpenAPI SSOT (`KOB_SDK_VERSIONS.node`). Verify
your install with `https://kangopenbanking.com/SHA256SUMS.txt` and the
Ed25519 signature at `/sdk-downloads/sdk-node-package.json.sig`.

## 1.6.1 — 2026-05-29 · aligned to OpenAPI v4.49.0

**Additive**

- Type bindings for Phase 10.2–10.5 endpoints: `ussd.sessions`,
  `agents.{create,list,get,float,cashIn,cashOut}`, `gateway.qr.{create,scan}`,
  `gateway.offline.{issue,redeem}`, `remittance.cemac.{quote,transfer,cancel}`.
- Type bindings for Phase 11 admin governance:
  `admin.webhooks.test`, `admin.apiKeys.{create,list,rotate,suspend,revoke,usage}`.
- Postman environment helpers (`KangOpenBanking.helpers.postmanEnv`) for
  sandbox + production with the same variables shipped in the Postman environments.
- `kob.spec.versions()` returns ratchet-pinned JSON + YAML download URLs.

**Fixed**

- Restored typed `Idempotency-Key` requirement on all PISP, agent float, and
  remittance write operations.

## 1.5.0 → 1.3.0

Rolled into 1.6.1 — never separately published. Diffs in
`/developer/changelog` and `/openapi-history/manifest.json`.

## 1.2.0 — 2026-05-04 · aligned to OpenAPI v4.29.3

**Breaking inside `pisp.submitPayment` request body** (additive at the wire level):

```diff
- await kob.pisp.submitPayment({ instructed_amount: { amount: '50000', currency: 'XAF' }, risk: {...} });
+ await kob.pisp.submitPayment({
+   payment_id, consent_id, amount: '50000', currency: 'XAF',
+   debtor_account: '10005-00001-09876543210-45',
+   creditor_account: '10005-00001-12345678901-23',
+ }, { idempotencyKey: crypto.randomUUID() });
```

Removed (legacy, never publicly documented): `instructed_amount`, `risk`.

## 1.1.0 — 2026-04-26

Baseline aligned to OpenAPI v4.28.x.
