# How to rotate Kang Open Banking signing keys in your client

Kang Open Banking signs every downloadable artifact (OpenAPI spec, Postman
collections, SDK manifests, `SHA256SUMS.txt`) with an **Ed25519 detached
signature**. Integrators verify those signatures against a published
public key at `/artifact-signing-pubkey.pem`.

This guide shows you how to:

1. Verify with the **current** key today.
2. Pre-pin the **staged next** key during a rotation window so your
   pipeline keeps working at cutover without a code change.
3. Switch over cleanly when the next key becomes current.

Source of truth for fingerprints:

- `GET https://kangopenbanking.com/signing-key-updates.json` — small,
  pollable endpoint with `current`, `next`, history, and a recommended
  `pollIntervalSeconds`.
- `GET https://kangopenbanking.com/artifacts.json` — full per-artifact
  metadata (URL, SHA-256, `.sig`, `.sig.next`, fingerprints).

---

## Step 1 — Verify with the current key (steady state)

Fingerprints are `SHA256:<base64>` of the public key's SPKI DER, exactly
matching what the portal publishes and what `openssl pkey -pubout` would
yield if you computed it locally.

### 1a. Manual one-file check (curl + node)

```bash
curl -sSO https://kangopenbanking.com/openapi.json
curl -sSO https://kangopenbanking.com/openapi.json.sig
curl -sSO https://kangopenbanking.com/artifact-signing-pubkey.pem

node -e "const c=require('crypto'),f=require('fs');
  const pub=c.createPublicKey(f.readFileSync('artifact-signing-pubkey.pem'));
  const sig=Buffer.from(f.readFileSync('openapi.json.sig','utf8').trim(),'base64');
  process.exit(c.verify(null,f.readFileSync('openapi.json'),pub,sig)?0:1);"
```

### 1b. Verify every artifact (recommended)

```bash
curl -sSL https://kangopenbanking.com/scripts/kob-verify-keys.mjs | node -
```

The CLI fetches `/artifacts.json`, downloads every signed file, validates
SHA-256, and verifies the Ed25519 signature with the published current
key. Exit code is `0` on success, `1` on any failure.

### 1c. Pin the fingerprint in CI

```bash
EXPECTED="SHA256:Br2ie7Gjd6KQqMj/QCx7wKX1H7VpJC/R8dyZuxJQnpM"  # update from /signing-key-updates.json

curl -sSL https://kangopenbanking.com/scripts/kob-verify-keys.mjs \
  | node - --pin "$EXPECTED"
```

`--pin` causes the CLI to **fail the build** if the live current key
doesn't match the value you trust — protecting you against a silent
unannounced rotation.

---

## Step 2 — Detect a rotation before it ships

Poll `signing-key-updates.json` on a schedule. The endpoint is small,
cache-friendly, and tells you exactly what to expect:

```bash
curl -sS https://kangopenbanking.com/signing-key-updates.json | jq
```

```json
{
  "algorithm": "ed25519",
  "current": {
    "fingerprint": "SHA256:Br2ie7Gjd6KQqMj/QCx7wKX1H7VpJC/R8dyZuxJQnpM",
    "publicKeyUrl": "/artifact-signing-pubkey.pem",
    "establishedAt": "2026-05-30T11:22:58Z"
  },
  "next": {
    "fingerprint": "SHA256:lOXSrBm8QPt1EIMu4pkzYa9WkoUcOGAYMd+6DWlZW7w",
    "publicKeyUrl": "/artifact-signing-pubkey-next.pem",
    "status": "staged",
    "stagedAt": "2026-06-05T09:00:00Z"
  },
  "pollIntervalSeconds": 21600
}
```

When `next` becomes non-null, a rotation is coming. You have at least 14
days (per our rotation procedure) to pre-pin the new fingerprint.

### Suggested polling job

```bash
# every 6h via cron, alerts if a staged next key appears
RESP=$(curl -sS https://kangopenbanking.com/signing-key-updates.json)
NEXT=$(echo "$RESP" | jq -r '.next.fingerprint // empty')
[ -n "$NEXT" ] && echo "ACTION: pre-pin $NEXT before cutover" | mail -s "KOB key rotation" ops@example.com
```

