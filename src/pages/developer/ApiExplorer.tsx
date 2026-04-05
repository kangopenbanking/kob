import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, AlertCircle, Key, ShieldCheck, Terminal } from 'lucide-react';
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

  useEffect(() => {
    const fetchSpec = async () => {
      // Try static file first, then edge function fallback
      const sources = [
        '/openapi.json',
        `${API_CONFIG.BASE_URL_FALLBACK}/public-api-spec`,
        `${API_CONFIG.BASE_URL}/public-api-spec`,
      ];
      for (const url of sources) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          if (data?.openapi || data?.info) {
            setSpec(data);
            setFetchError(null);
            return;
          }
        } catch {
          // try next source
        }
      }
      setFetchError('Failed to load API specification. Please try again later.');
    };
    fetchSpec().finally(() => setIsChecking(false));
  }, []);

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
    <div className="container mx-auto px-4 py-8" data-testid="api-explorer-container">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">API Explorer</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Interactive documentation powered by Swagger UI. Test endpoints directly from your browser.
        </p>

        {fetchError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}

        {/* OAuth Authentication Guide */}
        <Collapsible open={authGuideOpen} onOpenChange={setAuthGuideOpen} className="mb-6">
          <CollapsibleTrigger asChild>
            <Card className="cursor-pointer hover:border-primary/50 transition-colors">
              <CardHeader className="py-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  How to Authenticate — Get your Access Token, Client ID & Secret
                  <span className="ml-auto text-xs text-muted-foreground">{authGuideOpen ? 'Collapse' : 'Expand'}</span>
                </CardTitle>
              </CardHeader>
            </Card>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="border-t-0 rounded-t-none -mt-1">
              <CardContent className="pt-4 space-y-6">
                {/* Step 1 */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                    Register a TPP Application (Get Client ID & Secret)
                  </h4>
                  <p className="text-sm text-muted-foreground ml-8">
                    Navigate to the <strong>Developer Portal → Sandbox & Testing</strong> section and register a new Third Party Provider (TPP) application.
                    Upon registration, you will receive:
                  </p>
                  <ul className="list-disc list-inside ml-8 text-sm text-muted-foreground space-y-1">
                    <li><strong>Client ID</strong> — A unique identifier for your application (e.g., <code className="bg-muted px-1 rounded">kob_client_xxxxxxxx</code>)</li>
                    <li><strong>Client Secret</strong> — A private key used for server-to-server authentication. Keep this secure and never expose it in frontend code.</li>
                  </ul>
                  <p className="text-sm text-muted-foreground ml-8">
                    Alternatively, use the DCR (Dynamic Client Registration) endpoint: <code className="bg-muted px-1 rounded">POST /v1/dcr/register</code>
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                    Obtain an Access Token
                  </h4>
                  <p className="text-sm text-muted-foreground ml-8">
                    Exchange your credentials for a Bearer token using one of these grant types:
                  </p>
                  <div className="ml-8 rounded-lg border border-white/10 bg-[#0d1117] overflow-hidden">
                    <div className="px-4 py-2 border-b border-white/10 bg-gray-900">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Client Credentials (Server-to-Server)</span>
                    </div>
                    <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-100">{`POST /functions/v1/oauth-token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&scope=accounts+payments`}</pre>
                  </div>
                  <div className="ml-8 rounded-lg border border-white/10 bg-[#0d1117] overflow-hidden mt-3">
                    <div className="px-4 py-2 border-b border-white/10 bg-gray-900">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Successful Response</span>
                    </div>
                    <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-100">{`{
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
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                    Authorize in Swagger UI
                  </h4>
                  <p className="text-sm text-muted-foreground ml-8">
                    Click the <strong>Authorize</strong> button at the top of Swagger UI and enter your credentials:
                  </p>
                  <ul className="list-disc list-inside ml-8 text-sm text-muted-foreground space-y-1">
                    <li><strong>bearerAuth:</strong> Paste the <code className="bg-muted px-1 rounded">access_token</code> value from the response above</li>
                    <li><strong>oauth2:</strong> Enter your <code className="bg-muted px-1 rounded">client_id</code> and <code className="bg-muted px-1 rounded">client_secret</code>, select scopes, and click Authorize to start the OAuth flow</li>
                  </ul>
                </div>

                {/* Key URLs */}
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Key OAuth Endpoints
                  </h4>
                  <div className="ml-8 grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <code className="bg-[#0d1117] text-green-400 px-2 py-1 rounded text-xs border border-white/10">Authorization</code>
                      <code className="text-muted-foreground">/functions/v1/oauth-authorize</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-[#0d1117] text-green-400 px-2 py-1 rounded text-xs border border-white/10">Token</code>
                      <code className="text-muted-foreground">/functions/v1/oauth-token</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-[#0d1117] text-green-400 px-2 py-1 rounded text-xs border border-white/10">DCR Register</code>
                      <code className="text-muted-foreground">/functions/v1/dcr-register</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-[#0d1117] text-green-400 px-2 py-1 rounded text-xs border border-white/10">OIDC Discovery</code>
                      <code className="text-muted-foreground">/functions/v1/oidc-config</code>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex gap-4 flex-wrap">
          <Button
            onClick={() => handleDownload('json')}
            variant="outline"
            disabled={loading || isChecking || !spec}
          >
            <Download className="mr-2 h-4 w-4" />
            Download OpenAPI JSON
          </Button>
          <Button
            onClick={() => handleDownload('yaml')}
            variant="outline"
            disabled={loading || isChecking || !spec}
          >
            <Download className="mr-2 h-4 w-4" />
            Download OpenAPI YAML
          </Button>
          <Button variant="outline" asChild disabled={isChecking}>
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

      <Card className="overflow-hidden swagger-container">
        {isChecking ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading API specification...
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
          <div className="p-8 text-center text-muted-foreground">
            Failed to load API specification. Please refresh the page.
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
