import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ShieldCheck,
  KeyRound,
  Webhook,
  Banknote,
  Undo2,
  AlertTriangle,
  ListChecks,
  Wallet,
  ArrowRight,
} from "lucide-react";

interface MerchantTopic {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const TOPICS: MerchantTopic[] = [
  {
    title: "Merchant onboarding",
    description:
      "Step-by-step guide to creating a merchant account, choosing an environment (sandbox or production), and going live.",
    href: "/developer/onboarding-guide",
    icon: Building2,
  },
  {
    title: "KYB verification",
    description:
      "Know-Your-Business document requirements, COBAC/CEMAC compliance fields, review timelines, and reason codes used by the admin queue.",
    href: "/developer/compliance/kyc",
    icon: ShieldCheck,
  },
  {
    title: "API keys (sandbox & production)",
    description:
      "Generate, rotate, and revoke restricted API keys with per-permission scoping. The plaintext secret is shown ONCE — see the cryptographic key governance rules. Audit log included.",
    href: "/developer/merchants/api-keys",
    icon: KeyRound,
    badge: "shown once",
  },
  {
    title: "Webhooks (outbound)",
    description:
      "Receive event callbacks from KOB. Includes signature verification (HMAC-SHA256 X-KOB-Signature), 7-attempt retry policy, replay endpoint, and dedupe via webhook_inbox.",
    href: "/developer/gateway/webhooks",
    icon: Webhook,
  },
  {
    title: "Provider webhook receivers (inbound)",
    description:
      "Public URLs that accept Stripe, Flutterwave, and PayPal webhooks. Documents required signature headers and the shared (source, event_id) deduplication contract.",
    href: "/developer/webhooks/provider-receivers",
    icon: Webhook,
  },
  {
    title: "Settlements",
    description:
      "Daily/weekly/monthly settlement schedules, statement downloads, and the settlement bank account flow. Reads from /v1/gateway/settlements and /v1/gateway/statements.",
    href: "/developer/gateway/settlements",
    icon: Banknote,
  },
  {
    title: "Refunds",
    description:
      "Full and partial refunds, reason codes, idempotency requirements, and how refund events propagate to webhooks and reconciliation.",
    href: "/developer/gateway/refunds",
    icon: Undo2,
  },
  {
    title: "Disputes & chargebacks",
    description:
      "Dispute lifecycle (Kanban view), evidence upload, SLA timers, and the merchant-side dispute portal.",
    href: "/developer/gateway/disputes",
    icon: AlertTriangle,
  },
  {
    title: "Reconciliation & exports",
    description:
      "Daily reconciliation runs across charges, payouts, fees, and settlements. Bucketed mismatches, CSV/XLSX exports, and the /v1/gateway/reconciliation/{runId} endpoint.",
    href: "/developer/api/exports",
    icon: ListChecks,
  },
  {
    title: "Funding (Flutterwave / Stripe / PayPal / bank)",
    description:
      "Top up the merchant wallet via Flutterwave, Stripe, PayPal, or bank transfer. Funding intents, hosted checkout, and inbound webhook receivers.",
    href: "/developer/gateway/funding-intents",
    icon: Wallet,
  },
];


const jsonLd = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "Merchant integration documentation — Kang Open Banking",
  "description":
    "Index of merchant-focused documentation: onboarding, KYB, API keys, webhooks, settlements, refunds, disputes, reconciliation, and funding.",
  "url": "https://kangopenbanking.com/developer/merchants",
  "datePublished": "2026-04-30",
  "author": { "@type": "Organization", "name": "Kang Open Banking" },
};

