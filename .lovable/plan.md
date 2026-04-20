
# Cleanup Discovery Audit — Read-Only Report

I'll run the audit (Phases 1–4 from the previously approved plan) and produce **a single report file** at `docs/audit/2026-04-20-zero-downtime-cleanup-audit.md`. **Zero code or schema changes.** You then approve specific items before any removal.

## What gets scanned

**Backend**
- 327 edge functions → cross-referenced against `supabase.functions.invoke`, direct `/functions/v1/*` fetches, router maps, `config.toml`, and 90-day traffic from `function_edge_logs`.
- 402 DB tables / columns → grep across `src/`, `supabase/functions/`, RPCs, RLS policy bodies.
- 940 RLS policies → flag any referencing dropped columns or stale roles via `supabase--linter`.
- 12 cron jobs → orphan check against target functions.

**Frontend**
- 296 components + 573 pages → dead-import scan (excludes `App.tsx` routes, `lazy()` imports, `src/components/ui/*`).
- ~80 npm dependencies → import-presence check.
- `public/` + `src/assets/` → unreferenced static files (favicon set, manifest icons, `kfs-logo.png`, `kob-logo.png` protected).
- `src/types/` → unreferenced interfaces.

**PWA & bundle**
- Eagerly-imported route components >50 KB → `React.lazy` candidates.
- `vite.config.ts` Workbox config verification (no changes).

## Hard protections (auto-classified "Keep")

- All `/developer/*`, `/openapi.{json,yaml}`, SDK packages, `*-router` functions, `payment-facilitation-router` + 4 leaf functions.
- Auto-generated files: `src/integrations/supabase/{client,types}.ts`, `.env`, `supabase/config.toml` project block.
- Anything referenced via template literals, DB-stored function names, `TEMPLATES`/`ROUTES` registries, i18n keys, webhook event names → **Review Required**, never **Safe to Delete**.
- All Standing Orders honored (THE LOCK, THE RATCHET, THE SURGEON RULE).

## Deliverable

Single markdown file:

```
docs/audit/2026-04-20-zero-downtime-cleanup-audit.md
```

Sections:
1. Executive summary (counts per bucket)
2. Backend — edge functions / tables / RLS / cron
3. Frontend — dead components / unused deps / unreferenced assets / stale types
4. PWA & bundle — lazy candidates, Workbox verification
5. Dynamic-reference watchlist (do-not-delete)
6. Sunset timeline proposal (T+0 deprecation headers → T+30d soft-archive → T+90d delete)
7. Per-batch approval checklist

## What I will NOT do in this pass

- No file deletions, no schema migrations, no edge-function removals.
- No changes to OpenAPI spec, `info.version`, or any operationId.
- No bundle/lazy-load refactor — only candidates listed.

After you read the report, you pick batches (≤10 items each) and I execute Phase 5 staged removals one batch at a time.
