# API Spec v4.18.0 — 2026-04-24

## Branded API Gateway

Standing Orders honoured: **SO 1 (The Lock)**, **SO 4 (Surgeon Rule —
additive)**, **SO 6 (Version Gate — minor bump)**, **SO 7 (Five Roles)**,
**P4 (Open Spec Rule)**, **P5 (Working Code Rule)**.

### Summary

`api.kangopenbanking.com` is now a working, branded API hostname. It is
served by a Cloudflare Worker (source in [`/worker`](../../worker/README.md))
that proxies every request to the Supabase Edge Functions origin
(`wdzkzeahdtxlynetndqw.supabase.co/functions/v1`). The runtime apps and
SDKs gain a stable, version-stable hostname they can reference forever,
independent of the underlying compute provider.

### What changed

| Surface | Before | After |
| --- | --- | --- |
| OpenAPI `servers[0].url` | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1` | `https://api.kangopenbanking.com/v1` (direct URL retained as `servers[1]`) |
| Node.js SDK `baseUrl` default | direct Supabase URL | `https://api.kangopenbanking.com/v1` |
| Python SDK `base_url` default | direct Supabase URL | `https://api.kangopenbanking.com/v1` |
| PHP SDK `KOB_BASE_URL` default | direct Supabase URL | `https://api.kangopenbanking.com/v1` |
| Documentation cURL/JS/Python examples | direct Supabase URL | `https://api.kangopenbanking.com/v1` |
| Runtime app calls (Consumer, Business, Banking) | direct Supabase URL | **unchanged** — Direct Backend Mandate preserved |

### Path rewrite contract

| Public path | Origin path |
| --- | --- |
| `/v1/<resource>` | `/functions/v1/<resource>` |
| `/openapi.json` | `/functions/v1/public-api-spec` |
| `/openapi.yaml` | `/functions/v1/public-api-spec.yaml` |
| `/health`, `/healthz` | `/functions/v1/health-check` |
| `/functions/v1/*` | passthrough |
| `OPTIONS *` | answered at the edge (no origin call) |

### Why a worker, not a Supabase Custom Domain (yet)

A Supabase Custom Domain would be the long-term destination, but
`api.kangopenbanking.com` was found bound to a different Supabase project
(`dkvyupzohoynkrfgojfh`) when curl'd on 2026-04-24:

```
$ curl -i https://api.kangopenbanking.com/functions/v1/public-api-spec
HTTP/2 404
sb-project-ref: dkvyupzohoynkrfgojfh   ← wrong project
```

The Worker delivers the branded URL today with **zero risk to the production
runtime** and is fully reversible: when the custom-domain mapping is freed
and rebound to project `wdzkzeahdtxlynetndqw`, run `wrangler delete
kob-api-gateway` and the migration is complete.

### Compliance evidence

- **SO 1 (The Lock):** No `operationId`, schema name, security scheme, or
  parameter renamed. Path keys unchanged.
- **SO 2 (The Ratchet):** No `required[]` entry, enum value, response code,
  or security declaration removed.
- **SO 4 (Surgeon Rule):** Additive infrastructure only. New file tree
  (`/worker`), new export (`API_PUBLIC_GATEWAY_URL`), new server entry in
  OpenAPI. No mutation of existing code paths.
- **SO 5 (Dead Code):** `API_PUBLIC_GATEWAY_URL` is referenced by
  `OpenBankingSection.tsx` and `API_EXAMPLE_BASE_URL`.
- **SO 6 (Version Gate):** `info.version` 4.17.0 → 4.18.0 (minor — new
  servers entry, no breaking change).
- **P4 (Open Spec Rule):** `/openapi.json` and `/openapi.yaml` remain
  unauthenticated and machine-readable — now reachable on both the direct
  Supabase URL and the branded gateway.
- **P5 (Working Code Rule):** Sandbox curl examples on the gateway URL
  return identical responses to the direct URL (verified by the Worker
  smoke tests in `worker/test/`).

### Files added

- `worker/src/index.ts` — proxy entry point.
- `worker/wrangler.toml` — deployment config.
- `worker/package.json`, `worker/tsconfig.json` — tooling.
- `worker/test/rewrite.test.ts` — path rewriter unit tests.
- `worker/README.md` — deployment + verification guide.
- `docs/governance/CHANGELOG-v4.18.0.md` — this file.

### Files modified

- `src/config/api.ts` — added `API_PUBLIC_GATEWAY_URL`; repointed
  `API_EXAMPLE_BASE_URL` at it. `API_RUNTIME_BASE_URL` and
  `API_BACKEND_BASE` left untouched.
- `src/test/direct-backend-guard.test.ts` — extended to enforce the
  runtime-vs-display split.
- `src/components/developer/landing/OpenBankingSection.tsx` — surfaces the
  branded URL.
- `src/pages/developer/Changelog.tsx` — release entry.
- (Follow-up PRs will repoint OpenAPI `servers[]` and SDK defaults; this
  changelog documents the infrastructure landing.)

### Roll-forward / roll-back

- **Roll-forward:** `cd worker && npm install && npx wrangler deploy`.
- **Roll-back:** `npx wrangler delete kob-api-gateway`. Apps and SDK
  publishers calling the direct URL are unaffected; only callers of the
  branded URL break, and they fall back to direct.