---

## Step 3 — Pre-pin the next key (zero-downtime)

Accept either fingerprint for the entire staging window. The simplest
shape is "current OR next":

```bash
EXPECTED_CUR="SHA256:Br2ie7Gjd6KQqMj/QCx7wKX1H7VpJC/R8dyZuxJQnpM"
EXPECTED_NEXT="SHA256:lOXSrBm8QPt1EIMu4pkzYa9WkoUcOGAYMd+6DWlZW7w"

curl -sSL https://kangopenbanking.com/scripts/kob-verify-keys.mjs \
  | node - --pin "$EXPECTED_CUR" --pin "$EXPECTED_NEXT"
```

The CLI passes if the live current fingerprint equals **any** value you
passed via `--pin`. During the rotation window it'll be `EXPECTED_CUR`;
on/after cutover it becomes `EXPECTED_NEXT`. Both work without a code
change.

### Verifying both signatures explicitly

Every artifact during the staging window ships two signatures:

| File                                   | Verified with    |
| -------------------------------------- | ---------------- |
| `<artifact>.sig`                       | Current key      |
| `<artifact>.sig.next`                  | Next (staged) key |
| `/artifact-signing-pubkey.pem`         | Current public   |
| `/artifact-signing-pubkey-next.pem`    | Next public      |

`kob-verify-keys.mjs` automatically validates **both** chains when the
next key is published. If your pipeline runs against the next public key
during the window, you've proven your post-cutover code path works
before cutover happens.

```bash
# Manually verify a single artifact with the staged next key:
curl -sSO https://kangopenbanking.com/openapi.json
curl -sSO https://kangopenbanking.com/openapi.json.sig.next
curl -sSO https://kangopenbanking.com/artifact-signing-pubkey-next.pem

node -e "const c=require('crypto'),f=require('fs');
  const pub=c.createPublicKey(f.readFileSync('artifact-signing-pubkey-next.pem'));
  const sig=Buffer.from(f.readFileSync('openapi.json.sig.next','utf8').trim(),'base64');
  process.exit(c.verify(null,f.readFileSync('openapi.json'),pub,sig)?0:1);"
```

---

## Step 4 — Cutover day

At T+0:

1. `signing-key-updates.json` flips: the previously staged `next`
   fingerprint moves into `current`, `next` becomes `null`, and the
   previous `current` is appended to `history` with a `retiredAt`
   timestamp.
2. `/artifact-signing-pubkey.pem` now serves what used to be the staged
   key. `<artifact>.sig.next` files stop being published.
3. Your pipeline keeps passing because `--pin` accepted both
   fingerprints during the window.

After 1–2 verified production runs, narrow `--pin` back to a single
expected value:

```bash
EXPECTED_CUR="SHA256:lOXSrBm8QPt1EIMu4pkzYa9WkoUcOGAYMd+6DWlZW7w"  # was the "next" fingerprint

curl -sSL https://kangopenbanking.com/scripts/kob-verify-keys.mjs \
  | node - --pin "$EXPECTED_CUR"
```

---

## Emergency rotation

If we publish an unscheduled rotation tagged `security-advisory` in the
changelog, the staging window is skipped — the new key becomes current
immediately. Your `--pin` check will fail, alerting you to refetch
`/artifact-signing-pubkey.pem` and update the pinned fingerprint after
out-of-band verification (e.g. by reading the announcement in the
CHANGELOG and our security mailing list).

This is intentional: in a compromise scenario, **noisy failure is
correct**.

---

## See also

- [Verify signed artifacts (UI)](/developer/openapi#verify)
- [Rotation procedure (UI)](/developer/openapi#rotation)
- [`/signing-key-updates.json`](/signing-key-updates.json)
- [`/artifacts.json`](/artifacts.json)
- [`/SHA256SUMS.txt`](/SHA256SUMS.txt) + [`.sig`](/SHA256SUMS.txt.sig)
- [`kob-verify-keys.mjs`](/scripts/kob-verify-keys.mjs) — this CLI
- [`kob-fetch.mjs`](/scripts/kob-fetch.mjs) — fetch + verify in one shot
