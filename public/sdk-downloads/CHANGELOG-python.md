# kangopenbanking (Python) — changelog

Pinned in lockstep with the OpenAPI SSOT (`KOB_SDK_VERSIONS.python`). Verify
your install with `https://kangopenbanking.com/SHA256SUMS.txt` and the
Ed25519 signature at `/sdk-downloads/sdk-python-pyproject.toml.sig`.

## 1.6.1 — 2026-05-29 · aligned to OpenAPI v4.49.0

**Additive**

- Modules for Phase 10.2–10.5: `kob.ussd`, `kob.agents`, `kob.gateway.qr`,
  `kob.gateway.offline`, `kob.remittance.cemac`.
- Modules for Phase 11 admin governance: `kob.admin.webhooks.test()`,
  `kob.admin.api_keys.{create, list, rotate, suspend, revoke, usage}`.
- Typed dataclasses regenerated against OpenAPI 4.49.0; `py.typed` shipped.

**Fixed**

- Async context manager now closes the underlying `httpx.AsyncClient` on
  exception paths (was leaking on 5xx retries).

## 1.5.x – 1.3.x

Rolled into 1.6.1 — never separately published.

## 1.2.0 — 2026-05-04 · aligned to OpenAPI v4.29.3

`submit_payment` now requires `payment_id`, `consent_id`, `amount`, `currency`,
`debtor_account`, `creditor_account`. Legacy `instructed_amount` / `risk`
removed.

```diff
- kob.pisp.submit_payment(instructed_amount={"amount":"50000","currency":"XAF"}, risk={...})
+ kob.pisp.submit_payment(
+   payment_id="pay_...", consent_id="pisp_consent_...",
+   amount="50000", currency="XAF",
+   debtor_account="10005-00001-09876543210-45",
+   creditor_account="10005-00001-12345678901-23",
+   idempotency_key=str(uuid.uuid4()),
+ )
```

## 1.1.0 — 2026-04-26

Baseline aligned to OpenAPI v4.28.x.
