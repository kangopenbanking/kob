import { useEffect, useMemo, useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Lock,
  PlayCircle,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Link } from "react-router-dom";
import yaml from "js-yaml";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { API_CONFIG } from "@/config/api";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { CLIENT_LIBRARIES, type ClientLanguageId } from "@/components/developer/ClientLibraryLogos";
import { generateForLanguage } from "@/components/developer/sdkCodeGenerator";

// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// /developer/api-explorer must remain publicly accessible (ORDER P1, P4).

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: any; description?: string }>;
  requestBody?: any;
  responses?: Record<string, any>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

interface FlatOperation {
  id: string;
  method: HttpMethod;
  path: string;
  tag: string;
  op: OpenAPIOperation;
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  POST: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  PUT: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  DELETE: "bg-destructive/10 text-destructive border-destructive/30",
  PATCH: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
  OPTIONS: "bg-muted text-muted-foreground border-border",
  HEAD: "bg-muted text-muted-foreground border-border",
};

function flattenSpec(spec: any): { operations: FlatOperation[]; tagOrder: string[] } {
  const operations: FlatOperation[] = [];
  const tagOrder: string[] = [];
  const tagSet = new Set<string>();

  if (spec?.tags) {
    for (const t of spec.tags) {
      if (t?.name && !tagSet.has(t.name)) {
        tagOrder.push(t.name);
        tagSet.add(t.name);
      }
    }
  }

  for (const [path, methods] of Object.entries(spec?.paths ?? {})) {
    for (const [method, op] of Object.entries(methods as Record<string, OpenAPIOperation>)) {
      const m = method.toUpperCase();
      if (!["GET", "POST", "PUT", "DELETE", "PATCH"].includes(m)) continue;
      const tag = op.tags?.[0] ?? "Other";
      if (!tagSet.has(tag)) {
        tagOrder.push(tag);
        tagSet.add(tag);
      }
      operations.push({
        id: `${m}-${path}`,
        method: m as HttpMethod,
        path,
        tag,
        op,
      });
    }
  }
  return { operations, tagOrder };
}

function buildCurl(method: HttpMethod, baseUrl: string, path: string, op: OpenAPIOperation) {
  const url = `${baseUrl}${path}`.replace(/\{([^}]+)\}/g, ":$1");
  const lines = [`curl -X ${method} '${url}' \\`, `  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\`, `  -H 'Content-Type: application/json'`];
  if (["POST", "PUT", "PATCH"].includes(method) && op.requestBody) {
    lines[lines.length - 1] += ` \\`;
    lines.push(`  -d '{\n    "key": "value"\n  }'`);
  }
  return lines.join("\n");
}

function buildNode(method: HttpMethod, baseUrl: string, path: string) {
  const url = `${baseUrl}${path}`.replace(/\{([^}]+)\}/g, "${params.$1}");
  return `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  accessToken: process.env.KOB_ACCESS_TOKEN,
});

const response = await fetch(\`${url}\`, {
  method: '${method}',
  headers: {
    'Authorization': \`Bearer \${process.env.KOB_ACCESS_TOKEN}\`,
    'Content-Type': 'application/json',
  },${["POST", "PUT", "PATCH"].includes(method) ? `\n  body: JSON.stringify({ /* payload */ }),` : ""}
});

const data = await response.json();`;
}

function buildPython(method: HttpMethod, baseUrl: string, path: string) {
  const url = `${baseUrl}${path}`;
  return `import os
import requests

url = "${url}"
headers = {
    "Authorization": f"Bearer {os.environ['KOB_ACCESS_TOKEN']}",
    "Content-Type": "application/json",
}

response = requests.${method.toLowerCase()}(url, headers=headers${["POST", "PUT", "PATCH"].includes(method) ? `, json={"key": "value"}` : ""})
data = response.json()`;
}

function buildPHP(method: HttpMethod, baseUrl: string, path: string) {
  const url = `${baseUrl}${path}`;
  return `<?php
$ch = curl_init('${url}');
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . getenv('KOB_ACCESS_TOKEN'),
    'Content-Type: application/json',
]);${["POST", "PUT", "PATCH"].includes(method) ? `\ncurl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['key' => 'value']));` : ""}

$response = json_decode(curl_exec($ch), true);
curl_close($ch);`;
}

