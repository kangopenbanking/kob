import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Copy, FileJson, FileText, FileCode, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

type SpecEnv = 'Production' | 'Sandbox';
type SpecKind = 'JSON' | 'YAML' | 'APIs.json';

interface SpecEntry {
  label: string;
  path: string;
  kind: SpecKind;
  env: SpecEnv;
}

const SPECS: SpecEntry[] = [
  { label: 'OpenAPI JSON',  path: '/openapi.json',          kind: 'JSON',      env: 'Production' },
  { label: 'OpenAPI YAML',  path: '/openapi.yaml',          kind: 'YAML',      env: 'Production' },
  { label: 'APIs.json',     path: '/apis.json',             kind: 'APIs.json', env: 'Production' },
  { label: 'OpenAPI JSON',  path: '/openapi-sandbox.json',  kind: 'JSON',      env: 'Sandbox' },
  { label: 'OpenAPI YAML',  path: '/openapi-sandbox.yaml',  kind: 'YAML',      env: 'Sandbox' },
  { label: 'APIs.json',     path: '/apis-sandbox.json',     kind: 'APIs.json', env: 'Sandbox' },
];

const ICONS: Record<SpecKind, typeof FileJson> = {
  JSON: FileJson,
  YAML: FileText,
  'APIs.json': FileCode,
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

interface SpecDownloadsProps {
  /** Restrict to one environment, or show both (default) */
  env?: SpecEnv | 'All';
  /** Compact mode skips the descriptive header card */
  compact?: boolean;
}

const SpecDownloads = ({ env = 'All', compact = false }: SpecDownloadsProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [sizes, setSizes] = useState<Record<string, string>>({});

  const visible = SPECS.filter((s) => env === 'All' || s.env === env);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      visible.map(async (s) => {
        try {
          const r = await fetch(s.path, { method: 'HEAD' });
          const len = r.headers.get('content-length');
          return [s.path, len ? formatBytes(parseInt(len, 10)) : ''] as const;
        } catch {
          return [s.path, ''] as const;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      pairs.forEach(([k, v]) => { if (v) map[k] = v; });
      setSizes(map);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  const copyUrl = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    setCopied(path);
    toast({ title: 'URL copied', description: url });
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className="space-y-4" data-testid="spec-downloads">
      {!compact && (
        <div>
          <h2 className="text-xl font-semibold">Download API specifications</h2>
          <p className="text-sm text-muted-foreground mt-1">
            One-click downloads of the OpenAPI 3.1 specification and APIs.json discovery
            documents. Use with Swagger UI, Redoc, Postman, Insomnia, or any
            OpenAPI-compatible toolchain.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((s) => {
          const Icon = ICONS[s.kind];
          const id = `spec-dl-${s.env.toLowerCase()}-${s.kind.toLowerCase().replace(/\W/g, '')}`;
          return (
            <Card key={s.path} className="transition-shadow hover:shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-foreground/70" />
                  <span className="truncate">{s.label}</span>
                  <Badge
                    variant="outline"
                    className="ml-auto text-[10px] uppercase tracking-wide"
                  >
                    {s.env}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <code className="block text-[11px] bg-muted/60 px-2 py-1 rounded font-mono truncate text-foreground/80">
                  {s.path}
                </code>
                {sizes[s.path] && (
                  <p className="text-[11px] text-muted-foreground">{sizes[s.path]}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" asChild data-testid={id}>
                    <a href={s.path} download>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyUrl(s.path)}
                    aria-label={`Copy URL for ${s.label}`}
                  >
                    {copied === s.path ? (
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Copy URL
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SpecDownloads;
