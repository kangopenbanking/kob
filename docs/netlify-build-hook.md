# Netlify Build Hook Setup

A **Netlify build hook** is a unique URL that triggers a deploy when you POST to
it (no payload required). Use it to deploy from CI, GitHub Actions, cron jobs,
or any external system without clicking "Deploy" in the Netlify UI.

## 1. Create the hook in Netlify

1. Open your site in Netlify → **Site settings → Build & deploy → Build hooks**.
2. Click **Add build hook**.
3. Name: `Production deploy hook` (or `CI auto-deploy`).
4. Branch to build: `main` (or whichever tracking branch you publish from).
5. Click **Save** — Netlify shows a URL like:

```
https://api.netlify.com/build_hooks/abcdef1234567890
```

Copy this URL. It is a secret — anyone with it can trigger a deploy.

## 2. Trigger from the command line

```bash
curl -X POST -d '{}' https://api.netlify.com/build_hooks/<YOUR_HOOK_ID>
```

Optional: pass a clear deploy title for the Netlify UI:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"trigger_title":"Manual prod deploy from CI"}' \
  https://api.netlify.com/build_hooks/<YOUR_HOOK_ID>
```

## 3. Trigger from GitHub Actions

Store the hook URL as a repo secret named `NETLIFY_BUILD_HOOK_URL`, then:

```yaml
name: Trigger Netlify deploy
on:
  workflow_dispatch:
  push:
    tags: ['v*']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: POST to Netlify build hook
        run: |
          curl -fsS -X POST -H "Content-Type: application/json" \
            -d "{\"trigger_title\":\"Tagged release ${GITHUB_REF_NAME}\"}" \
            "${{ secrets.NETLIFY_BUILD_HOOK_URL }}"
```

## 4. Safety rules

- Treat the hook URL like a password — store in a secret manager, never commit.
- Rotate by deleting and recreating the hook in Netlify if it leaks.
- Each POST counts toward your Netlify build minutes.
- Build hooks bypass branch protection — they always rebuild the configured branch
  from the latest commit on that branch.

## 5. Verifying the deploy

After triggering, visit `/developer/deployment-status` on the deployed site to
verify all OpenAPI / Postman / changelog artifacts publish at the expected
version.
