#!/usr/bin/env bash
# ============================================================
# Bump SDK version across all three packages and create a tag.
# Usage: ./scripts/bump-sdk-version.sh 1.2.0
# ============================================================

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 1.2.0"
  exit 1
fi

VERSION="$1"
TAG="sdk-v${VERSION}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Bumping all SDKs to version ${VERSION}..."

# Node.js
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" "${ROOT}/packages/sdk-node/package.json"
rm -f "${ROOT}/packages/sdk-node/package.json.bak"

# Python pyproject.toml
sed -i.bak "s/^version = \"[^\"]*\"/version = \"${VERSION}\"/" "${ROOT}/packages/sdk-python/pyproject.toml"
rm -f "${ROOT}/packages/sdk-python/pyproject.toml.bak"

# Python __init__.py
sed -i.bak "s/__version__ = \"[^\"]*\"/__version__ = \"${VERSION}\"/" "${ROOT}/packages/sdk-python/kangopenbanking/__init__.py"
rm -f "${ROOT}/packages/sdk-python/kangopenbanking/__init__.py.bak"

# PHP
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" "${ROOT}/packages/sdk-php/composer.json"
rm -f "${ROOT}/packages/sdk-php/composer.json.bak"

echo "All SDK manifests updated to ${VERSION}"
echo ""
echo "Next steps:"
echo "  git add -A"
echo "  git commit -m 'chore: bump SDK version to ${VERSION}'"
echo "  git tag ${TAG}"
echo "  git push origin main --tags"
