// PERMANENT PUBLIC ROUTE HELPER — DO NOT REMOVE OR REDIRECT
// Surfaces operational reliability docs (SDKs, Postman, rate limits, retries,
// idempotency, pagination, token lifecycle) on /developer so crawlers and AI
// agents discover them via the landing page — not just the sitemap.
import { Link } from "react-router-dom";
import {
  Package,
  Send,
  Gauge,
  RefreshCw,
  KeySquare,
  ListOrdered,
  Webhook,
  Clock,
  GitBranch,
  CircleDot,
  ArrowRightLeft,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  KeyRound,
  Globe,
  CalendarClock,
  FileCheck,
} from "lucide-react";

const items = [
  {
    href: "/developer/guides/sdks",
    title: "Official SDKs",
    desc: "Node.js, Python, PHP, and Go client libraries with installation guides and working examples.",
    icon: Package,
  },
  {
    href: "/developer/guides/postman",
    title: "Postman collection",
    desc: "Pre-configured Postman environment for sandbox and production with every endpoint ready to call.",
    icon: Send,
  },
  {
    href: "/developer/api-reference/rate-limits",
    title: "Rate limits",
    desc: "Per-tier RPS, burst capacity, X-RateLimit-* headers, and 429 backoff guidance for production traffic.",
    icon: Gauge,
  },
  {
    href: "/developer/api-reference/webhook-retry",
    title: "Retry strategy",
    desc: "7-attempt exponential backoff for outbound webhooks, signed deliveries, and a manual replay endpoint.",
    icon: RefreshCw,
  },
  {
    href: "/developer/api-reference/idempotency",
    title: "Idempotency keys",
    desc: "UUID v4 idempotency-key contract for every state-changing call. Required for safe retries on payments.",
    icon: KeySquare,
  },
  {
    href: "/developer/api-reference/pagination",
    title: "Pagination standard",
    desc: "Cursor-based pagination with RFC 5988 Link headers and a next_cursor field on every list endpoint.",
    icon: ListOrdered,
  },
  {
    href: "/developer/api-reference/token-lifecycle",
    title: "Token lifecycle",
    desc: "OAuth 2.0 access and refresh rotation, SHA-256 hashing, and immediate revoke-on-reuse semantics.",
    icon: Clock,
  },
  {
    href: "/developer/api-reference/payment-lifecycle",
    title: "Payment lifecycle",
    desc: "Sequence diagrams and state machines for charges, payouts, refunds, and disputes — every transition documented.",
    icon: GitBranch,
  },
  {
    href: "/developer/api-reference/charge-states",
    title: "Charge states",
    desc: "State machine for charges: pending, processing, succeeded, failed, refunded, disputed, resolved — with webhook mapping.",
    icon: CircleDot,
  },
  {
    href: "/developer/api-reference/payout-states",
    title: "Payout states",
    desc: "State machine for payouts: queued, processing, paid, failed, returned — including bank-rail return semantics.",
    icon: ArrowRightLeft,
  },
  {
    href: "/developer/api-reference/dispute-lifecycle",
    title: "Dispute lifecycle",
    desc: "Chargeback flow: needs_response, under_review, won, lost — SLA windows and evidence submission contract.",
    icon: ShieldAlert,
  },
  {
    href: "/developer/idempotency-playground",
    title: "Idempotency playground",
    desc: "Live sandbox tool to replay the same idempotency key and observe the cached response.",
    icon: Webhook,
  },
  {
    href: "/developer/standards",
    title: "Standards & compliance",
    desc: "FAPI 1.0 Advanced, OBIE 4.0.1, RFC 7591 DCR, ISO 20022, COBAC — full conformance index for bank procurement.",
    icon: ShieldCheck,
  },
  {
    href: "/developer/security/sca",
    title: "Strong Customer Authentication",
    desc: "Step-up flow for payments, consents, and account changes — challenge issuance, verification, and full SCA payment sequence.",
    icon: ShieldQuestion,
  },
  {
    href: "/developer/security/jwks",
    title: "JWKS & key material",
    desc: "Public signing keys for ID tokens, signed request objects, and webhook signatures. RFC 7517 with 90-day rotation.",
    icon: KeyRound,
  },
  {
    href: "/developer/environments",
    title: "Environments",
    desc: "Sandbox vs. production base URLs, OAuth/PAR/JWKS endpoints, rate limits, mTLS posture, IP allow-list, SLA.",
    icon: Globe,
  },
  {
    href: "/developer/api-reference/deprecation-policy",
    title: "Deprecation policy",
    desc: "RFC 8594 Sunset headers, 12-month minimum window, successor links, migration playbook — Standing Order 1 enforced.",
    icon: CalendarClock,
  },
  {
    href: "/developer/open-banking/consents",
    title: "Consent management",
    desc: "Create, read, and revoke AISP/PISP consents — status transitions, scope mapping, and expiry semantics.",
    icon: FileCheck,
  },
];

export function BuildReliablySection() {
  return (
    <section
      id="build-reliably"
      aria-label="Build reliably — SDKs, Postman, rate limits, retries, idempotency, pagination"
      className="container mx-auto px-4"
    >
      <div className="max-w-3xl mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Build reliably</h2>
        <p className="mt-3 text-muted-foreground">
          Everything production teams need to integrate confidently — official
          SDKs, a Postman collection, and the operational contracts (rate limits,
          retries, idempotency, pagination) that make payments behave predictably
          under load.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(({ href, title, desc, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground group-hover:text-primary">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <h3 className="text-base font-semibold">{title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {desc}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
