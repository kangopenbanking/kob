// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, ExternalLink, Loader2, Activity, KeyRound, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import SpecDownloads from '@/components/developer/SpecDownloads';

const SPEC_URL = '/openapi-sandbox.json';
const HEALTHZ_URL = 'https://api.kangopenbanking.com/v1/healthz';

const SandboxApiPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';
    script.onload = () => {
      if (containerRef.current && (window as any).Redoc) {
        (window as any).Redoc.init(
          SPEC_URL,
          {
            theme: {
              colors: { primary: { main: '#1a56db' } },
              typography: {
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                headings: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' },
              },
              sidebar: { width: '280px' },
            },
            hideDownloadButton: false,
            expandResponses: '200,201',
            sortPropsAlphabetically: true,
            pathInMiddlePanel: true,
            scrollYOffset: 200,
          },
          containerRef.current,
          () => setLoading(false),
        );
      }
    };
    script.onerror = () => {
      setError('Failed to load API reference renderer');
      setLoading(false);
    };
    document.body.appendChild(script);
    return () => {
      try { document.body.removeChild(script); } catch { /* noop */ }
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>Sandbox API Reference — Kang Open Banking</title>
        <meta
          name="description"
          content="Public sandbox OpenAPI reference for the Kang Open Banking API. Free-forever sandbox environment with test credentials, simulated mobile-money flows, and webhook simulation."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/sandbox/api" />
      </Helmet>

      <div className="border-b bg-muted/30">
        <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-semibold">Sandbox API Reference</h1>
                <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                  Sandbox
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-3xl">
                Identical contract to production. Free forever. Use{' '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">sbx_</code> API keys,
                test cards, and simulated mobile-money flows. No production data is ever
                touched.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/developer/sandbox/console">
                  <Terminal className="h-4 w-4 mr-1.5" />
                  Open Console
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/developer/sandbox/credentials">
                  <KeyRound className="h-4 w-4 mr-1.5" />
                  Test Credentials
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={HEALTHZ_URL} target="_blank" rel="noreferrer">
                  <Activity className="h-4 w-4 mr-1.5" />
                  /healthz
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={SPEC_URL} download>
                  <Download className="h-4 w-4 mr-1.5" />
                  JSON
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/openapi-sandbox.yaml" download>
                  <Download className="h-4 w-4 mr-1.5" />
                  YAML
                </a>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sandbox specification downloads</CardTitle>
            </CardHeader>
            <CardContent>
              <SpecDownloads env="Sandbox" compact />
            </CardContent>
          </Card>
        </div>
      </div>

      <noscript>
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          <h1>Kang Open Banking Sandbox API Reference</h1>
          <p>This page renders interactive documentation with JavaScript. You can also download the raw specification:</p>
          <ul>
            <li><a href="/openapi-sandbox.json">OpenAPI JSON (Sandbox)</a></li>
            <li><a href="/openapi-sandbox.yaml">OpenAPI YAML (Sandbox)</a></li>
            <li><a href="/apis-sandbox.json">APIs.json (Sandbox)</a></li>
          </ul>
          <p>
            <a href="/developer/sandbox/console">Open the sandbox console</a> ·{' '}
            <a href="/developer/sandbox/credentials">View test credentials</a>
          </p>
        </div>
      </noscript>

      {loading && !error && (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground">
            Loading sandbox API reference…
          </span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={SPEC_URL} download>
                <Download className="h-4 w-4 mr-1.5" />
                Download spec
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer/api-explorer-static">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Static reference
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div ref={containerRef} id="redoc-sandbox-container" data-testid="redoc-sandbox-container" />
    </>
  );
};

export default SandboxApiPage;
