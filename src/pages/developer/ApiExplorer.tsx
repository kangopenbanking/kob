import { useState, useEffect } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Download, AlertCircle, Key, ShieldCheck, Terminal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import yaml from 'js-yaml';

const ApiExplorer = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [effectiveUrl, setEffectiveUrl] = useState<string>('');
  const [usingFallback, setUsingFallback] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [authGuideOpen, setAuthGuideOpen] = useState(false);
  
  const primaryUrl = 'https://api.kangopenbanking.com/functions/v1/public-api-spec';
  const fallbackUrl = 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/public-api-spec';

  useEffect(() => {
    const checkUrl = async () => {
      try {
        const response = await fetch(primaryUrl, { method: 'HEAD' });
        if (response.ok) {
          setEffectiveUrl(primaryUrl);
          setUsingFallback(false);
        } else {
          throw new Error('Primary URL not accessible');
        }
      } catch (error) {
        console.log('Primary URL failed, using fallback:', error);
        setEffectiveUrl(fallbackUrl);
        setUsingFallback(true);
      } finally {
        setIsChecking(false);
      }
    };
    checkUrl();
  }, [primaryUrl, fallbackUrl]);

  const handleDownload = async (format: 'json' | 'yaml') => {
    setLoading(true);
    try {
      const response = await fetch(effectiveUrl);
      if (!response.ok) throw new Error('Failed to fetch API spec');
      const spec = await response.json();
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">API Explorer</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Interactive documentation powered by Swagger UI. Test endpoints directly from your browser.
        </p>

        {usingFallback && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Using fallback API endpoint. Custom domain routing is being configured.
            </AlertDescription>
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
                    Click the <strong>Authorize 🔓</strong> button at the top of Swagger UI and enter your credentials:
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
            disabled={loading || isChecking}
          >
            <Download className="mr-2 h-4 w-4" />
            Download OpenAPI JSON
          </Button>
          <Button
            onClick={() => handleDownload('yaml')}
            variant="outline"
            disabled={loading || isChecking}
          >
            <Download className="mr-2 h-4 w-4" />
            Download OpenAPI YAML
          </Button>
          <Button variant="outline" asChild disabled={isChecking}>
            <a
              href={effectiveUrl ? `https://editor.swagger.io/?url=${encodeURIComponent(effectiveUrl)}` : '#'}
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
            Checking API availability...
          </div>
        ) : (
          <SwaggerUI
            url={effectiveUrl}
            docExpansion="list"
            deepLinking={true}
            displayOperationId={true}
            filter={true}
            tryItOutEnabled={true}
          />
        )}
      </Card>
    </div>
  );
};

export default ApiExplorer;
