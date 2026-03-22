import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileJson, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const RedocPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js';
    script.onload = () => {
      if (containerRef.current && (window as any).Redoc) {
        (window as any).Redoc.init(
          '/openapi.json',
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
  }, []);

  return (
    <>
      <Helmet>
        <title>API Reference — Kang Open Banking | Redoc</title>
        <meta name="description" content="Complete API reference for Kang Open Banking. 276+ endpoints for payments, accounts, transfers, and open banking services in Cameroon and CEMAC region." />
        <meta property="og:title" content="Kang Open Banking API Reference" />
        <meta property="og:description" content="Interactive API documentation for the KOB payment gateway and open banking platform." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/redoc" />
      </Helmet>

      {/* Header bar with nav links — always in HTML for crawlers */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-4">
            <Link to="/developer" className="font-bold text-lg">KOB Docs</Link>
            <nav className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
              <Link to="/developer/getting-started" className="hover:text-foreground transition-colors">Getting Started</Link>
              <Link to="/developer/api-explorer" className="hover:text-foreground transition-colors">Interactive Explorer</Link>
              <Link to="/developer/redoc" className="text-foreground font-medium">Redoc</Link>
              <Link to="/developer/api-explorer-static" className="hover:text-foreground transition-colors">Static Reference</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/openapi.json" download="kang-openbanking-api.json">
                <Download className="h-4 w-4 mr-1" /> JSON
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/openapi.yaml" download="kang-openbanking-api.yaml">
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
          <h1>Kang Open Banking API Reference</h1>
          <p>This page requires JavaScript for the interactive documentation viewer. You can download the API specification directly:</p>
          <ul>
            <li><a href="/openapi.json">Download OpenAPI JSON</a></li>
            <li><a href="/openapi.yaml">Download OpenAPI YAML</a></li>
            <li><a href="/openapi-sandbox.json">Download Sandbox OpenAPI JSON</a></li>
          </ul>
          <p>Or view the <a href="/developer/api-explorer-static">static API reference</a>.</p>
        </div>
      </noscript>

      {loading && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading API documentation…</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-destructive">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/openapi.json" download><FileJson className="h-4 w-4 mr-1" /> Download Spec</a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/developer/api-explorer-static">View Static Reference</Link>
            </Button>
          </div>
        </div>
      )}

      <div ref={containerRef} id="redoc-container" />
    </>
  );
};

export default RedocPage;
