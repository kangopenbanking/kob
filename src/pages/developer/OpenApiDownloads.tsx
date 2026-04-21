import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import SpecDownloads from '@/components/developer/SpecDownloads';

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
