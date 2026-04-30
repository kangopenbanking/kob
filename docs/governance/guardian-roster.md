# Guardian Role Roster

> Living document — update within the same PR that adds/removes a team member.
> Source of truth for the GitHub teams referenced in `.github/CODEOWNERS`.

## Why this file exists

`Standing Order 7 — The Five Roles` requires every editing session that
touches the OpenAPI contract or production governance surfaces to reinstate
the Guardian / Architect / Surgeon / Auditor / Scorekeeper roles. This file
maps those roles to GitHub team handles and named individuals so a PR
reviewer can immediately see who owns each surface.

## GitHub teams (referenced from `.github/CODEOWNERS`)

| Team handle                          | Surface owned                                                     |
|--------------------------------------|-------------------------------------------------------------------|
| `@kang-fintech/api-guardians`        | OpenAPI spec, ratchets, governance docs, changelog                 |
| `@kang-fintech/spec-architects`      | Schema modeling, OpenAPI 3.1 / FAPI compliance                     |
| `@kang-fintech/db-stewards`          | Supabase migrations, RLS, `SECURITY DEFINER` review                |
| `@kang-fintech/edge-maintainers`     | `supabase/functions/` runtime + `_shared/` libs                    |
| `@kang-fintech/sdk-maintainers`      | `packages/sdk-*` published clients                                 |
| `@kang-fintech/devrel`               | Public docs (`docs/public/`, `docs/developer-portal/`, examples)   |
| `@kang-fintech/platform-eng`         | Cloudflare worker, mTLS infra, deployment manifests                |
| `@kang-fintech/qa`                   | Playwright E2E suites, contract tests                              |

> Replace the `@kang-fintech/...` placeholders with the real GitHub
> organization slug once the org is provisioned. Until then PRs will fall
> through to the repository default reviewers.

## Standing-Order role assignments

| Standing Order | Role          | Default owner team               |
|----------------|---------------|----------------------------------|
| ORDER 1 (Lock) | Guardian      | `@kang-fintech/api-guardians`    |
| ORDER 2 (Ratchet) | Scorekeeper | `@kang-fintech/api-guardians`  |
| ORDER 3 (Audit Trail) | Auditor | `@kang-fintech/api-guardians`  |
| ORDER 4 (Surgeon) | Surgeon    | `@kang-fintech/spec-architects` |
| ORDER 5 (Dead Code) | Architect | `@kang-fintech/spec-architects` |
| ORDER 6 (Version Gate) | Scorekeeper | `@kang-fintech/api-guardians` |
| ORDER 7 (Five Roles) | Guardian | `@kang-fintech/api-guardians`  |
| ORDER P1–P10 (Public Docs) | DevRel | `@kang-fintech/devrel`     |

## How to update this file

1. Open a PR that edits both `.github/CODEOWNERS` AND this file in the same
   commit. CODEOWNERS protects this file (see line 67 of CODEOWNERS).
2. Get sign-off from at least one existing `@kang-fintech/api-guardians`
   member.
3. Merge — CI ratchets will block any rename of a role that is still cited
   by a Standing Order.
