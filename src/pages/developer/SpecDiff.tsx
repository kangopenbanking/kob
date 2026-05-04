// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P4, P6)
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, ShieldCheck, GitCompare, Loader2 } from "lucide-react";

type ManifestEntry = {
  version: string;
  released_at: string;
  type: "snapshot" | "changelog_only";
  notes?: string;
};

type DiffResult = {
  from: string;
  to: string;
  mode: "structural" | "changelog_only";
  breaking?: boolean;
  breaking_changes?: string[];
  added_paths: string[];
  removed_paths: string[];
  changed_paths: Array<{ path: string; changes: string[] }>;
  added_schemas: string[];
  removed_schemas: string[];
  required_field_changes: Array<{ schema: string; added: string[]; removed: string[] }>;
  summary: string[];
  from_changelog?: string | null;
  to_changelog?: string | null;
};

// Resolve backend at runtime via env var (Direct Backend Mandate); keeps
// the developer-portal source free of hard-coded *.supabase.co hosts.
const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function SpecDiff() {
  const [versions, setVersions] = useState<ManifestEntry[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FN_BASE}/openapi-spec-diff/versions`);
        const data = await res.json();
        setVersions(data.versions ?? []);
        setCurrent(data.current ?? "");
        if ((data.versions ?? []).length >= 2) {
          setFrom(data.versions[1].version);
          setTo(data.versions[0].version);
        }
      } catch (e) {
        setError("Could not load version manifest.");
      }
    })();
  }, []);

  async function runDiff() {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    setDiff(null);
    try {
      const res = await fetch(`${FN_BASE}/openapi-spec-diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "diff_failed");
      setDiff(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to compute diff.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>OpenAPI Version Diff | Kang Open Banking</title>
        <meta
          name="description"
          content="Compare any two published Kang Open Banking OpenAPI versions side-by-side. Surfaces added paths, removed paths, schema changes, and breaking changes for institutional review."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/spec-diff" />
      </Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <header className="space-y-3">
          <Badge variant="outline">Spec Governance</Badge>
          <h1 className="text-3xl font-bold">OpenAPI Version Diff</h1>
          <p className="text-muted-foreground">
            Compare any two published versions of the Kang Open Banking OpenAPI specification.
            Institutions use this page to review breaking changes before upgrading clients.
            Changes are classified per Standing Order 4 (Surgeon Rule): additions are safe,
            removals or rename of operationIds, paths, response codes, or required fields are
            flagged as breaking.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitCompare className="h-4 w-4" /> Choose versions to compare
            </CardTitle>
            <CardDescription>
              Current production version: <span className="font-mono">{current || "loading…"}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={`f-${v.version}`} value={v.version}>
                      {v.version} {v.type === "changelog_only" ? "(changelog only)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={`t-${v.version}`} value={v.version}>
                      {v.version} {v.type === "changelog_only" ? "(changelog only)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={runDiff} disabled={!from || !to || loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitCompare className="h-4 w-4 mr-2" />}
                Compare
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Diff failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {diff && (
          <div className="space-y-6">
            <Alert variant={diff.breaking ? "destructive" : "default"}>
              {diff.breaking ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              <AlertTitle>
                {diff.mode === "changelog_only"
                  ? "Snapshot not available"
                  : diff.breaking
                    ? "Breaking changes detected"
                    : "No breaking changes — additive only"}
              </AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 mt-2 text-sm">
                  {diff.summary.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </AlertDescription>
            </Alert>

            {diff.breaking_changes && diff.breaking_changes.length > 0 && (
              <Card className="border-destructive/40">
                <CardHeader><CardTitle className="text-base text-destructive">Breaking changes</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {diff.breaking_changes.map((b, i) => <li key={i} className="font-mono">- {b}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <DiffList title="Added paths" items={diff.added_paths} variant="positive" />
              <DiffList title="Removed paths" items={diff.removed_paths} variant="negative" />
              <DiffList title="Added schemas" items={diff.added_schemas} variant="positive" />
              <DiffList title="Removed schemas" items={diff.removed_schemas} variant="negative" />
            </div>

            {diff.changed_paths.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Changed paths</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {diff.changed_paths.map((cp) => (
                    <div key={cp.path}>
                      <div className="font-mono">{cp.path}</div>
                      <ul className="pl-5 list-disc text-muted-foreground">
                        {cp.changes.map((c, i) => <li key={i} className="font-mono">{c}</li>)}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {diff.required_field_changes.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Required field changes</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {diff.required_field_changes.map((rc) => (
                    <div key={rc.schema}>
                      <div className="font-mono font-medium">{rc.schema}</div>
                      {rc.added.length > 0 && <div className="text-emerald-600 dark:text-emerald-400 font-mono">+ required: {rc.added.join(", ")}</div>}
                      {rc.removed.length > 0 && <div className="text-destructive font-mono">- required: {rc.removed.join(", ")} (BREAKING)</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">How this works</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>Endpoint:</strong> <code>GET /v1/spec/diff?from=&lt;ver&gt;&amp;to=&lt;ver&gt;</code></p>
            <p><strong>Versions list:</strong> <code>GET /v1/spec/versions</code></p>
            <p>
              The diff is computed server-side from machine-readable snapshots stored at
              <code> /openapi-history/</code>. Versions older than 4.27.3 may be marked
              <em> changelog_only</em> when no JSON snapshot exists; in that case the page
              links to the human changelog.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function DiffList({ title, items, variant }: { title: string; items: string[]; variant: "positive" | "negative" }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="outline">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">None.</p>
        ) : (
          <ul className="text-xs font-mono space-y-1 max-h-64 overflow-auto">
            {items.map((p) => (
              <li key={p} className={variant === "positive" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                {variant === "positive" ? "+ " : "- "}{p}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
