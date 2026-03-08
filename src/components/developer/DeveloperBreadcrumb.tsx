import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const labelMap: Record<string, string> = {
  developer: "Developer Portal",
  "getting-started": "Getting Started",
  authentication: "Authentication",
  api: "API Reference",
  gateway: "Payment Gateway",
  guides: "Guides",
  sandbox: "Sandbox",
  "api-keys": "API Keys",
  "api-explorer": "API Explorer",
  console: "Console",
  charges: "Charges",
  verification: "Verification",
  "payment-links": "Payment Links",
  subscriptions: "Subscriptions",
  payouts: "Payouts",
  "instant-payouts": "Instant Payouts",
  "funding-intents": "Funding Intents",
  "split-payments": "Split Payments",
  settlements: "Settlements",
  refunds: "Refunds",
  disputes: "Disputes",
  webhooks: "Webhooks",
  "webhooks-v2": "Webhooks v2",
  "error-codes": "Error Codes",
  "rate-limits": "Rate Limits",
  idempotency: "Idempotency",
  aisp: "AISP",
  pisp: "PISP",
  banking: "Banking",
  transfers: "Transfers",
  beneficiaries: "Beneficiaries",
  "mobile-money": "Mobile Money",
  currencies: "Currencies",
  countries: "Countries",
  testing: "Testing",
  status: "Status",
  changelog: "Changelog",
  examples: "Code Examples",
  web: "Web Apps",
  mobile: "Mobile Apps",
  sdks: "SDKs",
  quickstart: "Quickstart",
  certificates: "Certificates",
  wallets: "Wallets",
  escrow: "Escrow",
  treasury: "Treasury",
  compliance: "Compliance",
  sla: "SLA",
  tokenization: "Tokenization",
  exports: "Exports",
};

export function DeveloperBreadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((seg, i) => ({
    label: labelMap[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    path: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
          {crumb.isLast ? (
            <span className="font-medium text-foreground truncate max-w-[200px]">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="hover:text-foreground transition-colors truncate max-w-[150px]">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