function CodeSnippet({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative rounded-lg border border-white/10 bg-[#0d1117] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#161b22]">
        <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">{language}</span>
        <Button size="icon" variant="ghost" onClick={onCopy} className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="p-4 text-xs font-mono text-gray-100 leading-relaxed overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

const ApiExplorer = () => {
  const { toast } = useToast();
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"reference" | "tryit">("reference");
  const navRef = useRef<HTMLDivElement | null>(null);

  // Fetch spec
  useEffect(() => {
    let cancelled = false;
    const sources = [
      { url: `${window.location.origin}/openapi.json`, timeout: 30000 },
      { url: `${API_CONFIG.BASE_URL}/public-api-spec`, timeout: 20000 },
    ];
    const fetchOne = async (url: string, ms: number) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), ms);
      try {
        const r = await fetch(url, { signal: controller.signal });
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      } finally {
        clearTimeout(t);
      }
    };
    (async () => {
      setLoading(true);
      setFetchError(null);
      for (const { url, timeout } of sources) {
        if (cancelled) return;
        try {
          const data = await fetchOne(url, timeout);
          if (data?.openapi || data?.info) {
            if (!cancelled) {
              setSpec(data);
              setLoading(false);
            }
            return;
          }
        } catch {
          /* try next */
        }
      }
      if (!cancelled) {
        setFetchError("Failed to load API specification.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  const { operations, tagOrder } = useMemo(() => (spec ? flattenSpec(spec) : { operations: [], tagOrder: [] }), [spec]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, FlatOperation[]>();
    for (const op of operations) {
      const matches =
        !q ||
        op.path.toLowerCase().includes(q) ||
        op.method.toLowerCase().includes(q) ||
        (op.op.summary ?? "").toLowerCase().includes(q) ||
        (op.op.operationId ?? "").toLowerCase().includes(q) ||
        op.tag.toLowerCase().includes(q);
      if (!matches) continue;
      const list = map.get(op.tag) ?? [];
      list.push(op);
      map.set(op.tag, list);
    }
    const ordered: Array<{ tag: string; ops: FlatOperation[] }> = [];
    for (const t of tagOrder) {
      if (map.has(t)) ordered.push({ tag: t, ops: map.get(t)! });
    }
    return ordered;
  }, [operations, tagOrder, query]);

  // Auto-select first operation
  useEffect(() => {
    if (!selectedId && grouped.length > 0 && grouped[0].ops.length > 0) {
      setSelectedId(grouped[0].ops[0].id);
    }
  }, [grouped, selectedId]);

  const selected = useMemo(() => operations.find((o) => o.id === selectedId), [operations, selectedId]);

  const apiVersion = spec?.info?.version ?? "—";
  const baseUrl = spec?.servers?.[0]?.url ?? API_CONFIG.BASE_URL;

  const handleDownload = (format: "json" | "yaml") => {
    if (!spec) return;
    const content = format === "yaml" ? yaml.dump(spec) : JSON.stringify(spec, null, 2);
    const blob = new Blob([content], { type: format === "yaml" ? "text/yaml" : "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kang-openbanking-api.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Download started", description: `kang-openbanking-api.${format}` });
  };

  const responseCodes = selected?.op.responses ? Object.keys(selected.op.responses) : [];

  return (
    <>
      <Helmet>
        <title>API Reference — Kang Open Banking</title>
        <meta
          name="description"
          content={`Interactive API reference for Kang Open Banking. ${operations.length || "300+"} endpoints across payments, accounts, open banking and disbursements. Current version v${apiVersion}.`}
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/api-explorer" />
      </Helmet>

      <div className="min-h-screen bg-background" data-testid="api-explorer-container">
        {/* Hero */}
        <header className="border-b bg-card">
          <div className="container mx-auto max-w-7xl px-4 py-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                    <Sparkles className="h-3 w-3" /> API Reference
                  </Badge>
                  <Link to={`/developer/changelog#v${String(apiVersion).replace(/\./g, "-")}`}>
                    <Badge variant="outline" className="font-mono text-xs hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer">
                      v{apiVersion}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Badge>
                  </Link>
                  {!loading && spec && (
                    <Badge variant="outline" className="gap-1.5 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {operations.length} endpoints
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Kang Open Banking API</h1>
                <p className="text-base text-muted-foreground leading-relaxed">
                  RESTful, OAuth-secured, OBIE-compliant. Browse every endpoint, inspect request and response schemas, and copy production-ready
                  snippets in cURL, Node.js, Python, or PHP.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleDownload("json")} disabled={!spec}>
                  <Download className="mr-1.5 h-4 w-4" /> JSON
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDownload("yaml")} disabled={!spec}>
                  <Download className="mr-1.5 h-4 w-4" /> YAML
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/developer/changelog">
                    <Sparkles className="mr-1.5 h-4 w-4" /> Changelog
                  </Link>
                </Button>
                <Button size="sm" variant="default" onClick={() => setActiveTab("tryit")}>
                  <PlayCircle className="mr-1.5 h-4 w-4" /> Try it
                </Button>
              </div>
            </div>

            {/* Server bar */}
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Server className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Base URL</p>
                <code className="text-xs font-mono text-foreground/90 truncate block">{baseUrl}</code>
              </div>
              <Badge variant="outline" className="gap-1.5 text-xs">
                <ShieldCheck className="h-3 w-3" /> OAuth 2.0 + Bearer
              </Badge>
            </div>
          </div>
        </header>

        <div className="container mx-auto max-w-7xl px-4 py-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="reference">
                <Terminal className="mr-1.5 h-3.5 w-3.5" /> Reference
              </TabsTrigger>
              <TabsTrigger value="tryit">
                <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Try it out
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reference" className="m-0">
              {fetchError && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between gap-3">
                    <span>{fetchError}</span>
                    <Button size="sm" variant="outline" onClick={() => setRetryCount((c) => c + 1)}>
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_360px] gap-6">
                  <Skeleton className="h-[600px] rounded-xl" />
                  <Skeleton className="h-[600px] rounded-xl" />
                  <Skeleton className="h-[600px] rounded-xl" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_400px] gap-6">
                  {/* Left: Endpoint navigator */}
                  <aside className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)]">
                    <Card className="overflow-hidden">
                      <div className="p-3 border-b bg-muted/30">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Search endpoints…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-8 h-9 text-sm"
                            aria-label="Search endpoints"
                          />
                        </div>
                      </div>
                      <ScrollArea className="h-[calc(100vh-12rem)]" ref={navRef}>
                        <div className="p-2">
                          {grouped.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-4 text-center">No endpoints match.</p>
                          ) : (
                            grouped.map(({ tag, ops }) => (
                              <div key={tag} className="mb-3">
                                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {tag} <span className="text-muted-foreground/60">({ops.length})</span>
                                </p>
                                <div className="space-y-0.5">
                                  {ops.map((o) => {
                                    const active = o.id === selectedId;
                                    return (
                                      <button
                                        key={o.id}
                                        onClick={() => setSelectedId(o.id)}
                                        className={`w-full text-left flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors ${
                                          active ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                                        }`}
                                      >
                                        <span
                                          className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${METHOD_COLORS[o.method]}`}
                                        >
                                          {o.method}
                                        </span>
                                        <span className="text-xs font-mono truncate text-foreground/90">{o.path}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </Card>
                  </aside>

                  {/* Center: Endpoint details */}
                  <main className="min-w-0">
                    {selected ? (
                      <Card>
                        <CardContent className="p-6 space-y-6">
                          {/* Method + Path */}
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {selected.op.tags?.[0] && (
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{selected.op.tags[0]}</span>
                              )}
                              {selected.op.deprecated && <Badge variant="destructive">Deprecated</Badge>}
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight">{selected.op.summary ?? selected.op.operationId ?? selected.path}</h2>
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
                              <Badge variant="outline" className={`font-mono text-xs ${METHOD_COLORS[selected.method]}`}>
                                {selected.method}
                              </Badge>
                              <code className="text-sm font-mono text-foreground/90 break-all flex-1">{selected.path}</code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  navigator.clipboard.writeText(`${baseUrl}${selected.path}`);
                                  toast({ title: "Copied", description: "Endpoint URL copied to clipboard" });
                                }}
                                aria-label="Copy endpoint"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {selected.op.description && (
                              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{selected.op.description}</p>
                            )}
                          </div>

                          {/* Authentication */}
                          {selected.op.security && selected.op.security.length > 0 && (
                            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5">
                              <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                              <div className="text-xs">
                                <p className="font-semibold text-amber-700 dark:text-amber-400">Authentication required</p>
                                <p className="text-muted-foreground mt-0.5">
                                  Schemes: {selected.op.security.flatMap((s) => Object.keys(s)).join(", ")}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Parameters */}
                          {selected.op.parameters && selected.op.parameters.length > 0 && (
                            <section className="space-y-3">
                              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Parameters</h3>
                              <div className="rounded-lg border overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/30 border-b">
                                    <tr className="text-left">
                                      <th className="px-3 py-2 font-medium text-xs">Name</th>
                                      <th className="px-3 py-2 font-medium text-xs">In</th>
                                      <th className="px-3 py-2 font-medium text-xs">Type</th>
                                      <th className="px-3 py-2 font-medium text-xs">Required</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {selected.op.parameters.map((p) => (
                                      <tr key={`${p.in}-${p.name}`} className="hover:bg-muted/20">
                                        <td className="px-3 py-2 font-mono text-xs">{p.name}</td>
                                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.in}</td>
                                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.schema?.type ?? "—"}</td>
                                        <td className="px-3 py-2 text-xs">
                                          {p.required ? <Badge variant="outline" className="text-[10px]">Required</Badge> : <span className="text-muted-foreground">Optional</span>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </section>
                          )}

                          {/* Responses */}
                          {responseCodes.length > 0 && (
                            <section className="space-y-3">
                              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Responses</h3>
                              <div className="space-y-2">
                                {responseCodes.map((code) => {
                                  const r = selected.op.responses![code];
                                  const tone =
                                    code.startsWith("2")
                                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                                      : code.startsWith("3")
                                      ? "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400"
                                      : code.startsWith("4")
                                      ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                                      : "border-destructive/30 bg-destructive/5 text-destructive";
                                  return (
                                    <div key={code} className="flex items-start gap-3 rounded-lg border p-3">
                                      <Badge variant="outline" className={`font-mono text-xs shrink-0 ${tone}`}>{code}</Badge>
                                      <div className="text-sm flex-1">
                                        <p className="text-foreground/90">{r?.description ?? "—"}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardContent className="py-20 text-center text-muted-foreground">
                          <ChevronRight className="h-8 w-8 mx-auto mb-3 opacity-50" />
                          <p>Select an endpoint to view its reference.</p>
                        </CardContent>
                      </Card>
                    )}
                  </main>

                  {/* Right: Code samples */}
                  <aside className="lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] overflow-y-auto space-y-3">
                    {selected ? (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Request samples</p>
                        <Tabs defaultValue="curl">
                          <TabsList className="grid grid-cols-4 h-9">
                            <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
                            <TabsTrigger value="node" className="text-xs">Node</TabsTrigger>
                            <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
                            <TabsTrigger value="php" className="text-xs">PHP</TabsTrigger>
                          </TabsList>
                          <TabsContent value="curl" className="mt-3">
                            <CodeSnippet language="cURL" code={buildCurl(selected.method, baseUrl, selected.path, selected.op)} />
                          </TabsContent>
                          <TabsContent value="node" className="mt-3">
                            <CodeSnippet language="Node.js" code={buildNode(selected.method, baseUrl, selected.path)} />
                          </TabsContent>
                          <TabsContent value="python" className="mt-3">
                            <CodeSnippet language="Python" code={buildPython(selected.method, baseUrl, selected.path)} />
                          </TabsContent>
                          <TabsContent value="php" className="mt-3">
                            <CodeSnippet language="PHP" code={buildPHP(selected.method, baseUrl, selected.path)} />
                          </TabsContent>
                        </Tabs>

                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-3">Example response</p>
                        <CodeSnippet
                          language="JSON · 200 OK"
                          code={`{
  "id": "obj_01HXYZ...",
  "object": "${(selected.op.tags?.[0] ?? "resource").toLowerCase()}",
  "created_at": "2026-04-30T10:00:00Z"
}`}
                        />
                      </>
                    ) : (
                      <Card>
                        <CardContent className="py-12 text-center text-muted-foreground text-sm">Select an endpoint.</CardContent>
                      </Card>
                    )}
                  </aside>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tryit" className="m-0">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b bg-card px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <PlayCircle className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-sm tracking-tight">Interactive sandbox</p>
                      <p className="text-[11px] text-muted-foreground">Authenticate and execute live calls against the sandbox.</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1.5 text-xs">
                    <ShieldCheck className="h-3 w-3" /> OAuth 2.0
                  </Badge>
                </div>
                {loading ? (
                  <div className="p-10 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-11/12" />
                    <Skeleton className="h-10 w-10/12" />
                  </div>
                ) : spec ? (
                  <div className="swagger-container">
                    <SwaggerUI spec={spec} docExpansion="list" deepLinking displayOperationId filter tryItOutEnabled />
                  </div>
                ) : (
                  <div className="p-12 text-center space-y-3">
                    <AlertCircle className="h-7 w-7 text-destructive mx-auto" />
                    <p className="font-semibold">Unable to load specification</p>
                    <Button variant="outline" onClick={() => setRetryCount((c) => c + 1)}>
                      <Terminal className="mr-2 h-4 w-4" /> Retry
                    </Button>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>

          <noscript>
            <div className="container mx-auto px-4 py-12 max-w-4xl">
              <h2 className="text-2xl font-bold mb-4">Kang Open Banking API — Quick Reference</h2>
              <p className="mb-6 text-muted-foreground">
                The interactive explorer requires JavaScript. Use the static reference or download the spec directly:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li><a href="/openapi.json" className="text-primary underline">OpenAPI JSON</a></li>
                <li><a href="/openapi.yaml" className="text-primary underline">OpenAPI YAML</a></li>
                <li><a href="/developer/api-explorer-static" className="text-primary underline">Static API reference</a></li>
                <li><a href="/developer/redoc" className="text-primary underline">Redoc documentation</a></li>
              </ul>
            </div>
          </noscript>

          <AutoDocNavigation />
        </div>
      </div>
    </>
  );
};

export default ApiExplorer;
