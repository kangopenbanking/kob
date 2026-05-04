import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight, BookOpen, Clock, Terminal, Check, Copy, ChevronDown,
  Play, Loader2, ShieldCheck,
} from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import {
  examples, buildSnippets, mockResponse, SANDBOX_BASE, SANDBOX_KEY,
  type Example, type Snippet,
} from "./realWorldExamplesData";

// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P2, P6, P9)

function methodColor(m: Example["method"]): string {
  switch (m) {
    case "GET": return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "POST": return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30";
    case "PUT": return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "DELETE": return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30";
    default: return "bg-muted text-foreground border-border";
  }
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
    >
      {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
    </button>
  );
}

export default function RealWorldExamples() {
  const sections: { id: Example["category"]; title: string; subtitle: string }[] = [
    { id: "gateway",     title: "Payment Gateway",        subtitle: "Charges, refunds, payouts, settlements & disputes" },
    { id: "webhooks",    title: "Webhooks & Events",      subtitle: "Endpoints, HMAC verification & secret rotation" },
    { id: "openbanking", title: "Open Banking",           subtitle: "AISP & PISP flows aligned with FAPI 1.0 Advanced" },
    { id: "usecase",     title: "End-to-End Use Cases",   subtitle: "Production-ready application blueprints" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="border-b border-border/50 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary uppercase tracking-wider">Integration Guides</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">Real-World Integration Examples</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Twelve production-ready integration guides covering every major scenario — each card ships with cURL, Node.js, Python and PHP requests built directly from the published OpenAPI specification, plus a one-click Try-it sandbox console.
        </p>
        <div className="flex items-center gap-6 mt-5 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><Terminal className="h-4 w-4" /> cURL · Node · Python · PHP</span>
          <span className="flex items-center gap-1.5"><Play className="h-4 w-4" /> Try-it sandbox console</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Validated against openapi.json</span>
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> 5–15 min each</span>
        </div>
      </div>

      {sections.map(s => {
        const items = examples.filter(e => e.category === s.id);
        if (!items.length) return null;
        return (
          <section key={s.id}>
            <header className="mb-5">
              <h2 className="text-xl font-semibold text-foreground">{s.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{s.subtitle}</p>
            </header>
            <div className="grid gap-5 md:grid-cols-2">
              {items.map(ex => <GuideCard key={ex.slug} ex={ex} />)}
            </div>
          </section>
        );
      })}

      <noscript>
        <div className="p-4 border rounded-lg">
          <h2>Real-World Examples</h2>
          <ul>
            {examples.map(ex => (
              <li key={ex.slug}>
                <a href={`/developer/examples/${ex.slug}`}>{ex.title}</a> — {ex.method} {ex.specPath}
              </li>
            ))}
          </ul>
        </div>
      </noscript>

      <AutoDocNavigation />
    </div>
  );
}

function GuideCard({ ex }: { ex: Example }) {
  const [open, setOpen] = useState(false);
  const snippets = buildSnippets(ex);
  const [lang, setLang] = useState<Snippet["language"]>("curl");
  const active = snippets.find(s => s.language === lang)!;

  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: unknown; ms: number } | null>(null);

  const runTryIt = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setRunning(true); setResponse(null);
    const start = performance.now();
    // Simulated latency 350-900ms; uses local mock so no auth required.
    const delay = 350 + Math.random() * 550;
    window.setTimeout(() => {
      const r = mockResponse(ex);
      setResponse({ ...r, ms: Math.round(performance.now() - start) });
      setRunning(false);
    }, delay);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-200 overflow-hidden flex flex-col">
      <Link to={`/developer/examples/${ex.slug}`} className="group block p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-center group-hover:border-primary/40 transition-colors">
            <ex.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">{ex.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{ex.desc}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${methodColor(ex.method)}`}>{ex.method}</span>
              <code className="text-[11px] text-foreground/80 truncate font-mono">{ex.specPath}</code>
              {ex.tags.map(t => (
                <span key={t} className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground">{t}</span>
              ))}
              <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" /> {ex.time}
              </span>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
        </div>
      </Link>

      <div className="border-t border-border/60 mt-auto">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          aria-expanded={open}
        >
          <span className="flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            {open ? "Hide" : "Show"} request &amp; Try-it console
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="border-t border-border/60">
            {/* Language tabs */}
            <div className="flex items-center gap-1 px-3 pt-3 pb-2 bg-muted/40 border-b border-border/40 overflow-x-auto">
              {snippets.map(s => (
                <button
                  key={s.language}
                  type="button"
                  onClick={() => setLang(s.language)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap ${
                    lang === s.language
                      ? "bg-background border-border text-foreground"
                      : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={runTryIt}
                  disabled={running}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {running ? <><Loader2 className="h-3 w-3 animate-spin" /> Running</> : <><Play className="h-3 w-3" /> Try it</>}
                </button>
              </div>
            </div>

            {/* Snippet */}
            <div className="bg-[#0d1117]">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-[#161b22]">
                <span className="text-xs font-medium text-gray-400">{active.label} · sandbox</span>
                <CopyButton code={active.code} />
              </div>
              <pre className="p-4 overflow-x-auto text-[12px] leading-6 font-mono text-[#e6edf3] max-h-80">
                <code>{active.code}</code>
              </pre>
            </div>

            {/* Response panel */}
            {response && (
              <div className="bg-[#0a0f17] border-t border-white/[0.08]">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-[#11161f]">
                  <span className="text-xs font-medium text-gray-400 flex items-center gap-2">
                    Response
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                      response.status < 300 ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : response.status < 500 ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                    }`}>{response.status}</span>
                    <span className="text-[10px] text-gray-500">{response.ms} ms · simulated</span>
                  </span>
                  <CopyButton code={JSON.stringify(response.body, null, 2)} />
                </div>
                <pre className="p-4 overflow-x-auto text-[12px] leading-6 font-mono text-[#9cdcfe] max-h-72">
                  <code>{JSON.stringify(response.body, null, 2)}</code>
                </pre>
              </div>
            )}

            {ex.notes && (
              <div className="px-4 py-2.5 text-[11px] text-muted-foreground bg-muted/30 border-t border-border/40">
                {ex.notes}
              </div>
            )}
            <div className="px-4 py-2 text-[10px] text-muted-foreground bg-background border-t border-border/40 flex flex-wrap gap-3">
              <span>Base: <code className="text-foreground/80">{SANDBOX_BASE}</code></span>
              <span>Sandbox key: <code className="text-foreground/80">{SANDBOX_KEY}</code></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
