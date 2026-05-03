import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Bug,
  CheckCircle,
  Download,
  ExternalLink,
  Hash,
  Link as LinkIcon,
  Loader2,
  Plus,
  Rss,
  Search,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { useToast } from "@/hooks/use-toast";

// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// This page MUST remain publicly accessible (no auth, no gate). ORDER P1, P7.

interface ChangelogEntry {
  version: string;
  date: string;
  type: "major" | "minor" | "patch" | string;
  breaking_changes?: boolean;
  summary?: string;
  highlights?: string[];
  standard_citations?: string[];
}

interface ChangelogFile {
  apiVersion: string;
  specUrl?: string;
  docsUrl?: string;
  lastUpdated?: string;
  entries: ChangelogEntry[];
}

const FALLBACK: ChangelogFile = {
  apiVersion: "4.28.2",
  lastUpdated: "2026-05-02",
  entries: [
    {
      version: "4.28.2",
      date: "2026-05-02",
      type: "patch",
      summary: "Webhook signature and replay-protection header names aligned across the public OpenAPI spec and developer docs.",
      highlights: [
        "Canonical X-KOB-Signature header with v1=<hex> signature versioning",
        "X-Webhook-ID deduplication and X-Webhook-Timestamp replay windows documented",
        "Public changelog feed remains available at /changelog.json",
      ],
    },
  ],
};

function classifyHighlight(text: string): "feature" | "improvement" | "fix" | "breaking" {
  const t = text.toLowerCase();
  if (/\b(break|removed|incompatible)\b/.test(t)) return "breaking";
  if (/\b(fix|fixed|resolve|patch|bug)\b/.test(t)) return "fix";
  if (/\b(improv|enhanc|hardenin|optim|refactor|bump|updat)\b/.test(t)) return "improvement";
  return "feature";
}

