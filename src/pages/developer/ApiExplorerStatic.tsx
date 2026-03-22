import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileJson, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import yaml from 'js-yaml';

interface PathOperation {
  method: string;
  path: string;
  summary: string;
  operationId?: string;
  tags?: string[];
}

const ApiExplorerStatic = () => {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [operations, setOperations] = useState<PathOperation[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('all');

  useEffect(() => {
    fetch('/openapi.json')
      .then(r => r.json())
      .then(data => {
        setSpec(data);
        const ops: PathOperation[] = [];
        for (const [path, methods] of Object.entries(data.paths || {})) {
          for (const [method, op] of Object.entries(methods as any)) {
            if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
              ops.push({
                method: method.toUpperCase(),
                path,
                summary: (op as any).summary || (op as any).description || '',
                operationId: (op as any).operationId,
                tags: (op as any).tags || ['Untagged'],
              });
            }
          }
        }
        setOperations(ops);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const allTags = ['all', ...Array.from(new Set(operations.flatMap(o => o.tags || ['Untagged'])))];
  const filtered = selectedTag === 'all' ? operations : operations.filter(o => o.tags?.includes(selectedTag));

  const methodColor: Record<string, string> = {
    GET: 'bg-blue-500/10 text-blue-700 border-blue-200',
    POST: 'bg-green-500/10 text-green-700 border-green-200',
    PUT: 'bg-amber-500/10 text-amber-700 border-amber-200',
    DELETE: 'bg-red-500/10 text-red-700 border-red-200',
    PATCH: 'bg-purple-500/10 text-purple-700 border-purple-200',
  };

  const handleDownload = (format: 'json' | 'yaml') => {
    if (!spec) return;
    const content = format === 'yaml' ? yaml.dump(spec) : JSON.stringify(spec, null, 2);
    const blob = new Blob([content], { type: format === 'yaml' ? 'text/yaml' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kang-openbanking-api.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* SEO-friendly noscript fallback */}
      <noscript>
        <div>
          <h1>Kang Open Banking API Reference</h1>
          <p>Download the full API specification:</p>
          <ul>
            <li><a href="/openapi.json">OpenAPI JSON</a></li>
            <li><a href="/openapi.yaml">OpenAPI YAML</a></li>
            <li><a href="/openapi-sandbox.json">Sandbox OpenAPI JSON</a></li>
          </ul>
        </div>
      </noscript>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">API Reference (Static)</h1>
          <p className="text-muted-foreground mt-1">
            {spec?.info?.title} — {spec?.info?.version} · {operations.length} endpoints
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleDownload('json')}>
            <Download className="h-4 w-4 mr-1" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownload('yaml')}>
            <Download className="h-4 w-4 mr-1" /> YAML
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/developer/redoc">
              <ExternalLink className="h-4 w-4 mr-1" /> Redoc Docs
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/developer/api-explorer">
              <ExternalLink className="h-4 w-4 mr-1" /> Interactive Explorer
            </a>
          </Button>
        </div>
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap gap-2">
        {allTags.map(tag => (
          <Badge
            key={tag}
            variant={selectedTag === tag ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSelectedTag(tag)}
          >
            {tag === 'all' ? `All (${operations.length})` : tag}
          </Badge>
        ))}
      </div>

      {/* Endpoints list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Endpoints ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-1">
              {filtered.map((op, i) => (
                <div
                  key={`${op.method}-${op.path}-${i}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                >
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs w-16 justify-center ${methodColor[op.method] || ''}`}
                  >
                    {op.method}
                  </Badge>
                  <code className="text-sm font-mono flex-1">{op.path}</code>
                  <span className="text-sm text-muted-foreground max-w-[300px] truncate">
                    {op.summary}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Server info */}
      {spec?.servers && (
        <Card>
          <CardHeader>
            <CardTitle>Servers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {spec.servers.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <Badge variant="outline">{s.description || 'Server'}</Badge>
                  <code className="text-sm">{s.url}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ApiExplorerStatic;
