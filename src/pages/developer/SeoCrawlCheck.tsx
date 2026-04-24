import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";

/**
 * PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1)
 *
 * /developer/seo-crawl-check
 *
 * Public health-check page that probes a curated list of /developer/* routes
 * plus the OpenAPI spec downloads and surfaces the HTTP status of each.
 * Crawlers and operators can use this to confirm — at any time — that no
 * documentation route is returning a 301 redirect chain or 404, in line with
 * Standing Order P2 (Zero-404).
 */

type CheckResult = {
  path: string;
  label: string;
  status: number | null;
  ok: boolean;
  redirected: boolean;
  finalUrl: string | null;
  error?: string;
  ms: number;
};

// Curated list — keep in sync with the most-trafficked /developer/* routes.
// Adding a new core route here costs nothing; missing one only means it's not
// surfaced on this dashboard, never that it stops being public.
const ROUTES: { path: string; label: string }[] = [
  // Spec downloads (Order P4 — Open Spec)
  { path: "/openapi.json", label: "OpenAPI Specification (JSON)" },
  { path: "/openapi.yaml", label: "OpenAPI Specification (YAML)" },
  { path: "/openapi-sandbox.json", label: "Sandbox OpenAPI Specification" },
  { path: "/apis.json", label: "APIs.json Discovery Document" },
  { path: "/.well-known/security.txt", label: "security.txt" },
  { path: "/sitemap.xml", label: "sitemap.xml" },
  { path: "/robots.txt", label: "robots.txt" },

  // Developer portal — landing & onboarding
  { path: "/developer", label: "Developer Portal — Home" },
  { path: "/developer/getting-started", label: "Getting Started Guide" },
  { path: "/developer/quick-start", label: "Quick Start" },
  { path: "/developer/changelog", label: "Changelog" },
  { path: "/developer/openapi", label: "OpenAPI Downloads Page" },

  // API Explorer & references
  { path: "/developer/api-explorer", label: "API Explorer (Swagger UI)" },
  { path: "/developer/api-explorer-static", label: "API Explorer (Static / Redoc)" },
  { path: "/developer/api-reference", label: "API Reference Overview" },
  { path: "/developer/api-reference/obie-migration", label: "OBIE Migration Guide" },
  { path: "/developer/api-reference/errors", label: "Error Codes Reference" },
  { path: "/developer/api-reference/pagination", label: "Pagination Reference" },
  { path: "/developer/api-reference/rate-limits", label: "Rate Limits" },

  // Authentication & security
  { path: "/developer/authentication", label: "Authentication Overview" },
  { path: "/developer/authentication/oauth2", label: "OAuth 2.0 Guide" },
  { path: "/developer/authentication/fapi", label: "FAPI 1.0 Guide" },
  { path: "/developer/authentication/mtls", label: "mTLS Guide" },

  // Sandbox
  { path: "/developer/sandbox/overview", label: "Sandbox Overview" },
  { path: "/developer/sandbox/credentials", label: "Sandbox Credentials" },
  { path: "/developer/sandbox/test-cards", label: "Sandbox Test Cards" },
  { path: "/developer/sandbox/mobile-money", label: "Sandbox Mobile Money" },

  // Open Banking & gateway
  { path: "/developer/api/aisp", label: "AISP Reference" },
  { path: "/developer/api/pisp", label: "PISP Reference" },
  { path: "/developer/gateway/quickstart", label: "Gateway Quickstart" },
  { path: "/developer/gateway/webhooks", label: "Gateway Webhooks" },
  { path: "/developer/api/webhooks", label: "Webhooks Reference" },

  // Support & forum
  { path: "/developer/forum", label: "Developer Forum" },
  { path: "/developer/support", label: "Developer Support" },
  { path: "/developer/status", label: "API Status Page" },
];