function typeMeta(type: string) {
  switch (type) {
    case "feature":
      return { Icon: Plus, label: "New", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" };
    case "improvement":
      return { Icon: Zap, label: "Improved", className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400" };
    case "fix":
      return { Icon: Bug, label: "Fixed", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" };
    case "breaking":
      return { Icon: AlertTriangle, label: "Breaking", className: "border-destructive/40 bg-destructive/10 text-destructive" };
    default:
      return { Icon: CheckCircle, label: "Note", className: "border-border bg-muted text-muted-foreground" };
  }
}

function releaseTypeBadge(type: string) {
  switch (type) {
    case "major":
      return <Badge variant="destructive">Major</Badge>;
    case "minor":
      return <Badge>Minor</Badge>;
    case "patch":
      return <Badge variant="secondary">Patch</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function versionAnchor(version: string, index: number) {
  const digits = (version.match(/\d+(?:\.\d+)*/)?.[0] ?? "").replace(/\./g, "-");
  return digits ? `v${digits}` : `release-${index}`;
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

export default function Changelog() {
  const { toast } = useToast();
  const [data, setData] = useState<ChangelogFile>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "feature" | "improvement" | "fix" | "breaking">("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/changelog.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load changelog"))))
      .then((json: ChangelogFile) => {
        if (!cancelled && json?.entries?.length) setData(json);
      })
      .catch(() => {
        /* keep fallback */
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = data.entries;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .map((entry) => {
        const highlights = entry.highlights ?? [];
        const matchedHighlights = highlights.filter((h) => {
          const matchesQuery = !q || h.toLowerCase().includes(q) || entry.version.toLowerCase().includes(q) || (entry.summary ?? "").toLowerCase().includes(q);
          const matchesFilter = activeFilter === "all" || classifyHighlight(h) === activeFilter;
          return matchesQuery && matchesFilter;
        });
        return { entry, matchedHighlights };
      })
      .filter(({ entry, matchedHighlights }) => {
        if (matchedHighlights.length > 0) return true;
        // Allow version/summary-only matches when query is set & no filter
        if (q && (entry.version.toLowerCase().includes(q) || (entry.summary ?? "").toLowerCase().includes(q))) {
          return activeFilter === "all";
        }
        return !q && activeFilter === "all";
      });
  }, [entries, query, activeFilter]);

  const copyAnchor = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied", description: id });
  };

  const filters: Array<{ key: typeof activeFilter; label: string }> = [
    { key: "all", label: "All changes" },
    { key: "feature", label: "New" },
    { key: "improvement", label: "Improved" },
    { key: "fix", label: "Fixed" },
    { key: "breaking", label: "Breaking" },
  ];

  return (
    <>
      <Helmet>
        <title>API Changelog — Kang Open Banking</title>
        <meta
          name="description"
          content={`Release notes for the Kang Open Banking API. Current version ${data.apiVersion}. Track new features, improvements, and bug fixes across the platform.`}
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/changelog" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          {/* Hero */}
          <header className="mb-10 rounded-2xl border bg-card p-8 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
                    <Sparkles className="h-3 w-3" />
                    Live release feed
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    v{data.apiVersion}
                  </Badge>
                  {data.lastUpdated && (
                    <Badge variant="outline" className="text-xs">
                      Updated {formatDate(data.lastUpdated)}
                    </Badge>
                  )}
                </div>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">API Changelog</h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Every additive change, fix, and improvement to the Kang Open Banking API — published within 48 hours of deployment per ORDER P7.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="/changelog.json" target="_blank" rel="noopener noreferrer">
                    <Download className="mr-1.5 h-4 w-4" /> JSON feed
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="/openapi.json" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-4 w-4" /> OpenAPI spec
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href="/developer/api-reference/versioning">
                    <Rss className="mr-1.5 h-4 w-4" /> Versioning policy
                  </a>
                </Button>
              </div>
            </div>

            {/* Search + filters */}
            <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by version, endpoint, or keyword…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-10"
                  aria-label="Search changelog"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {filters.map((f) => (
                  <Button
                    key={f.key}
                    size="sm"
                    variant={activeFilter === f.key ? "default" : "outline"}
                    onClick={() => setActiveFilter(f.key)}
                    className="h-8"
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-10">
              {/* Sticky version index */}
              <aside className="hidden lg:block">
                <div className="sticky top-24 space-y-1 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2">Releases</p>
                  {entries.map((entry, i) => {
                    const id = versionAnchor(entry.version, i);
                    return (
                      <a
                        key={id}
                        href={`#${id}`}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors group"
                      >
                        <span className="font-mono text-xs text-foreground/80 group-hover:text-foreground truncate">v{entry.version}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(entry.date).split(",")[0]}</span>
                      </a>
                    );
                  })}
                </div>
              </aside>

              {/* Timeline */}
              <main className="space-y-6">
                {filtered.length === 0 && (
                  <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                      No changes match your search.
                    </CardContent>
                  </Card>
                )}

                {filtered.map(({ entry, matchedHighlights }, index) => {
                  const id = versionAnchor(entry.version, index);
                  const highlights = matchedHighlights.length > 0 ? matchedHighlights : entry.highlights ?? [];
                  return (
                    <Card key={id} id={id} className="scroll-mt-24 transition-shadow hover:shadow-md">
                      <CardHeader className="border-b bg-muted/30">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <CardTitle className="flex items-center gap-2 text-2xl">
                              <button
                                onClick={() => copyAnchor(id)}
                                aria-label={`Copy link to v${entry.version}`}
                                className="text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Hash className="h-5 w-5" />
                              </button>
                              <a href={`#${id}`} className="font-mono hover:text-primary transition-colors">
                                v{entry.version}
                              </a>
                            </CardTitle>
                            {releaseTypeBadge(entry.type)}
                            {entry.breaking_changes && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" /> Breaking
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">{formatDate(entry.date)}</Badge>
                        </div>
                        {entry.summary && (
                          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{entry.summary}</p>
                        )}
                      </CardHeader>
                      <CardContent className="pt-6">
                        {highlights.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No detailed highlights for this release.</p>
                        ) : (
                          <ul className="space-y-3">
                            {highlights.map((h, i) => {
                              const cls = classifyHighlight(h);
                              const meta = typeMeta(cls);
                              const Icon = meta.Icon;
                              return (
                                <li key={i} className="flex items-start gap-3">
                                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${meta.className}`}>
                                    <Icon className="h-3.5 w-3.5" />
                                  </span>
                                  <div className="flex-1 min-w-0 pt-0.5">
                                    <p className="text-sm leading-relaxed text-foreground/90">{h}</p>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {entry.standard_citations && entry.standard_citations.length > 0 && (
                          <div className="mt-5 pt-4 border-t flex flex-wrap items-center gap-2">
                            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground mr-1">Standards cited:</span>
                            {entry.standard_citations.map((s) => (
                              <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                            ))}
                          </div>
                        )}

                        <div className="mt-5 flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyAnchor(id)}
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <LinkIcon className="mr-1.5 h-3 w-3" /> Copy link
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </main>
            </div>
          )}

          {/* Compatibility promise */}
          <Card className="mt-12 border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <CheckCircle className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle className="text-lg">Backward compatibility promise</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    The Kang Open Banking v1 API follows a strict zero-breaking-changes policy. Existing fields, types, response codes, and security
                    declarations are ratcheted — once added, they are never removed. Deprecations carry a minimum 6-month sunset window with
                    <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Deprecation</code> and
                    <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Sunset</code> response headers.
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <AutoDocNavigation />
        </div>
      </div>
    </>
  );
}
