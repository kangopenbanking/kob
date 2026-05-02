# Publish & Harden the Developer Portal

This work covers five asks. Items 1 and 2 require operational actions that I'll execute once you approve and switch to default mode; items 3, 4, and 5 are code/config additions.

## 1. Publish the frontend (operational)

The `vite-plugin-prerender-docs.ts`, SDK page, and content fixes from the prior turns are already in source but require a frontend publish to land on `kob.lovable.app` and `kangopenbanking.com`. I'll prompt you to click **Publish → Update** in the Lovable editor — only you can trigger that. I'll wait for confirmation, then proceed to step 2.

## 2. Run `worker/scripts/verify-deploy.sh` (operational)

Once published, I'll run the verifier from the sandbox shell against the live hostnames:

```bash
PROD=https://api.kangopenbanking.com \
SANDBOX=https://sandbox-api.kangopenbanking.com \
./worker/scripts/verify-deploy.sh
```

Plus a portal-content curl loop covering the 8 docs URLs from `docs/DEVELOPER_PORTAL_CHECKLIST.md` (200-status + no `YOUR_PROJECT` + no `supabase.co/functions/v1` + no `<div id="ssr-fallback"`). Results posted back to you.

## 3. Source-tree regression test (new file)

Extend the existing Vitest guard rather than creating a parallel one — `src/test/docs-no-leak.test.ts` already scans for the internal Supabase host. Add a new sibling test:

**`src/test/developer-portal-content.test.ts`** — fails the build if any file under `src/pages/developer/**`, `vite-plugin-prerender-docs.ts`, or `public/docs/**` contains:

- the literal string `supabase.co/functions/v1`
- the placeholder `YOUR_PROJECT`
- a visible `<div id="ssr-fallback"` injection (the prerender plugin must keep ssr-fallback inside `<noscript>` only — the test parses the plugin source and rejects any non-noscript-wrapped occurrence)

This runs in the existing Vitest suite picked up by `.github/workflows/api-contract-gates.yml`, so any PR introducing a regression fails CI before reaching production.

## 4. Uptime / error monitoring for portal + spec endpoints

Two layers, both additive:

**a. Scheduled GitHub Action — `.github/workflows/developer-portal-uptime.yml`**

Runs every 15 minutes against production. Hits this URL set:

```text
/developer
/developer/getting-started
/developer/api-explorer
/developer/gateway/quickstart
/developer/sandbox/overview
/developer/guides/sdks
/developer/examples/real-world
/developer/changelog
/openapi.json
/openapi.yaml
/.well-known/openid-configuration
/v1/health
```

Asserts: HTTP 200, no `YOUR_PROJECT`, no `supabase.co/functions/v1`, no `<div id="ssr-fallback"` in body. On failure: opens a GitHub issue tagged `portal-down` and pings via the existing repo notification settings (no new secrets needed).

**b. In-app health record — reuse `api-health-collector` edge function**

Add a sibling edge function `developer-portal-uptime-collector` that runs on the existing cron and writes one row per checked URL to a new table `developer_portal_health`. The existing `/healthz` admin dashboard already reads from `api_health_metrics`; I'll add a small "Developer Portal" section so you can see the same data inside the admin app, not only on GitHub.

Migration:
```sql
create table public.developer_portal_health (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  status int not null,
  ok boolean not null,
  content_check text,           -- 'pass' | 'leak:YOUR_PROJECT' | 'leak:supabase.co' | 'leak:ssr-fallback'
  response_ms int,
  checked_at timestamptz not null default now()
);
alter table public.developer_portal_health enable row level security;
create policy "admins read portal health"
  on public.developer_portal_health for select
  to authenticated using (public.has_role(auth.uid(), 'admin'));
-- writes are service-role only (no insert policy)
```

## 5. Changelog entry — `docs/governance/CHANGELOG-v4.18.2.md`

Documents the SDKs page changes per Standing Order P7 + Version Gate:

- **SDKs page (`/developer/guides/sdks`)** — Officially published SDKs are now listed as exactly Node.js (`@kangopenbanking/sdk`), Python (`kangopenbanking`), PHP (`kangopenbanking/sdk-php`).
- Java, Go, and Ruby reclassified as **community implementation guides** with inline `Net::HTTP` / `net/http` / `java.net.http` reference snippets, clearly labelled in a UI alert so integrators don't expect a published package.
- Portal home quick-link list updated to match.
- Sandbox base URL corrected to `https://sandbox-api.kangopenbanking.com/v1` (replaces leftover `YOUR_PROJECT.supabase.co/functions/v1` placeholders in `vite-plugin-prerender-docs.ts`).
- Removes duplicate `#ssr-fallback` body injection (SEO content kept inside `<noscript>` only).

Bump `info.version` to `4.18.2` (patch — additive content + bug fix per Standing Order 6) and append a row to `public/changelog.json`.

## Files to create / edit

| Action | Path |
|---|---|
| create | `src/test/developer-portal-content.test.ts` |
| create | `.github/workflows/developer-portal-uptime.yml` |
| create | `supabase/functions/developer-portal-uptime-collector/index.ts` |
| migration | new table `developer_portal_health` + RLS |
| edit | admin health dashboard component to surface portal rows |
| create | `docs/governance/CHANGELOG-v4.18.2.md` |
| edit | `public/changelog.json` (append entry) |
| edit | `public/openapi.json` + `public/openapi.yaml` — bump `info.version` to `4.18.2` only |
| edit | `docs/DEVELOPER_PORTAL_CHECKLIST.md` — add the new uptime workflow to the post-deploy section |

## Files NOT touched (per project lock)

- `worker/*` — unchanged
- `public/openapi.{json,yaml}` content — only `info.version` bumped, no operationId/path/schema changes (Standing Order 1)
- `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`

## Order of execution after approval

1. Write test, workflow, edge function, migration, admin tweak, changelog files.
2. Ask you to click **Publish → Update**.
3. Run `verify-deploy.sh` + portal content curls; report results.
4. Confirm the new GitHub Action runs green on its first scheduled tick.
