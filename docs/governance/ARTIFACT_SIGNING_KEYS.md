# Artifact Signing Keys — Operator Guide

The Kang Open Banking developer portal signs every downloadable artifact
(OpenAPI spec, Postman collections, SDK manifests, `SHA256SUMS.txt`) with
an **Ed25519 detached signature**. Integrators verify these signatures
against the public key published at `/artifact-signing-pubkey.pem`.

## Golden rule — NEVER commit a private key

The following paths are gitignored and **must never** be added to git,
copied into `public/`, pasted into source files, or shared in chat / PRs:

| Path                              | What it is                                |
| --------------------------------- | ----------------------------------------- |
| `.keys/artifact-signing.key`      | Local dev private key (auto-generated)    |
| `kob-signing/artifact-signing.key`| Operator-generated private key (OpenSSL)  |
| `kob-signing/*.key`               | Any private key file                      |
| Anything matching `*.key`         | Treat as secret unless explicitly public  |

The **public** key (`kob-signing/artifact-signing.pub` /
`public/artifact-signing-pubkey.pem`) is safe to publish and is the only
half of the keypair that ever ships in a deploy.

If a private key is ever committed, even briefly:

1. Treat it as compromised.
2. Generate a new keypair (see `KOB_ARTIFACT_SIGNING_KEY` setup docs).
3. Rotate `KOB_ARTIFACT_SIGNING_KEY` in Workspace → Build Secrets.
4. Redeploy so `/artifact-signing-pubkey.pem` updates.
5. Announce the rotation in `CHANGELOG.md` and
   `public/sdk-downloads/SDK_RELEASE_NOTES.md` so pinned integrators
   refetch the new public key.

## Where the private key may live

- **Production / Preview builds** — `KOB_ARTIFACT_SIGNING_KEY` build secret
  (Workspace Settings → Build Secrets). This is the only supported
  production location.
- **Local development** — `.keys/artifact-signing.key` (auto-generated,
  gitignored) OR `kob-signing/artifact-signing.key` (operator-generated
  with OpenSSL, gitignored).

## Verifying your local setup

Run:

```bash
node scripts/check-signing-key.mjs
```

It reports whether a key source is configured, validates that it is a
real Ed25519 PEM private key, and prints the next step if anything is
missing.

## CI enforcement

`scripts/sign-artifacts.mjs` runs during the predeploy gate. In CI
(`CI=true`, `NETLIFY=true`, `GITHUB_ACTIONS=true`, or
`KOB_REQUIRE_SIGNING_KEY=1`) the build **fails hard** if
`KOB_ARTIFACT_SIGNING_KEY` is not set, instead of silently emitting a
throwaway dev key that would invalidate every integrator's pinned
public key.
