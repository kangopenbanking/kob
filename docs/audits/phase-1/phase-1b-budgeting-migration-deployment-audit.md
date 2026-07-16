# Phase 1B — Budgeting Migration Deployment Behaviour Audit

**Slice:** R1I-c.1F
**Scope:** Read-only inspection of migration deployment mechanisms.

## Mechanism inventory

| Mechanism | Trigger | Target database | Applies migrations? | Production risk |
|---|---|---|---|---|
| Lovable Cloud platform | File appears/changes under `supabase/migrations/` | Managed Test DB immediately; Managed Live DB on user Publish | **YES — automatic** | **HIGH** — direct auto-apply, no PR gate |
| `.github/workflows/*.yml` (41 workflows scanned) | push / PR / cron | n/a | **NO** — none invoke `supabase db push` or reference `supabase/migrations` | None |
| `netlify-prod-deploy.yml` / `vercel-prod-deploy.yml` | main branch deploy | n/a (static frontend only) | NO | None |
| `worker-deploy.yml` | tag / dispatch | n/a (edge worker) | NO | None |
| `package.json` scripts | manual `npm run <x>` | n/a | NO — no migration invocation script exists | None |
| `supabase/pending-migrations/**` (this slice, new) | none | none | **NO** — platform ignores directory | None |

Evidence commands executed:
```
grep -l "supabase db push\|supabase/migrations" .github/workflows/*.yml  # → no matches
ls supabase/migrations | wc -l                                          # → 481 historical files
```

## Conclusion

Placing a `.sql` file under `supabase/migrations/` **is** an automatic production
action once the user publishes. The safe non-production packaging path is
**Model B — pending migration directory** (`supabase/pending-migrations/phase-1/`).

CI/CD workflows do not currently gate migration promotion; the promotion gate is
enforced procedurally through the Guardian role approvals recorded in
`supabase/pending-migrations/phase-1/README.md`.
