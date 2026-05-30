# Artifact Signing Keys — Operator Guide

The Kang Open Banking developer portal signs every downloadable artifact
(OpenAPI spec, Postman collections, SDK manifests, `SHA256SUMS.txt`) with
an **Ed25519 detached signature**. Integrators verify these signatures
against the public key published at `/artifact-signing-pubkey.pem`.

## Golden rule — NEVER commit a private key

The following paths are gitignored and **must never** be added to git,
copied into `public/`, pasted into source files, or shared in chat / PRs:

| Path                                       | What it is                                |
| ------------------------------------------ | ----------------------------------------- |
| `.keys/artifact-signing.key`               | Local dev private key (auto-generated)    |
| `kob-signing/artifact-signing.key`         | Operator-generated current private key    |
| `kob-signing/artifact-signing-next.key`    | Operator-generated staged next private key|
| `kob-signing/*.key`                        | Any private key file                      |
| Anything matching `*.key`                  | Treat as secret unless explicitly public  |

The **public** keys (`/artifact-signing-pubkey.pem` and, during a staged
rotation, `/artifact-signing-pubkey-next.pem`) are safe to publish and are
the only halves of the keypairs that ship in a deploy.

If a private key is ever committed, even briefly:

1. Treat it as compromised.
2. Generate a new keypair.
3. Rotate `KOB_ARTIFACT_SIGNING_KEY` in Workspace → Build Secrets.
4. Redeploy so `/artifact-signing-pubkey.pem` updates.
5. Announce the rotation in `CHANGELOG.md` and
   `public/sdk-downloads/SDK_RELEASE_NOTES.md`.

## Where the private key may live

- **Production / Preview builds** — `KOB_ARTIFACT_SIGNING_KEY` build secret
  (Workspace Settings → Build Secrets). Only supported production location.
- **Staged "next" key (rotation)** — `KOB_NEXT_ARTIFACT_SIGNING_KEY` build
  secret. Optional, only set during a planned rotation window.
- **Local development** — `.keys/artifact-signing.key` (auto-generated,
  gitignored) OR `kob-signing/artifact-signing.key` (operator-generated).

## Verifying your local setup

```bash
node scripts/check-signing-key.mjs
```

## CI enforcement

`scripts/sign-artifacts.mjs` runs during the predeploy gate. In CI the build
**fails hard** if `KOB_ARTIFACT_SIGNING_KEY` is not set, instead of silently
emitting a throwaway dev key.

`scripts/verify-artifact-signatures.mjs` then re-verifies every signature
against the published public key. When a staged next key is configured, the
verifier ALSO checks every `<artifact>.sig.next` against
`/artifact-signing-pubkey-next.pem`. A rotation cannot pass CI unless both
keys produce valid signatures for every artifact — guaranteeing a smooth
cutover.

---

## Key rotation procedure (zero-downtime for integrators)

The portal supports **dual signatures** so integrators can pre-pin the next
public key before it becomes the active signing key. The full procedure:

### T-14 days — Generate the next key

```bash
openssl genpkey -algorithm ed25519 -out kob-signing/artifact-signing-next.key
openssl pkey -in kob-signing/artifact-signing-next.key -pubout \
  -out kob-signing/artifact-signing-next.pub
```

Add the private key to Workspace → Build Secrets as
`KOB_NEXT_ARTIFACT_SIGNING_KEY` (full PEM, BEGIN/END lines included).
**Do not touch `KOB_ARTIFACT_SIGNING_KEY` yet.**

### T-14 → T-0 — Publish dual signatures

Redeploy. Each release now ships:

| File                                       | Signed with    |
| ------------------------------------------ | -------------- |
| `<artifact>.sig`                           | Current key    |
| `<artifact>.sig.next`                      | Next (staged) key |
| `/artifact-signing-pubkey.pem`             | Current public |
| `/artifact-signing-pubkey-next.pem`        | Next public    |

`/artifacts.json` exposes both fingerprints under `signing.publicKeyFingerprint`
and `signing.next.publicKeyFingerprint`. The CI verifier
(`scripts/verify-artifact-signatures.mjs`) enforces that **every** artifact
validates against **both** keys for the entire staging window.

### T-0 announcement — Notify integrators

1. Add a CHANGELOG entry under "Security / Signing key rotation" with:
   - Current fingerprint (deprecated on cutover date)
   - Next fingerprint (becomes active on cutover date)
   - Exact cutover timestamp in UTC
2. Add the same notice to `public/sdk-downloads/SDK_RELEASE_NOTES.md`.
3. Encourage integrators to **pre-pin both** fingerprints during the window
   — pipelines should accept either signature so they don't break at cutover.

Example integrator snippet:

```bash
# Pin both fingerprints during the rotation window
EXPECTED_CUR="SHA256:<current-fingerprint>"
EXPECTED_NEXT="SHA256:<next-fingerprint>"

ACTUAL=$(curl -sS https://kangopenbanking.com/artifacts.json \
  | jq -r '.signing.publicKeyFingerprint')
[ "$ACTUAL" = "$EXPECTED_CUR" ] || [ "$ACTUAL" = "$EXPECTED_NEXT" ] \
  || { echo "Unknown signing key $ACTUAL"; exit 1; }
```

### T+0 — Cutover

1. In Workspace → Build Secrets:
   - Set `KOB_ARTIFACT_SIGNING_KEY` to the value that was in
     `KOB_NEXT_ARTIFACT_SIGNING_KEY`.
   - **Delete** `KOB_NEXT_ARTIFACT_SIGNING_KEY` (or leave empty).
2. Redeploy. Verify on the live URL:
   ```bash
   curl -sS https://kangopenbanking.com/artifacts.json \
     | jq '.signing.publicKeyFingerprint, .signing.next'
   ```
   `publicKeyFingerprint` should match the previously-staged next fingerprint
   and `signing.next` should be `null`.
3. Announce cutover complete in CHANGELOG.

### T+30 days — Retire the old key

Securely destroy the old private key from any local operator workstations
(`shred -u kob-signing/artifact-signing-OLD.key`). Keep one offline backup
in a sealed envelope / password manager for at least 12 months for forensic
purposes only — never reuse it for signing.

### Emergency rotation (key compromise)

Skip the staging window. Generate a new key, set `KOB_ARTIFACT_SIGNING_KEY`
directly, redeploy, and announce immediately in CHANGELOG with a
`security-advisory` tag. Integrators pinning the compromised fingerprint
will need to refetch `/artifact-signing-pubkey.pem` manually — accept that
breakage as the cost of a compromise.
