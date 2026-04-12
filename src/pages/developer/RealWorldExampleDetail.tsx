import { useParams, Link } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Check, Copy, Clock, BookOpen, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MermaidDiagram } from "@/components/developer/MermaidDiagram";

const exampleFiles: Record<string, () => Promise<string>> = {
  "01-merchant-onboarding-kyb-api-keys": () => import("../../../docs/examples/01-merchant-onboarding-kyb-api-keys.md?raw").then(m => m.default),
  "02-accept-payments-create-charge": () => import("../../../docs/examples/02-accept-payments-create-charge.md?raw").then(m => m.default),
  "03-add-money-account-funding": () => import("../../../docs/examples/03-add-money-account-funding.md?raw").then(m => m.default),
  "04-refunds": () => import("../../../docs/examples/04-refunds.md?raw").then(m => m.default),
  "05-payouts-single-bulk-paypal": () => import("../../../docs/examples/05-payouts-single-bulk-paypal.md?raw").then(m => m.default),
  "06-webhooks-merchant-outbound-deliveries-rotation": () => import("../../../docs/examples/06-webhooks-merchant-outbound-deliveries-rotation.md?raw").then(m => m.default),
  "07-settlements-reporting-exports-reconciliation": () => import("../../../docs/examples/07-settlements-reporting-exports-reconciliation.md?raw").then(m => m.default),
  "08-disputes-chargebacks-evidence": () => import("../../../docs/examples/08-disputes-chargebacks-evidence.md?raw").then(m => m.default),
  "09-open-banking-aisp-consent-accounts-transactions": () => import("../../../docs/examples/09-open-banking-aisp-consent-accounts-transactions.md?raw").then(m => m.default),
  "10-open-banking-pisp-consent-domestic-payment": () => import("../../../docs/examples/10-open-banking-pisp-consent-domestic-payment.md?raw").then(m => m.default),
  "11-build-marketplace-checkout": () => import("../../../docs/examples/11-build-marketplace-checkout.md?raw").then(m => m.default),
  "12-build-bank-data-aggregator": () => import("../../../docs/examples/12-build-bank-data-aggregator.md?raw").then(m => m.default),
};

const guideMeta: Record<string, { title: string; time: string }> = {
  "01-merchant-onboarding-kyb-api-keys": { title: "Merchant Onboarding, KYB & API Keys", time: "8 min" },
  "02-accept-payments-create-charge": { title: "Accept Payments — Create a Charge", time: "10 min" },
  "03-add-money-account-funding": { title: "Add Money — Account Funding", time: "7 min" },
  "04-refunds": { title: "Refunds", time: "5 min" },
  "05-payouts-single-bulk-paypal": { title: "Payouts — Single, Bulk & PayPal", time: "12 min" },
  "06-webhooks-merchant-outbound-deliveries-rotation": { title: "Webhooks — Setup, Deliveries & Rotation", time: "10 min" },
  "07-settlements-reporting-exports-reconciliation": { title: "Settlements, Reporting & Reconciliation", time: "8 min" },
  "08-disputes-chargebacks-evidence": { title: "Disputes & Chargebacks", time: "7 min" },
  "09-open-banking-aisp-consent-accounts-transactions": { title: "Open Banking AISP — Accounts & Transactions", time: "12 min" },
  "10-open-banking-pisp-consent-domestic-payment": { title: "Open Banking PISP — Domestic Payment", time: "10 min" },
  "11-build-marketplace-checkout": { title: "Build a Marketplace Checkout", time: "15 min" },
  "12-build-bank-data-aggregator": { title: "Build a Bank Data Aggregator", time: "15 min" },
};

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
    >
      {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
    </button>
  );
}

