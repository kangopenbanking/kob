import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileJson, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const RedocPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  const isSandbox = location.pathname.includes('sandbox');
  const specUrl = isSandbox ? '/openapi-sandbox.json' : '/openapi.json';
  const specYamlUrl = isSandbox ? '/openapi-sandbox.yaml' : '/openapi.yaml';
  const envLabel = isSandbox ? 'Sandbox' : 'Production';

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';
    script.onload = () => {
      if (containerRef.current && (window as any).Redoc) {
        (window as any).Redoc.init(
          specUrl,
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
            hideHostname: false,
            noAutoAuth: false,
            pathInMiddlePanel: true,
            scrollYOffset: 64,
          },
          containerRef.current,
          () => setLoading(false)
        );
      }
    };
    script.onerror = () => {
      setError('Failed to load Redoc library');
      setLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [specUrl]);

  return (
    <>
      <Helmet>
        <title>API Reference ({envLabel}) — Kang Open Banking | Redoc</title>
        <meta name="description" content={`Complete ${envLabel} API reference for Kang Open Banking. 276+ endpoints for payments, accounts, transfers, and open banking services in Cameroon and CEMAC region.`} />
        <meta property="og:title" content={`Kang Open Banking API Reference (${envLabel})`} />
        <meta property="og:description" content="Interactive API documentation for the KOB payment gateway and open banking platform." />
        <link rel="canonical" href={`https://kangopenbanking.com/developer/${isSandbox ? 'redoc-sandbox' : 'redoc'}`} />
      </Helmet>

      {/* Header bar with nav links — always in HTML for crawlers */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/developer" className="font-bold text-lg">KOB Docs</Link>
            <nav className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
              <Link to="/developer/getting-started" className="hover:text-foreground transition-colors">Getting Started</Link>
              <Link to="/developer/api-explorer" className="hover:text-foreground transition-colors">Interactive Explorer</Link>
              <Link to="/developer/redoc" className={`transition-colors ${!isSandbox ? 'text-foreground font-medium' : 'hover:text-foreground'}`}>Redoc</Link>
              <Link to="/developer/redoc-sandbox" className={`transition-colors ${isSandbox ? 'text-foreground font-medium' : 'hover:text-foreground'}`}>Redoc (Sandbox)</Link>
              <Link to="/developer/api-explorer-static" className="hover:text-foreground transition-colors">Static Reference</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={specUrl} download={`kang-openbanking-api-${isSandbox ? 'sandbox' : 'prod'}.json`}>
                <Download className="h-4 w-4 mr-1" /> JSON
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={specYamlUrl} download={`kang-openbanking-api-${isSandbox ? 'sandbox' : 'prod'}.yaml`}>
                <Download className="h-4 w-4 mr-1" /> YAML
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer/api-explorer">
                <ExternalLink className="h-4 w-4 mr-1" /> Interactive
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* SEO-friendly content always in HTML */}
      <noscript>
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          <h1>Kang Open Banking API Reference ({envLabel})</h1>
          <p>This page requires JavaScript for the interactive documentation viewer. You can download the API specification directly:</p>
          <ul>
            <li><a href="/openapi.json">Download OpenAPI JSON (Production)</a></li>
            <li><a href="/openapi.yaml">Download OpenAPI YAML (Production)</a></li>
            <li><a href="/openapi-sandbox.json">Download OpenAPI JSON (Sandbox)</a></li>
            <li><a href="/openapi-sandbox.yaml">Download OpenAPI YAML (Sandbox)</a></li>
          </ul>
          <h2>API Endpoint Groups</h2>
          <ul>
            <li><strong>Gateway</strong> — /v1/gateway/charges, /v1/gateway/payouts, /v1/gateway/refunds, /v1/gateway/settlements</li>
            <li><strong>Accounts (AISP)</strong> — /v1/aisp/accounts, /v1/aisp/balances, /v1/aisp/transactions</li>
            <li><strong>Payments (PISP)</strong> — /v1/pisp/domestic-payments, /v1/pisp/international-payments</li>
            <li><strong>Merchants</strong> — /v1/merchants, /v1/merchants/kyb, /v1/merchants/api-keys, /v1/merchants/webhooks</li>
            <li><strong>Mobile Money</strong> — /v1/mobile-money/charge, /v1/mobile-money/disburse</li>
            <li><strong>Webhooks</strong> — /v1/webhooks/inbound/stripe, /v1/webhooks/inbound/flutterwave, /v1/webhooks/inbound/paypal</li>
            <li><strong>OAuth</strong> — /v1/oauth/token, /v1/oauth/authorize, /v1/dcr/register</li>
            <li><strong>Sandbox</strong> — /v1/sandbox/simulate, /v1/sandbox/reset</li>
          </ul>
          <p>Or view the <a href="/developer/api-explorer-static">static API reference</a>.</p>
        </div>
      </noscript>

      {loading && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading {envLabel} API documentation…</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={specUrl} download><FileJson className="h-4 w-4 mr-1" /> Download Spec</a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/developer/api-explorer-static">View Static Reference</Link>
            </Button>
          </div>
        </div>
      )}

      <div ref={containerRef} id="redoc-container" data-testid="redoc-container" />
    </>
  );
};

export default RedocPage;
