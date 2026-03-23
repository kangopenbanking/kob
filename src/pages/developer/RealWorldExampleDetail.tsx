import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
};

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80 text-muted-foreground"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
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

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Example Not Found</h1>
        <p className="text-muted-foreground">The requested example guide could not be found.</p>
        <Link to="/developer/examples"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Examples</Button></Link>
      </div>
    );
  }

  if (!content) {
    return <div className="animate-pulse space-y-4"><div className="h-8 bg-muted rounded w-1/2" /><div className="h-4 bg-muted rounded w-3/4" /><div className="h-64 bg-muted rounded" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/developer/examples">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> All Examples</Button>
        </Link>
        <Badge variant="outline">Real-World Guide</Badge>
      </div>

      <article className="prose prose-slate dark:prose-invert max-w-none
        prose-headings:scroll-mt-20
        prose-code:before:content-none prose-code:after:content-none
        prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
        prose-pre:bg-[#0d1117] prose-pre:text-[#e6edf3] prose-pre:overflow-x-auto
        prose-table:text-sm
        prose-th:bg-muted prose-th:px-3 prose-th:py-2
        prose-td:px-3 prose-td:py-2 prose-td:border-t
      ">
        <ReactMarkdown
          components={{
            pre({ children, ...props }) {
              const codeEl = (children as any)?.props;
              const codeText = codeEl?.children || "";
              return (
                <div className="relative group">
                  <CopyButton code={typeof codeText === "string" ? codeText : ""} />
                  <pre {...props}>{children}</pre>
                </div>
              );
            },
            code({ className, children, ...props }) {
              const isMermaid = className === "language-mermaid";
              if (isMermaid) {
                return <div className="p-4 border rounded-lg bg-muted/50 text-sm font-mono overflow-x-auto whitespace-pre">{children}</div>;
              }
              const isInline = !className;
              if (isInline) {
                return <code {...props}>{children}</code>;
              }
              return <code className={className} {...props}>{children}</code>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </article>

      <div className="border-t pt-6">
        <Link to="/developer/examples">
          <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to All Examples</Button>
        </Link>
      </div>
    </div>
  );
}