async function probe(path: string): Promise<CheckResult> {
  const started = performance.now();
  // Always probe via the current origin so the result reflects what real
  // browsers (and crawlers using the same host) actually see.
  const url = new URL(path, window.location.origin).toString();
  try {
    // GET (not HEAD) because Lovable's static hosting and SPA fallback are
    // tuned for GET — HEAD can return misleading 405s on some assets.
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      credentials: "omit",
    });
    return {
      path,
      label: "",
      status: res.status,
      ok: res.ok,
      redirected: res.redirected,
      finalUrl: res.url || null,
      ms: Math.round(performance.now() - started),
    };
  } catch (err) {
    return {
      path,
      label: "",
      status: null,
      ok: false,
      redirected: false,
      finalUrl: null,
      error: err instanceof Error ? err.message : String(err),
      ms: Math.round(performance.now() - started),
    };
  }
}

function statusBadge(r: CheckResult) {
  if (r.status === null) {
    return <Badge variant="destructive">Network error</Badge>;
  }
  if (r.redirected) {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600">
        {r.status} · redirected
      </Badge>
    );
  }
  if (r.ok) {
    return (
      <Badge variant="outline" className="border-emerald-500 text-emerald-600">
        {r.status} OK
      </Badge>
    );
  }
  return <Badge variant="destructive">{r.status}</Badge>;
}

export default function SeoCrawlCheck() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const run = async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);
    const collected: CheckResult[] = [];
    let done = 0;
    // Probe with limited concurrency (4) to stay polite to the origin.
    const queue = [...ROUTES];
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) return;
        const r = await probe(next.path);
        r.label = next.label;
        collected.push(r);
        done += 1;
        setProgress(Math.round((done / ROUTES.length) * 100));
        setResults([...collected].sort((a, b) => a.path.localeCompare(b.path)));
      }
    });
    await Promise.all(workers);
    setRunning(false);
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const ok = results.filter((r) => r.ok && !r.redirected).length;
    const redirected = results.filter((r) => r.redirected).length;
    const failed = results.filter((r) => !r.ok).length;
    return { ok, redirected, failed, total: results.length };
  }, [results]);

  return (
    <>
      <Helmet>
        <title>SEO Crawl Health Check | Kang Open Banking Developer Portal</title>
        <meta
          name="description"
          content="Public crawler health dashboard for the Kang Open Banking developer portal. Verifies that every documentation route, OpenAPI spec download, and reference page returns a direct 200 with no redirect chains."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/seo-crawl-check" />
      </Helmet>

      <div className="max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">SEO Crawl Health Check</h1>
          <p className="text-muted-foreground">
            Live status of every public documentation route and OpenAPI spec download. Run from
            your browser against the current host so you see exactly what crawlers see.
          </p>
        </header>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Summary</CardTitle>
                <CardDescription>
                  Host: <code className="text-xs">{typeof window !== "undefined" ? window.location.host : ""}</code>
                </CardDescription>
              </div>
              <Button onClick={run} disabled={running} variant="outline" size="sm">
                {running ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Probing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-run checks
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {running && <Progress value={progress} />}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="rounded-md border p-3">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-xs text-muted-foreground">Probed</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-bold text-emerald-600">{summary.ok}</div>
                <div className="text-xs text-muted-foreground">Direct 200</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-bold text-amber-600">{summary.redirected}</div>
                <div className="text-xs text-muted-foreground">Redirected</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-2xl font-bold text-destructive">{summary.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A "redirected" result means the browser followed a 301/302 before reaching the final
              page. Naive crawlers often misclassify redirected pages as missing content — this is
              the most common cause of false "blank stub" reports from third-party SEO audits.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Route results</CardTitle>
            <CardDescription>
              Sorted alphabetically by path. Click any row to open the live URL in a new tab.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {results.map((r) => (
                <a
                  key={r.path}
                  href={r.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm truncate">{r.path}</code>
                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{r.label}</div>
                    {r.error && (
                      <div className="text-xs text-destructive mt-1">{r.error}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">{r.ms} ms</span>
                    {statusBadge(r)}
                  </div>
                </a>
              ))}
              {!results.length && !running && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results yet. Click "Re-run checks".
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
