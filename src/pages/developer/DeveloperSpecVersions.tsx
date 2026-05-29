// Public developer page — lists every published OpenAPI spec version with
// per-version download links (JSON + YAML) plus a Postman "Import Spec" flow.
//
// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT.
import { useEffect, useState } from "react";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Copy, FileJson, FileText, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Snapshot {
  version: string;
  released_at?: string;
  type?: string;
  file?: string;
  notes?: string;
}

export default function DeveloperSpecVersions() {
  const [versions, setVersions] = useState<Snapshot[]>([]);
  const [current, setCurrent] = useState<string>("");

  useEffect(() => {
    fetch("/openapi-history/manifest.json")
      .then((r) => r.json())
      .then((m) => {
        setCurrent(m.current);
        setVersions(m.versions ?? []);
      })
      .catch(() => {});
  }, []);

  function urlFor(v: Snapshot, ext: "json" | "yaml") {
    if (!v.file) return `/openapi.${ext}`;
    if (ext === "json") return `/openapi-history/${v.file}`;
    return `/openapi-history/${v.file.replace(/\.json$/, ".yaml")}`;
  }
  function absolute(u: string) {
    if (typeof window === "undefined") return u;
    return `${window.location.origin}${u}`;
  }
  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 px-4 py-12">
      <SEO
        title="OpenAPI spec versions — Kang Open Banking"
        description="Download every published OpenAPI spec version (JSON or YAML) and import directly into Postman to keep integrators in sync."
      />
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">OpenAPI spec versions</h1>
        <p className="mt-2 text-muted-foreground">
          Every released ratchet / spec_version is permanently downloadable here as JSON or YAML.
          The latest is also mirrored at <code>/openapi.json</code> and <code>/openapi.yaml</code>.
        </p>
      </header>

      <Tabs defaultValue="downloads">
        <TabsList>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
          <TabsTrigger value="postman">Postman import</TabsTrigger>
        </TabsList>

        <TabsContent value="downloads" className="space-y-4">
          {versions.map((v) => (
            <Card key={v.version}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    v{v.version}{" "}
                    {v.version === current && <Badge className="ml-2">current</Badge>}
                    {v.type === "changelog_only" && (
                      <Badge variant="outline" className="ml-2">changelog only</Badge>
                    )}
                  </CardTitle>
                  {v.released_at && (
                    <span className="text-xs text-muted-foreground">
                      released {new Date(v.released_at).toISOString().slice(0, 10)}
                    </span>
                  )}
                </div>
                {v.notes && <CardDescription className="mt-2">{v.notes}</CardDescription>}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {v.type !== "changelog_only" && (
                  <>
                    <Button size="sm" variant="outline" asChild>
                      <a href={urlFor(v, "json")} download>
                        <FileJson className="mr-2 h-4 w-4" /> JSON
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={urlFor(v, "yaml")} download>
                        <FileText className="mr-2 h-4 w-4" /> YAML
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copy(absolute(urlFor(v, "json")))}>
                      <Copy className="mr-2 h-4 w-4" /> Copy JSON URL
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copy(absolute(urlFor(v, "yaml")))}>
                      <Copy className="mr-2 h-4 w-4" /> Copy YAML URL
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="postman">
          <Card>
            <CardHeader>
              <CardTitle>Import the spec into Postman</CardTitle>
              <CardDescription>
                Keep your integrator team in sync — Postman can import the spec by URL and refresh
                the generated collection on every release.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-inside list-decimal space-y-2 text-sm">
                <li>Open Postman → <strong>Import</strong> → <strong>Link</strong>.</li>
                <li>
                  Paste the canonical URL for the latest spec:{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">{absolute("/openapi.json")}</code>
                  <Button size="sm" variant="ghost" className="ml-2" onClick={() => copy(absolute("/openapi.json"))}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </li>
                <li>
                  Tick <strong>Replace existing collection</strong> to refresh on every spec
                  release. Pin to a specific ratchet using any of the per-version URLs in the
                  Downloads tab.
                </li>
                <li>Import both environment files from <code>/postman/</code> (Sandbox + Production).</li>
              </ol>
              <div className="rounded border bg-muted/40 p-4 text-xs text-muted-foreground">
                <strong>Tip:</strong> the Postman environments include a <code>postman_import_url</code>
                variable — point CI workflows at it so newly released specs auto-refresh.
              </div>
              <Button variant="outline" asChild>
                <a href="/postman/manifest.json" target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Postman manifest
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
