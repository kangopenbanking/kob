import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { KOB_API_VERSION } from "@/config/version";
import { SEO } from "@/components/SEO";
import { DeveloperBreadcrumb } from "@/components/developer/DeveloperBreadcrumb";

type ArtifactCheck = {
  name: string;
  url: string;
  ok: boolean;
  status?: number;
  detail?: string;
  stale?: boolean;
};

const PORTAL_BASE_URL = "https://kangopenbanking.com";

const ARTIFACT_PATHS: { name: string; path: string }[] = [
  { name: "OpenAPI JSON", path: "/openapi.json" },
  { name: "OpenAPI YAML", path: "/openapi.yaml" },
  { name: "Sandbox OpenAPI JSON", path: "/openapi-sandbox.json" },
  { name: "Changelog JSON", path: "/changelog.json" },
  { name: "Postman (latest)", path: "/postman/Kang_Open_Banking_API_latest.postman_collection.json" },
  { name: "Postman manifest", path: "/postman/manifest.json" },
  { name: "APIs.json", path: "/apis.json" },
  { name: "Sitemap", path: "/sitemap.xml" },
];

const ARTIFACTS = ARTIFACT_PATHS.map((a) => ({ name: a.name, url: `${PORTAL_BASE_URL}${a.path}` }));

export default function DeploymentStatus() {
  const [checks, setChecks] = useState<ArtifactCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  async function runChecks() {
    setLoading(true);
    const bust = Date.now();
    const results = await Promise.all(
      ARTIFACTS.map(async (a) => {
        const url = `${a.url}${a.url.includes("?") ? "&" : "?"}_=${bust}`;
        try {
          const res = await fetch(url, { cache: "no-store" });
          let detail: string | undefined;
          let stale = false;
          if (res.ok && a.url.endsWith(".json")) {
            try {
              const j = await res.clone().json();
              const v = j?.info?.version || j?.apiVersion || j?.current;
              if (v) {
                detail = String(v);
                stale = detail !== KOB_API_VERSION;
              }
            } catch { /* non-JSON or parse error */ }
          }
          return { name: a.name, url: a.url, ok: res.ok, status: res.status, detail, stale };
        } catch (e: any) {
          return { name: a.name, url: a.url, ok: false, detail: e?.message };
        }
      })
    );
    setChecks(results);
    setLastChecked(new Date());
    setLoading(false);
  }


  useEffect(() => { runChecks(); }, []);

  const allOk = checks.length > 0 && checks.every((c) => c.ok);

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEO
        title="Deployment Status — Kang Open Banking Developer Portal"
        description="Live verification of the latest Netlify deployment, API version, and artifact publication status."
        canonical="https://kangopenbanking.com/developer/deployment-status"
      />
      <DeveloperBreadcrumb />

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Deployment Status</h1>
        <p className="text-muted-foreground">
          Live verification of the latest portal build and the public artifacts that power
          partner integrations. Run by every Netlify build via <code>scripts/predeploy.mjs</code>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Build</span>
            <Badge variant="outline">v{KOB_API_VERSION}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">API Version</div>
            <div className="font-medium">v{KOB_API_VERSION}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Portal Origin</div>
            <div className="font-medium break-all">https://kangopenbanking.com</div>
          </div>
          <div>
            <div className="text-muted-foreground">API Gateway</div>
            <div className="font-medium">https://api.kangopenbanking.com/v1</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {allOk ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              Artifact Publication
            </span>
            <Button size="sm" variant="outline" onClick={runChecks} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Re-run checks
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border divide-y">
            {checks.map((c) => (
              <div key={c.url} className="flex items-center justify-between p-3 text-sm">
                <div className="flex items-center gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-medium">{c.name}</span>
                  {c.detail && (
                    <Badge variant={c.stale ? "destructive" : "secondary"}>
                      {c.detail}{c.stale ? ` (expected v${KOB_API_VERSION})` : ""}
                    </Badge>
                  )}
                </div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  {c.status ?? "—"} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
          {lastChecked && (
            <p className="text-xs text-muted-foreground mt-3">
              Last checked {lastChecked.toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Build Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Each Netlify deploy executes the following gates before publishing:</p>
          <ol className="list-decimal pl-6 space-y-1">
            <li><code>sync-version-artifacts.mjs</code> — propagates the SSOT version to OpenAPI, Postman, and changelog.</li>
            <li><code>check-openapi-version.mjs</code> — fails the build on version drift.</li>
            <li><code>audit-public-access.mjs</code> — verifies every public docs URL returns 200 (skipped on offline/preview).</li>
            <li><code>vite build</code> — produces the static portal under <code>dist/</code>.</li>
          </ol>
          <p className="pt-2">
            See <a className="underline" href="/developer/env-vars">Required Netlify Environment Variables</a> for the
            full list of variables consumed by these scripts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
