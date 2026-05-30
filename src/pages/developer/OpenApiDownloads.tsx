import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, ShieldCheck, FileText, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import SpecDownloads from '@/components/developer/SpecDownloads';
import { KOB_API_VERSION_LABEL, KOB_SDK_VERSIONS } from '@/config/version';

const OpenApiDownloads = () => {
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
                <a href="/downloads-checksums.json" download>
                  <Download className="h-4 w-4 mr-1" /> downloads-checksums.json
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/sdk-downloads/SDK_RELEASE_NOTES.md" download>
                  <FileText className="h-4 w-4 mr-1" /> SDK release notes (v1.2.0 → v1.6.1)
                </a>
              </Button>
            </div>
            <pre className="bg-muted/60 px-3 py-2 rounded text-xs overflow-x-auto"><code>{`curl -sSO https://kangopenbanking.com/SHA256SUMS.txt
sha256sum -c SHA256SUMS.txt --ignore-missing`}</code></pre>
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
