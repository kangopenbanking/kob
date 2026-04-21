import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, AlertCircle, Key, ShieldCheck, Terminal, Sparkles, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { API_CONFIG } from '@/config/api';
import yaml from 'js-yaml';
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
const ApiExplorer = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [spec, setSpec] = useState<object | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [authGuideOpen, setAuthGuideOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        return res;
      } finally {
        clearTimeout(timer);
      }
    };

    const fetchSpec = async () => {
      setIsChecking(true);
      setFetchError(null);
      // Try static file first (longer timeout for large file), then edge function fallbacks
      const sources: { url: string; timeout: number }[] = [
        { url: `${window.location.origin}/openapi.json`, timeout: 30000 },
        { url: `${API_CONFIG.BASE_URL}/public-api-spec`, timeout: 20000 },
      ];
      for (const { url, timeout } of sources) {
        if (cancelled) return;
        try {
          const res = await fetchWithTimeout(url, timeout);
          if (!res.ok) continue;
          const text = await res.text();
          if (cancelled) return;
          const data = JSON.parse(text);
          if (data?.openapi || data?.info) {
            setSpec(data);
            setFetchError(null);
            return;
          }
        } catch {
          // try next source
        }
      }
      if (!cancelled) {
        setFetchError('Failed to load API specification from all sources.');
      }
    };
    fetchSpec().finally(() => { if (!cancelled) setIsChecking(false); });
    return () => { cancelled = true; };
  }, [retryCount]);

  const handleDownload = async (format: 'json' | 'yaml') => {
    if (!spec) return;
    setLoading(true);
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'yaml') {
        content = yaml.dump(spec);
        filename = 'kang-openbanking-api.yaml';
        mimeType = 'text/yaml';
      } else {
        content = JSON.stringify(spec, null, 2);
        filename = 'kang-openbanking-api.json';
        mimeType = 'application/json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download Started',
        description: `API specification downloaded as ${filename}`,
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download API specification',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>API Explorer — Kang Open Banking | Swagger UI</title>
        <meta name="description" content="Interactive API Explorer for Kang Open Banking. Test 326+ endpoints for payments, accounts, transfers, and open banking services in Cameroon and CEMAC region." />
        <meta property="og:title" content="Kang Open Banking API Explorer" />
        <meta property="og:description" content="Interactive Swagger UI documentation for the KOB payment gateway and open banking platform." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/api-explorer" />
      </Helmet>
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20" data-testid="api-explorer-container">
    <div className="container mx-auto px-4 py-10 max-w-7xl">
      {/* Hero Header */}
      <div className="mb-10 rounded-2xl border bg-card/50 backdrop-blur-sm p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                <Sparkles className="h-3 w-3" />
                Interactive
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">v4.16.4</Badge>
              {!isChecking && spec && (
                <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Spec loaded
                </Badge>
              )}
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">API Explorer</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Interactive documentation powered by Swagger UI. Authenticate, browse 326+ endpoints, and execute live requests directly from your browser.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Base URL</span>
              <code className="text-xs font-mono text-foreground/80">api.kangopenbanking.com</code>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        {fetchError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}

        {/* OAuth Authentication Guide */}
        <Collapsible open={authGuideOpen} onOpenChange={setAuthGuideOpen} className="mb-6">
          <CollapsibleTrigger asChild>
            <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group">
              <CardHeader className="py-5">
                <CardTitle className="flex items-center gap-3 text-base">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <div className="font-semibold">How to Authenticate</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">Get your Access Token, Client ID & Secret in 3 steps</div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${authGuideOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="border-t-0 rounded-t-none -mt-1">
              <CardContent className="pt-6 space-y-8">
                {/* Step 1 */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">1</span>
                    Register a TPP Application (Get Client ID & Secret)
                  </h4>
                  <p className="text-sm text-muted-foreground ml-9">
                    Navigate to the <strong>Developer Portal → Sandbox & Testing</strong> section and register a new Third Party Provider (TPP) application.
                    Upon registration, you will receive:
                  </p>
                  <ul className="list-disc list-inside ml-9 text-sm text-muted-foreground space-y-1">
                    <li><strong>Client ID</strong> — A unique identifier for your application (e.g., <code className="bg-muted px-1.5 py-0.5 rounded text-xs">kob_client_xxxxxxxx</code>)</li>
                    <li><strong>Client Secret</strong> — A private key used for server-to-server authentication. Keep this secure and never expose it in frontend code.</li>
                  </ul>
                  <p className="text-sm text-muted-foreground ml-9">
                    Alternatively, use the DCR (Dynamic Client Registration) endpoint: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">POST /v1/dcr/register</code>
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">2</span>
                    Obtain an Access Token
                  </h4>
                  <p className="text-sm text-muted-foreground ml-9">
                    Exchange your credentials for a Bearer token using one of these grant types:
                  </p>
                  <div className="ml-9 rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden shadow-lg">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#161b22]">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Client Credentials (Server-to-Server)</span>
                      <div className="flex gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                      </div>
                    </div>
                    <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-100 leading-relaxed">{`POST /functions/v1/oauth-token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&scope=accounts+payments`}</pre>
                  </div>
                  <div className="ml-9 rounded-xl border border-white/10 bg-[#0d1117] overflow-hidden mt-3 shadow-lg">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-[#161b22]">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Successful Response</span>
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">200 OK</Badge>
                    </div>
                    <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-100 leading-relaxed">{`{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "accounts payments"
}`}</pre>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">3</span>
                    Authorize in Swagger UI
                  </h4>
                  <p className="text-sm text-muted-foreground ml-9">
                    Click the <strong>Authorize</strong> button at the top of Swagger UI and enter your credentials:
                  </p>
                  <ul className="list-disc list-inside ml-9 text-sm text-muted-foreground space-y-1">
                    <li><strong>bearerAuth:</strong> Paste the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">access_token</code> value from the response above</li>
                    <li><strong>oauth2:</strong> Enter your <code className="bg-muted px-1.5 py-0.5 rounded text-xs">client_id</code> and <code className="bg-muted px-1.5 py-0.5 rounded text-xs">client_secret</code>, select scopes, and click Authorize to start the OAuth flow</li>
                  </ul>
                </div>

                {/* Key URLs */}
                <div className="space-y-3 pt-2 border-t">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    Key OAuth Endpoints
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { label: 'Authorization', path: '/functions/v1/oauth-authorize' },
                      { label: 'Token', path: '/functions/v1/oauth-token' },
                      { label: 'DCR Register', path: '/functions/v1/dcr-register' },
                      { label: 'OIDC Discovery', path: '/functions/v1/oidc-config' },
                    ].map((ep) => (
                      <div key={ep.label} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors">
                        <code className="bg-[#0d1117] text-emerald-400 px-2 py-1 rounded text-[11px] font-mono border border-white/10 shrink-0">{ep.label}</code>
                        <code className="text-xs text-muted-foreground font-mono truncate">{ep.path}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex gap-3 flex-wrap">
          <Button
            onClick={() => handleDownload('json')}
            variant="outline"
            disabled={loading || isChecking || !spec}
            className="shadow-sm hover:shadow-md transition-all"
          >
            <Download className="mr-2 h-4 w-4" />
            Download OpenAPI JSON
          </Button>
          <Button
            onClick={() => handleDownload('yaml')}
            variant="outline"
            disabled={loading || isChecking || !spec}
            className="shadow-sm hover:shadow-md transition-all"
          >
            <Download className="mr-2 h-4 w-4" />
            Download OpenAPI YAML
          </Button>
          <Button variant="outline" asChild disabled={isChecking} className="shadow-sm hover:shadow-md transition-all">
            <a
              href={`https://editor.swagger.io/?url=${encodeURIComponent(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api-spec`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Swagger Editor
            </a>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden swagger-container border shadow-lg rounded-xl">
        {isChecking ? (
          <div className="p-16 text-center space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
            <p className="text-muted-foreground">Loading API specification…</p>
          </div>
        ) : spec ? (
          <SwaggerUI
            spec={spec}
            docExpansion="list"
            deepLinking={true}
            displayOperationId={true}
            filter={true}
            tryItOutEnabled={true}
          />
        ) : (
          <div className="p-12 text-center space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-muted-foreground">Failed to load API specification.</p>
            <Button variant="outline" onClick={() => setRetryCount(c => c + 1)}>
              <Terminal className="mr-2 h-4 w-4" /> Retry Loading Spec
            </Button>
            <p className="text-xs text-muted-foreground">
              Or view the <a href="/developer/api-explorer-static" className="text-primary underline">static API reference</a> instead.
            </p>
          </div>
        )}
      </Card>

      {/* SSR/Static fallback: visible content for crawlers, non-JS environments, and screen readers */}
      <noscript>
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <h2 className="text-2xl font-bold mb-4">Kang Open Banking API — Quick Reference</h2>
          <p className="mb-6 text-muted-foreground">
            This page requires JavaScript for the interactive Swagger UI explorer. 
            You can access the full API specification directly:
          </p>
          <ul className="list-disc list-inside space-y-2 mb-8">
            <li><a href="/openapi.json" className="text-primary underline">Download OpenAPI JSON</a></li>
            <li><a href="/openapi.yaml" className="text-primary underline">Download OpenAPI YAML</a></li>
            <li><a href="/openapi-sandbox.json" className="text-primary underline">Sandbox OpenAPI JSON</a></li>
            <li><a href="/developer/redoc" className="text-primary underline">Static API Reference (Redoc)</a></li>
            <li><a href="/developer/redoc-sandbox" className="text-primary underline">Sandbox API Reference (Redoc)</a></li>
          </ul>
          <h3 className="text-xl font-semibold mb-3">Key API Domains</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>/v1/accounts</strong> — Account management (AISP)</li>
            <li><strong>/v1/payments</strong> — Payment initiation (PISP)</li>
            <li><strong>/v1/gateway/charges</strong> — Payment gateway charges</li>
            <li><strong>/v1/gateway/payouts</strong> — Disbursements &amp; payouts</li>
            <li><strong>/v1/gateway/merchants</strong> — Merchant lifecycle &amp; KYB</li>
            <li><strong>/v1/gateway/subscriptions</strong> — Recurring billing</li>
            <li><strong>/v1/gateway/refunds</strong> — Refund processing</li>
            <li><strong>/v1/gateway/disputes</strong> — Dispute management</li>
            <li><strong>/v1/webhooks</strong> — Webhook management</li>
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            API Version: v4.2.0 · Default currency: XAF · 326+ operations
          </p>
        </div>
      </noscript>
    
      <AutoDocNavigation />
</div>
    </>
  );
};

export default ApiExplorer;
