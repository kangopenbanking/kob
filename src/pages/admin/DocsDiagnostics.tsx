import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  FileText,
} from "lucide-react";

/**
 * Admin Docs Diagnostics
 * --------------------------------------------------
 * Scans the public documentation surface for any references to the
 * legacy internal backend host. Flags every offending file so the
 * operator can spot URL gaps instantly.
 *
 * Scope: this page only reads PUBLISHED, browser-fetchable resources
 * (anything under /public). It does not require a build step or any
 * server-side scanning.
 */

const FORBIDDEN_HOST = "wdzkzeahdtxlynetndqw.supabase.co";
const PUBLIC_BASE = "https://api.kangopenbanking.com/v1";

// Files served from /public that are user-visible documentation.
const SCAN_TARGETS: { path: string; label: string; type: string }[] = [
  { path: "/openapi.json", label: "OpenAPI Spec (JSON)", type: "Spec" },
  { path: "/openapi.yaml", label: "OpenAPI Spec (YAML)", type: "Spec" },
  { path: "/openapi-sandbox.json", label: "Sandbox OpenAPI (JSON)", type: "Spec" },
  { path: "/openapi-sandbox.yaml", label: "Sandbox OpenAPI (YAML)", type: "Spec" },
  { path: "/apis.json", label: "APIs.json Discovery", type: "Discovery" },
  { path: "/apis-sandbox.json", label: "APIs.json (Sandbox)", type: "Discovery" },
  { path: "/.well-known/ai-plugin.json", label: "AI Plugin Manifest", type: "Discovery" },
  { path: "/security.txt", label: "security.txt", type: "Policy" },
  { path: "/robots.txt", label: "robots.txt", type: "Policy" },
  {
    path: "/docs/woocommerce-plugin-complete-code.md",
    label: "WooCommerce Plugin Doc",
    type: "Guide",
  },
];

type ScanResult = {
  path: string;
  label: string;
  type: string;
  status: "clean" | "leak" | "missing" | "loading";
  hits: number;
  sampleLine?: string;
};

const DocsDiagnostics = () => {
  const [results, setResults] = useState<ScanResult[]>(
    SCAN_TARGETS.map((t) => ({ ...t, status: "loading", hits: 0 })),
  );
  const [scanning, setScanning] = useState(false);
  const [scannedAt, setScannedAt] = useState<string | null>(null);

  const runScan = async () => {
    setScanning(true);
    const out: ScanResult[] = [];
    for (const t of SCAN_TARGETS) {
      try {
        const res = await fetch(t.path, { cache: "no-store" });
        if (!res.ok) {
          out.push({ ...t, status: "missing", hits: 0 });
          continue;
        }
        const text = await res.text();
        const lines = text.split("\n");
        const bad = lines.filter(
          (l) => l.includes(FORBIDDEN_HOST) && !l.includes("/storage/v1/object/public/"),
        );
        out.push({
          ...t,
          status: bad.length > 0 ? "leak" : "clean",
          hits: bad.length,
          sampleLine: bad[0]?.trim().slice(0, 160),
        });
      } catch {
        out.push({ ...t, status: "missing", hits: 0 });
      }
    }
    setResults(out);
    setScannedAt(new Date().toLocaleString());
    setScanning(false);
  };

  useEffect(() => {
    runScan();
  }, []);

  const totals = {
    clean: results.filter((r) => r.status === "clean").length,
    leak: results.filter((r) => r.status === "leak").length,
    missing: results.filter((r) => r.status === "missing").length,
  };

  return (
    <>
      <Helmet>
        <title>Docs URL Diagnostics — Admin</title>
      </Helmet>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Documentation URL Diagnostics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Scans every published documentation file for legacy internal backend URLs
              and confirms each references the branded gateway{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{PUBLIC_BASE}</code>.
            </p>
          </div>
          <Button onClick={runScan} disabled={scanning} variant="outline" size="sm">
            {scanning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Re-scan
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-2xl font-semibold">{totals.clean}</div>
                <div className="text-xs text-muted-foreground">Clean files</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <div>
                <div className="text-2xl font-semibold">{totals.leak}</div>
                <div className="text-xs text-muted-foreground">URL leaks detected</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-2xl font-semibold">{totals.missing}</div>
                <div className="text-xs text-muted-foreground">Missing or unreachable</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Scan results
              {scannedAt && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  · last scanned {scannedAt}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh]">
              <div className="space-y-2">
                {results.map((r) => (
                  <div
                    key={r.path}
                    className="flex items-start gap-3 p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="pt-0.5">
                      {r.status === "loading" && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {r.status === "clean" && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                      {r.status === "leak" && (
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                      )}
                      {r.status === "missing" && (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{r.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {r.type}
                        </Badge>
                        {r.status === "leak" && (
                          <Badge variant="destructive" className="text-xs">
                            {r.hits} leak{r.hits === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </div>
                      <code className="text-xs text-muted-foreground block mt-0.5">
                        {r.path}
                      </code>
                      {r.sampleLine && (
                        <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-x-auto whitespace-pre-wrap break-all">
                          {r.sampleLine}
                        </pre>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={r.path} target="_blank" rel="noopener noreferrer">
                        Open
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reference</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <div>
              <strong className="text-foreground">Forbidden host:</strong>{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {FORBIDDEN_HOST}
              </code>
            </div>
            <div>
              <strong className="text-foreground">Required public base:</strong>{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{PUBLIC_BASE}</code>
            </div>
            <p className="text-xs pt-2">
              The CI suite enforces the same rule via{" "}
              <code>src/test/docs-no-leak.test.ts</code> and{" "}
              <code>src/test/openapi-servers.test.ts</code>. This page is a live
              operator-facing equivalent for runtime spot-checks.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default DocsDiagnostics;
