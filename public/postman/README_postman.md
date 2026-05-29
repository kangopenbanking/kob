# Kang Open Banking — Postman bundle

This folder ships ready-to-import Postman artifacts for the Kang Open Banking API.

## Files

| File | What it is |
|---|---|
| `Kang_Open_Banking_API_latest.postman_collection.json` | Collection pinned to the latest released spec (currently v4.49.0). |
| `Kang_Open_Banking_API_v<version>.postman_collection.json` | Per-version snapshot of the collection. |
| `Kang_Open_Banking_Sandbox.postman_environment.json` | Sandbox environment (base URL, test key placeholder, test webhook secret). |
| `Kang_Open_Banking_Production.postman_environment.json` | Production environment (live base URL, live key placeholder, live webhook secret). |
| `manifest.json` | Machine-readable index of all collections + versions. |

## Quick start

1. Open Postman → **Import**.
2. Drop both `*.postman_collection.json` (latest or version-pinned) and **both** environment files.
3. Switch the environment selector (top right) to **Kang Open Banking — Sandbox**.
4. Replace `api_key` with the value obtained from <https://kangopenbanking.com/developer/keys>
   (Sandbox) or `/admin/institution-api-keys` (Production).
5. Replace `webhook_secret` with the signing secret from your webhook endpoint configuration.
6. Send the **Health / Ping** request — you should get `200 OK` and `X-RateLimit-*` headers.

## Environment variables

| Variable | Purpose |
|---|---|
| `base_url` | Root of the REST API (e.g. `https://sandbox-api.kangopenbanking.com/v1`). |
| `api_key` | Bearer token. Marked `secret` — never logged. |
| `webhook_secret` | HMAC-SHA256 signing secret used in `X-Kob-Signature` header verification examples. |
| `idempotency_key` | Defaults to `{{$guid}}` — Postman generates a fresh UUID per request. |
| `accept_language` | Sent as `Accept-Language`. Use `en` or `fr`. |
| `spec_url` / `postman_import_url` | URL of the OpenAPI spec. Use Postman's **Import → Link** flow to refresh the collection from this URL whenever a new version ships. |
| `spec_version` | Version pin for the spec currently in use. |
| `key_issuer_url` | Where to obtain or rotate keys for that environment. |
| `merchant_id` | Default merchant id used by example bodies. |

## Keeping integrators in sync

Whenever a new spec version is released:

1. Open Postman → **Import → Link**.
2. Paste the value of `{{postman_import_url}}` for your environment.
3. Tick **Replace existing collection**.

The page <https://kangopenbanking.com/developer/spec-versions> lists every published
version with copy-able URLs (JSON + YAML) for both the latest and every prior release.