function extractToc(md: string) {
  const headings: { level: number; text: string; id: string }[] = [];
  const lines = md.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      const text = match[2].replace(/[`*]/g, "");
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      headings.push({ level: match[1].length, text, id });
    }
  }
  return headings;
}

function detectLanguage(className?: string): string {
  if (!className) return "";
  const match = className.match(/language-(\w+)/);
  if (!match) return "";
  const lang = match[1];
  const labels: Record<string, string> = {
    bash: "Shell", json: "JSON", javascript: "JavaScript", typescript: "TypeScript",
    python: "Python", php: "PHP", curl: "Shell", sh: "Shell", http: "HTTP",
  };
  return labels[lang] || lang.toUpperCase();
}

export default function RealWorldExampleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (slug && exampleFiles[slug]) {
      exampleFiles[slug]().then(setContent).catch(() => setError(true));
    } else {
      setError(true);
    }
  }, [slug]);

  const toc = useMemo(() => content ? extractToc(content) : [], [content]);
  const meta = slug ? guideMeta[slug] : null;

  if (error) {
    return (
      <div className="space-y-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-foreground">Example Not Found</h1>
        <p className="text-muted-foreground">The requested guide could not be found.</p>
        <Link to="/developer/examples/real-world">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Examples</Button>
        </Link>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="animate-pulse space-y-4 py-8">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded w-2/3" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  // Strip the first H1 from markdown since we render it separately
  const bodyContent = content.replace(/^#\s+.+\n*/, "");

  return (
    <div className="flex gap-10">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Breadcrumb & meta */}
        <div className="mb-8">
          <Link
            to="/developer/examples/real-world"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Integration Guides
          </Link>

          {meta && (
            <>
              <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">{meta.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Integration Guide</span>
                <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {meta.time} read</span>
              </div>
            </>
          )}
        </div>

        {/* Article */}
        <article className="prose prose-slate dark:prose-invert max-w-none
          prose-headings:scroll-mt-24 prose-headings:font-semibold
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border/50
          prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-[15px] prose-p:leading-7 prose-p:text-foreground/85
          prose-li:text-[15px] prose-li:leading-7
          prose-strong:text-foreground prose-strong:font-semibold
          prose-code:before:content-none prose-code:after:content-none
          prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-medium
          prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0
          prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
          prose-table:text-sm prose-table:border prose-table:border-border/60 prose-table:rounded-lg prose-table:overflow-hidden
          prose-th:bg-muted prose-th:px-4 prose-th:py-2.5 prose-th:text-left prose-th:font-semibold prose-th:text-foreground prose-th:text-xs prose-th:uppercase prose-th:tracking-wider
          prose-td:px-4 prose-td:py-2.5 prose-td:border-t prose-td:border-border/40
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        ">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2({ children, ...props }) {
                const text = typeof children === "string" ? children : String(children);
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                return <h2 id={id} {...props}>{children}</h2>;
              },
              h3({ children, ...props }) {
                const text = typeof children === "string" ? children : String(children);
                const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                return <h3 id={id} {...props}>{children}</h3>;
              },
              pre({ children }) {
                const codeEl = (children as any)?.props;
                const codeText = codeEl?.children || "";
                const className = codeEl?.className || "";
                const isMermaid = className === "language-mermaid";
                const lang = detectLanguage(className);

                if (isMermaid) {
                  return <MermaidDiagram chart={typeof codeText === "string" ? codeText : ""} />;
                }

                return (
                  <div className="my-5 rounded-xl border border-white/[0.08] bg-[#0d1117] overflow-hidden shadow-sm not-prose">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-[#161b22]">
                      <span className="text-xs font-medium text-gray-400">{lang}</span>
                      <CopyButton code={typeof codeText === "string" ? codeText : ""} />
                    </div>
                    <pre className="p-4 overflow-x-auto">
                      <code className="text-[13px] leading-6 font-mono text-[#e6edf3]">{codeText}</code>
                    </pre>
                  </div>
                );
              },
              code({ className, children, ...props }) {
                // Inline code only (block code is handled in pre)
                if (!className) {
                  return <code {...props}>{children}</code>;
                }
                return <code className={className} {...props}>{children}</code>;
              },
              table({ children, ...props }) {
                return (
                  <div className="my-5 rounded-xl border border-border/60 overflow-hidden not-prose">
                    <table className="w-full text-sm" {...props}>{children}</table>
                  </div>
                );
              },
              thead({ children, ...props }) {
                return <thead className="bg-muted" {...props}>{children}</thead>;
              },
              th({ children, ...props }) {
                return <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground" {...props}>{children}</th>;
              },
              td({ children, ...props }) {
                return <td className="px-4 py-2.5 border-t border-border/40 text-foreground/80" {...props}>{children}</td>;
              },
            }}
          >
            {bodyContent}
          </ReactMarkdown>
        </article>

        {/* Footer nav */}
        <div className="mt-12 pt-6 border-t border-border/50">
          <Link to="/developer/examples/real-world">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" /> All Integration Guides
            </Button>
          </Link>
        </div>
      </div>

      {/* Table of Contents sidebar */}
      {toc.length > 0 && (
        <aside className="hidden xl:block w-56 flex-shrink-0">
          <div className="sticky top-24">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">On this page</h4>
            <nav className="space-y-1">
              {toc.map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className={`block text-[13px] leading-5 text-muted-foreground hover:text-foreground transition-colors truncate ${
                    h.level === 3 ? "pl-3" : ""
                  }`}
                >
                  {h.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      )}
    </div>
  );
}
