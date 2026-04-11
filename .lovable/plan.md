

## Plan: Make SDKs Publishable with CI/CD Auto-Publish Pipeline

### Problem
The SDK source code exists in `packages/sdk-node`, `packages/sdk-python`, and `packages/sdk-php` but:
- Missing packaging files required for registry publishing (LICENSE files, Python build config, .npmrc/.npmignore)
- No CI/CD pipeline to publish on version bumps
- No automated testing before publish

### What Will Be Built

**1. Packaging completeness for each SDK**

Each SDK package will get the missing files needed for real installation:

- **Node.js** (`packages/sdk-node/`): Add `.npmignore`, `LICENSE` file, and `"files"` field in `package.json` to ensure `npm install @kangopenbanking/sdk` works
- **Python** (`packages/sdk-python/`): Add `LICENSE` file and a `py.typed` marker for PEP 561 typed package support. The `pyproject.toml` already uses setuptools correctly
- **PHP** (`packages/sdk-php/`): Add `LICENSE` file. The `composer.json` is already valid for Packagist

**2. GitHub Actions workflow: `.github/workflows/publish-sdks.yml`**

A single workflow file that triggers on version tag pushes (e.g., `sdk-v1.1.0`) and publishes all three packages:

```text
Trigger: push tag matching "sdk-v*"

Jobs (run in parallel):
  
  publish-npm:
    - Checkout repo
    - Setup Node.js 20
    - cd packages/sdk-node
    - npm install && npm run build
    - npm publish --access public
    - Uses NPM_TOKEN secret
  
  publish-pypi:
    - Checkout repo
    - Setup Python 3.11
    - cd packages/sdk-python
    - pip install build twine
    - python -m build
    - twine upload dist/*
    - Uses PYPI_API_TOKEN secret
  
  publish-packagist:
    - No build step needed — Packagist auto-syncs from GitHub
    - Job creates a GitHub release to trigger Packagist webhook
```

**3. Version sync script: `scripts/bump-sdk-version.sh`**

A helper script that bumps the version across all three SDK manifests simultaneously, commits, and creates the tag:

```text
Usage: ./scripts/bump-sdk-version.sh 1.2.0

Updates:
  - packages/sdk-node/package.json → version: "1.2.0"
  - packages/sdk-python/pyproject.toml → version = "1.2.0"  
  - packages/sdk-python/kangopenbanking/__init__.py → __version__ = "1.2.0"
  - packages/sdk-php/composer.json → version: "1.2.0"
  
Then: git tag sdk-v1.2.0
```

### Required Secrets

The user will need to configure these as GitHub repository secrets (not Lovable secrets — these are for GitHub Actions):

| Secret | Registry | How to get it |
|--------|----------|---------------|
| `NPM_TOKEN` | npmjs.com | npm → Access Tokens → Automation token |
| `PYPI_API_TOKEN` | pypi.org | PyPI → Account Settings → API tokens |

Packagist does not need a secret — it uses a GitHub webhook that auto-updates on push.

### Files to Create/Modify

| Action | File |
|--------|------|
| Create | `.github/workflows/publish-sdks.yml` |
| Create | `scripts/bump-sdk-version.sh` |
| Create | `packages/sdk-node/LICENSE` |
| Create | `packages/sdk-node/.npmignore` |
| Modify | `packages/sdk-node/package.json` (add `files` field, `publishConfig`) |
| Create | `packages/sdk-python/LICENSE` |
| Create | `packages/sdk-python/kangopenbanking/py.typed` |
| Create | `packages/sdk-php/LICENSE` |

### Post-Implementation Setup (User Action Required)

1. Register the package names on npm (`@kangopenbanking/sdk`), PyPI (`kangopenbanking`), and Packagist (`kangopenbanking/sdk`)
2. Add `NPM_TOKEN` and `PYPI_API_TOKEN` as GitHub repository secrets
3. Register the repo on Packagist.org and enable the GitHub webhook
4. Run `./scripts/bump-sdk-version.sh 1.1.0` and push the tag to trigger the first publish

