import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ShieldCheck, FileText, Download, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import SpecDownloads from '@/components/developer/SpecDownloads';
import { KOB_API_VERSION_LABEL, KOB_SDK_VERSIONS } from '@/config/version';

interface SigningMeta {
  algorithm?: string;
  publicKeyFingerprint?: string;
  publicKeyFingerprintSha256Hex?: string;
  publicKeyUrl?: string;
  next?: {
    publicKeyFingerprint?: string;
    publicKeyUrl?: string;
    status?: string;
  } | null;
}


const OpenApiDownloads = () => {
  const [signing, setSigning] = useState<SigningMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/artifacts.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (!cancelled && m?.signing) setSigning(m.signing); })
      .catch(() => { /* metadata is best-effort */ });
    return () => { cancelled = true; };
  }, []);

  return (

    <>
      <Helmet>
        <title>OpenAPI Specification Downloads — Kang Open Banking</title>
        <meta name="description" content="Download the Kang Open Banking OpenAPI specification in JSON or YAML format for production and sandbox environments, plus APIs.json discovery documents." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/openapi" />
      </Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-8" data-testid="openapi-downloads-page">
        <div>
          <h1 className="text-3xl font-bold">OpenAPI Specification</h1>
          <p className="text-muted-foreground mt-2">
            Download or link to the Kang Open Banking API specification. Use these files with Swagger UI, Redoc, Postman, Insomnia, or any OpenAPI-compatible tool. APIs.json discovery documents are also provided for both environments.
          </p>
        </div>

        <SpecDownloads env="All" compact />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Explore the API</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/developer/api-explorer"><ExternalLink className="h-4 w-4 mr-1" /> Swagger UI (Interactive)</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/developer/redoc"><ExternalLink className="h-4 w-4 mr-1" /> Redoc Reference</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/developer/api-explorer-static"><ExternalLink className="h-4 w-4 mr-1" /> Static Reference</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/developer/sandbox/api"><ExternalLink className="h-4 w-4 mr-1" /> Sandbox API Reference</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Verify your downloads (SHA-256)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Every artifact on this page is checksummed at deploy time against the SSOT
              (currently OpenAPI {KOB_API_VERSION_LABEL} · SDKs node@{KOB_SDK_VERSIONS.node} ·
              php@{KOB_SDK_VERSIONS.php} · python@{KOB_SDK_VERSIONS.python}). Use the files
              below to detect tampering or stale mirrors.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <a href="/SHA256SUMS.txt" download>
                  <Download className="h-4 w-4 mr-1" /> SHA256SUMS.txt
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/SHA256SUMS.txt.sig" download>
                  <Download className="h-4 w-4 mr-1" /> SHA256SUMS.txt.sig
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/artifact-signing-pubkey.pem" download>
                  <ShieldCheck className="h-4 w-4 mr-1" /> Ed25519 public key
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/artifacts.json" download>
                  <Download className="h-4 w-4 mr-1" /> artifacts.json (metadata)
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/downloads-checksums.json" download>
                  <Download className="h-4 w-4 mr-1" /> downloads-checksums.json
                </a>
              </Button>
            </div>
            <pre className="bg-muted/60 px-3 py-2 rounded text-xs overflow-x-auto"><code>{`# Checksum-only
curl -sSO https://kangopenbanking.com/SHA256SUMS.txt
sha256sum -c SHA256SUMS.txt --ignore-missing

# Checksum + Ed25519 signature (one command)
curl -sSL https://kangopenbanking.com/scripts/kob-fetch.mjs | node - all
# Or pick what you need: openapi | postman | sdk-node | sdk-php | sdk-python`}</code></pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Verify signed artifacts (Ed25519)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Every artifact is signed with an Ed25519 detached signature using a
              stable build-time key. The public key is published at{' '}
              <code>/artifact-signing-pubkey.pem</code> and pinned in{' '}
              <code>/artifacts.json</code>. Verify any download with either of the
              snippets below.
            </p>
            <pre className="bg-muted/60 px-3 py-2 rounded text-xs overflow-x-auto"><code>{`# 1) One-shot verifier (fetches spec, checksum, signature, public key)
curl -sSL https://kangopenbanking.com/scripts/kob-fetch.mjs | node - openapi

# 2) Manual verification with curl + node (no install)
curl -sSO https://kangopenbanking.com/openapi.json
curl -sSO https://kangopenbanking.com/openapi.json.sig
curl -sSO https://kangopenbanking.com/artifact-signing-pubkey.pem

node -e "const c=require('crypto'),f=require('fs');\\
 const pub=c.createPublicKey(f.readFileSync('artifact-signing-pubkey.pem'));\\
 const sig=Buffer.from(f.readFileSync('openapi.json.sig','utf8').trim(),'base64');\\
 const ok=c.verify(null,f.readFileSync('openapi.json'),pub,sig);\\
 console.log(ok?'signature: OK':'signature: FAIL');process.exit(ok?0:1);"

# 3) Manual verification with openssl
openssl pkeyutl -verify -pubin -inkey artifact-signing-pubkey.pem \\
  -rawin -in openapi.json -sigfile openapi.json.sig`}</code></pre>
            <p className="text-xs text-muted-foreground">
              Pin <code>/artifact-signing-pubkey.pem</code> in your build pipeline
              and fail the build on signature mismatch. Key rotations are
              announced in the changelog and SDK release notes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> SDK release notes & changelogs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Rolled-up notes plus per-SDK changelogs for v1.2.0 → v{KOB_SDK_VERSIONS.node}, aligned to OpenAPI {KOB_API_VERSION_LABEL}.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <a href="/sdk-downloads/SDK_RELEASE_NOTES.md" download>
                  <FileText className="h-4 w-4 mr-1" /> Combined release notes
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/sdk-downloads/CHANGELOG-node.md" download>
                  <FileText className="h-4 w-4 mr-1" /> Node v{KOB_SDK_VERSIONS.node}
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/sdk-downloads/CHANGELOG-php.md" download>
                  <FileText className="h-4 w-4 mr-1" /> PHP v{KOB_SDK_VERSIONS.php}
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/sdk-downloads/CHANGELOG-python.md" download>
                  <FileText className="h-4 w-4 mr-1" /> Python v{KOB_SDK_VERSIONS.python}
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <noscript>
          <div style={{ padding: '2rem' }}>
            <h2>Download OpenAPI Specification</h2>
            <ul>
              <li><a href="/openapi.json">Production JSON</a></li>
              <li><a href="/openapi.yaml">Production YAML</a></li>
              <li><a href="/openapi-sandbox.json">Sandbox JSON</a></li>
              <li><a href="/openapi-sandbox.yaml">Sandbox YAML</a></li>
            </ul>
          </div>
        </noscript>
      </div>
    </>
  );
};

export default OpenApiDownloads;
