import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HealthCheck {
  name: string;
  url: string;
  status: 'checking' | 'pass' | 'fail';
  details?: string;
  responseTime?: number;
}

const DocsHealth = () => {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [running, setRunning] = useState(false);

  const endpoints = [
    { name: 'OpenAPI JSON (Prod)', url: '/openapi.json' },
    { name: 'OpenAPI YAML (Prod)', url: '/openapi.yaml' },
    { name: 'OpenAPI JSON (Sandbox)', url: '/openapi-sandbox.json' },
    { name: 'OpenAPI YAML (Sandbox)', url: '/openapi-sandbox.yaml' },
    { name: 'API Explorer', url: '/developer/api-explorer' },
    { name: 'Swagger (alias)', url: '/developer/swagger' },
    { name: 'OpenAPI Downloads', url: '/developer/openapi' },
    { name: 'Static Reference', url: '/developer/api-explorer-static' },
    { name: 'Redoc Docs', url: '/developer/redoc' },
    { name: 'Redoc Reference (alias)', url: '/developer/reference' },
    { name: 'Developer Portal', url: '/developer' },
  ];

  const runChecks = async () => {
    setRunning(true);
    const results: HealthCheck[] = endpoints.map(e => ({ ...e, status: 'checking' as const }));
    setChecks([...results]);

    for (let i = 0; i < results.length; i++) {
      const start = Date.now();
      try {
        const r = await fetch(results[i].url, { method: 'HEAD' });
        results[i].responseTime = Date.now() - start;
        if (r.ok) {
          results[i].status = 'pass';
          results[i].details = `${r.status} OK — ${results[i].responseTime}ms`;
        } else {
          results[i].status = 'fail';
          results[i].details = `HTTP ${r.status}`;
        }
      } catch (err) {
        results[i].status = 'fail';
        results[i].responseTime = Date.now() - start;
        results[i].details = 'Network error';
      }
      setChecks([...results]);
    }

    // Validate JSON spec content
    try {
      const specRes = await fetch('/openapi.json');
      const spec = await specRes.json();
      const pathCount = Object.keys(spec.paths || {}).length;
      const idx = results.findIndex(r => r.name === 'OpenAPI JSON (Prod)');
      if (idx >= 0) {
        results[idx].details += ` — v${spec.info?.version} — ${pathCount} paths`;
        if (!spec.openapi || !spec.info || !spec.paths || pathCount < 10) {
          results[idx].status = 'fail';
          results[idx].details += ' — INVALID: missing required fields';
        }
      }
    } catch { /* already marked fail */ }

    setChecks([...results]);
    setRunning(false);
  };

  useEffect(() => { runChecks(); }, []);

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentation Health</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Checks that all spec endpoints and documentation pages are accessible.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runChecks} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-1 ${running ? 'animate-spin' : ''}`} /> Re-check
        </Button>
      </div>

      {checks.length > 0 && !running && (
        <div className="flex gap-2">
          <Badge variant={failCount === 0 ? 'default' : 'destructive'}>
            {failCount === 0 ? 'All Healthy' : `${failCount} Failed`}
          </Badge>
          <Badge variant="outline">{passCount}/{checks.length} Passing</Badge>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Endpoint Checks</CardTitle></CardHeader>
        <CardContent className="space-y-2" data-testid="docs-health-results">
          {checks.map(c => (
            <div key={c.name} className="flex items-center gap-3 p-3 rounded-lg border">
              {c.status === 'checking' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              {c.status === 'pass' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
              {c.status === 'fail' && <XCircle className="h-5 w-5 text-red-600" />}
              <div className="flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                <code className="text-xs text-muted-foreground">{c.url}</code>
              </div>
              {c.details && (
                <span className="text-xs text-muted-foreground">{c.details}</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Quick Verification (curl)</CardTitle></CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">{`# Verify spec endpoints
curl -s -o /dev/null -w "%{http_code}" https://kangopenbanking.com/openapi.json
curl -s -o /dev/null -w "%{http_code}" https://kangopenbanking.com/openapi.yaml
curl -s -o /dev/null -w "%{http_code}" https://kangopenbanking.com/openapi-sandbox.json

# Validate JSON structure
curl -s https://kangopenbanking.com/openapi.json | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(f'Version: {d[\"info\"][\"version\"]}')
print(f'Paths: {len(d[\"paths\"])}')
print('Valid: OK' if d.get('openapi') and d.get('paths') else 'INVALID')
"

# Check docs pages return content
curl -s https://kangopenbanking.com/developer/redoc | head -50
curl -s https://kangopenbanking.com/developer/api-explorer-static | head -50`}</pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocsHealth;
