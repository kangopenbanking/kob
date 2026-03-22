import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Copy, ExternalLink, FileJson, FileText, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { API_CONFIG } from '@/config/api';

const specs = [
  { label: 'Production JSON', path: API_CONFIG.OPENAPI_JSON, format: 'JSON', env: 'Production', icon: FileJson },
  { label: 'Production YAML', path: API_CONFIG.OPENAPI_YAML, format: 'YAML', env: 'Production', icon: FileText },
  { label: 'Sandbox JSON', path: API_CONFIG.OPENAPI_SANDBOX_JSON, format: 'JSON', env: 'Sandbox', icon: FileJson },
  { label: 'Sandbox YAML', path: API_CONFIG.OPENAPI_SANDBOX_YAML, format: 'YAML', env: 'Sandbox', icon: FileText },
];

const OpenApiDownloads = () => {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyUrl = (path: string, id: string) => {
    navigator.clipboard.writeText(`${API_CONFIG.SITE_URL}${path}`);
    setCopiedId(id);
    toast({ title: 'Copied!', description: 'URL copied to clipboard' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <Helmet>
        <title>OpenAPI Specification Downloads — Kang Open Banking</title>
        <meta name="description" content="Download the Kang Open Banking OpenAPI specification in JSON or YAML format for production and sandbox environments." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/openapi" />
      </Helmet>

      <div className="max-w-4xl mx-auto p-6 space-y-8" data-testid="openapi-downloads-page">
        <div>
          <h1 className="text-3xl font-bold">OpenAPI Specification</h1>
          <p className="text-muted-foreground mt-2">
            Download or link to the Kang Open Banking API specification. Use these files with Swagger UI, Redoc, Postman, or any OpenAPI-compatible tool.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {specs.map((s) => (
            <Card key={s.path}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <s.icon className="h-5 w-5 text-primary" />
                  {s.label}
                  <Badge variant={s.env === 'Production' ? 'default' : 'outline'} className="ml-auto text-xs">
                    {s.env}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <code className="block text-xs bg-muted p-2 rounded font-mono truncate">{s.path}</code>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild data-testid={`spec-download-${s.format.toLowerCase()}-${s.env.toLowerCase()}`}>
                    <a href={s.path} download>
                      <Download className="h-4 w-4 mr-1" /> Download
                    </a>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => copyUrl(s.path, s.path)}>
                    {copiedId === s.path ? <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" /> : <Copy className="h-4 w-4 mr-1" />}
                    Copy URL
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