export default function MerchantsDocsHub() {
  return (
    <>
      <Helmet>
        <title>Merchants — Developer Documentation | Kang Open Banking</title>
        <meta
          name="description"
          content="Merchant integration guide: onboarding, KYB, API keys, webhooks, settlements, refunds, disputes, reconciliation, and funding for the Kang Open Banking payment gateway."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/merchants" />
        <meta property="og:title" content="Merchants — Kang Open Banking developer docs" />
        <meta
          property="og:description"
          content="Everything a merchant integrator needs: onboarding, KYB, API keys, webhooks, settlements, refunds, disputes, reconciliation, and funding."
        />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://kangopenbanking.com/developer/merchants" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <article className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-10 space-y-3">
          <Badge variant="outline" className="font-medium">Merchants</Badge>
          <h1 className="text-4xl font-bold tracking-tight">
            Merchant integration documentation
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            A focused index of every page a payment-accepting business needs to
            integrate with Kang Open Banking — from first signup to ongoing
            settlement, reconciliation, and funding operations.
          </p>
        </header>

        <section aria-labelledby="topics" className="mb-12">
          <h2 id="topics" className="sr-only">Topics</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {TOPICS.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  to={t.href}
                  className="group rounded-lg border bg-card transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full border-0 bg-transparent shadow-none">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground">
                            <Icon className="h-4 w-4" />
                          </span>
                          <CardTitle className="text-base font-semibold">
                            {t.title}
                          </CardTitle>
                        </div>
                        {t.badge ? (
                          <Badge variant="outline" className="text-xs">{t.badge}</Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-5">
                      <CardDescription className="text-sm leading-relaxed">
                        {t.description}
                      </CardDescription>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Read guide
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="pagination" className="rounded-lg border bg-card p-6 mb-8">
          <h2 id="pagination" className="text-base font-semibold mb-2">Pagination contract</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Every list endpoint accepts <code>page</code> (1-based, default 1) and{" "}
            <code>limit</code> (max 100, default 20), or an opaque <code>cursor</code>{" "}
            from the previous response. Responses always wrap results in a{" "}
            <code>PaginatedResponse</code> envelope: <code>{`{ data, pagination, meta }`}</code>.
          </p>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
{`# Page-based (recommended starter)
curl "https://api.kangopenbanking.com/v1/gateway/charges?page=1&limit=20&status=successful" \\
  -H "Authorization: Bearer $KOB_API_KEY"

# Cursor-based (recommended for large result sets)
curl "https://api.kangopenbanking.com/v1/gateway/charges?cursor=eyJpZCI6IjEyMyJ9&limit=50" \\
  -H "Authorization: Bearer $KOB_API_KEY"

# Response shape (PaginatedResponse)
{
  "data": [ /* charge objects */ ],
  "pagination": {
    "page": 1, "limit": 20, "total": 142,
    "next_cursor": "eyJpZCI6IjE0MiJ9", "has_more": true
  },
  "meta": { "request_id": "req_…", "api_version": "4.26.3" }
}`}
          </pre>
          <p className="text-xs text-muted-foreground mt-2">
            Reference: <code>CursorParam</code>, <code>LimitParam</code>, <code>PageParam</code>{" "}
            and the <code>PaginatedResponse</code> schema in{" "}
            <Link to="/openapi.json" className="text-primary hover:underline">/openapi.json</Link>.
          </p>
        </section>

        <section
          aria-labelledby="related"
          className="rounded-lg border bg-card p-6"
        >
          <h2 id="related" className="text-base font-semibold mb-3">Related references</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>
              <Link to="/developer/api-explorer" className="text-primary hover:underline">
                Interactive API explorer
              </Link>
            </li>
            <li>
              <Link to="/developer/openapi" className="text-primary hover:underline">
                OpenAPI specification (JSON / YAML)
              </Link>
            </li>
            <li>
              <Link to="/developer/changelog" className="text-primary hover:underline">
                API changelog
              </Link>
            </li>
            <li>
              <Link to="/developer/error-codes" className="text-primary hover:underline">
                Error codes reference (RFC 7807)
              </Link>
            </li>
            <li>
              <Link to="/developer/sandbox" className="text-primary hover:underline">
                Sandbox environment & test credentials
              </Link>
            </li>
            <li>
              <Link to="/developer/sdks" className="text-primary hover:underline">
                Official SDKs (Node, Python, PHP, Go)
              </Link>
            </li>
          </ul>
        </section>
      </article>
    </>
  );
}
