import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, AlertCircle, Key, ShieldCheck, Terminal, Sparkles, ChevronDown, Lock, Unlock, CheckCircle2, Code2, Server } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [authStatus, setAuthStatus] = useState<'checking' | 'ready' | 'missing'>('checking');

  // Real-time OAuth/token readiness detection (visual only — no logic change)
  useEffect(() => {
    const detect = () => {
      try {
        const keys = ['kob_access_token', 'access_token', 'swagger_authorized', 'authorized'];
        const hasToken = keys.some((k) => {
          const v = localStorage.getItem(k) || sessionStorage.getItem(k);
          return v && v.length > 8;
        });
        const swaggerAuth = document.querySelector('.swagger-ui .auth-wrapper .authorize.unlocked');
        setAuthStatus(hasToken || swaggerAuth ? 'ready' : 'missing');
      } catch {
        setAuthStatus('missing');
      }
    };
    detect();
    const interval = setInterval(detect, 2000);
    const onStorage = () => detect();
    window.addEventListener('storage', onStorage);
    return () => { clearInterval(interval); window.removeEventListener('storage', onStorage); };
  }, []);

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
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Backend Base URL</span>
              <code className="text-xs font-mono text-foreground/80 max-w-[280px] truncate" title={API_CONFIG.BASE_URL}>{API_CONFIG.BASE_URL}</code>
            </div>
          </div>
        </div>

        {/* Real-time OAuth / Credentials Status Banner */}
        <div
          className={`mt-6 flex items-center gap-3 rounded-xl border p-4 transition-colors ${
            authStatus === 'ready'
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : authStatus === 'missing'
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-border bg-muted/30'
          }`}
          role="status"
          aria-live="polite"
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              authStatus === 'ready'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : authStatus === 'missing'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {authStatus === 'ready' ? <Unlock className="h-5 w-5" /> : authStatus === 'missing' ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">
                {authStatus === 'ready' ? 'Authenticated — ready to send live requests' : authStatus === 'missing' ? 'Not authenticated — read-only mode' : 'Checking credentials…'}
              </p>
              {authStatus === 'ready' && (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Token detected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {authStatus === 'ready'
                ? 'Your bearer token is active in this session. Try-it-out requests will use your credentials.'
                : authStatus === 'missing'
                ? 'Click the Authorize button in Swagger UI below, or follow the 3-step guide to obtain an Access Token.'
                : 'Verifying your session token and OAuth state.'}
            </p>
          </div>
          {authStatus === 'missing' && (
            <Button size="sm" variant="outline" onClick={() => setAuthGuideOpen(true)} className="shrink-0 hidden sm:inline-flex">
              <Key className="mr-2 h-3.5 w-3.5" /> Get Token
            </Button>
          )}
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

      {/* Expected Response Examples Panel — visual quick reference */}
      <Card className="mb-6 border shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="py-4 border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Code2 className="h-4 w-4 text-primary" />
            Expected Responses
            <Badge variant="outline" className="ml-2 text-[10px] font-normal">Quick preview</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x">
            {[
              {
                code: '200',
                label: 'OK — Success',
                tone: 'emerald',
                body: `{
  "status": "success",
  "data": {
    "id": "txn_01HXYZ...",
    "amount": "5000",
    "currency": "XAF"
  }
}`,
              },
              {
                code: '201',
                label: 'Created',
                tone: 'sky',
                body: `{
  "status": "created",
  "resource_id": "pay_01HXYZ...",
  "created_at": "2026-04-21T10:00:00Z"
}`,
              },
              {
                code: '401',
                label: 'Unauthorized',
                tone: 'amber',
                body: `{
  "type": "https://kangopenbanking.com/errors/unauthorized",
  "title": "Invalid or expired token",
  "status": 401
}`,
              },
            ].map((ex) => (
              <div key={ex.code} className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      ex.tone === 'emerald'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono'
                        : ex.tone === 'sky'
                        ? 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono'
                    }
                  >
                    {ex.code}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">{ex.label}</span>
                </div>
                <pre className="rounded-lg border bg-muted/40 p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-foreground/90">{ex.body}</pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden swagger-container border shadow-lg rounded-xl">
        {/* Branded Swagger toolbar header */}
        <div className="flex items-center justify-between gap-3 border-b bg-card px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Server className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight">Kang Open Banking</span>
                <Badge variant="outline" className="text-[10px] font-mono">REST · v1</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">Interactive reference · powered by Swagger UI</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {spec && (
              <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] font-mono max-w-[260px] truncate" title={API_CONFIG.BASE_URL}>
              {API_CONFIG.BASE_URL.replace(/^https?:\/\//, '')}
            </Badge>
          </div>
        </div>

        {isChecking ? (
          <div className="p-10 space-y-6">
            <div className="flex items-center justify-center flex-col gap-3 py-6">
              <div className="relative inline-flex h-14 w-14 items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-medium text-sm">Loading API specification</p>
                <p className="text-xs text-muted-foreground">Fetching 326+ endpoints from the backend…</p>
              </div>
            </div>
            <div className="space-y-3 max-w-2xl mx-auto">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-11/12 rounded-lg" />
              <Skeleton className="h-10 w-10/12 rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
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
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Unable to load API specification</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                We couldn't reach the spec endpoint. Check your network or retry — the backend may be warming up.
              </p>
            </div>
            <Button variant="outline" onClick={() => setRetryCount(c => c + 1)} className="shadow-sm hover:shadow-md transition-all">
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
    </div>
    </>
  );
};

export default ApiExplorer;
