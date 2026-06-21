#!/usr/bin/env bash
# Vercel install step. Keeps vercel.json installCommand under 256 chars.
set -euo pipefail

LOCK_HASH="$(sha256sum package-lock.json | cut -d' ' -f1)"
STAMP="node_modules/.lockhash"

if [ -f "$STAMP" ] && [ "$(cat "$STAMP")" != "$LOCK_HASH" ]; then
  echo "[vercel] package-lock.json changed — busting node_modules cache"
  rm -rf node_modules
fi

npm install --include-workspace-root --legacy-peer-deps --no-audit --no-fund

mkdir -p node_modules
echo "$LOCK_HASH" > "$STAMP"

node scripts/vercel-postinstall-check.mjs
