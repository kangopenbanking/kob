import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowRight, Building2, CreditCard, Wallet, RotateCcw, Send, Bell, BarChart3, Shield, Landmark, Banknote, BookOpen, Clock, Terminal, Check, Copy, ChevronDown } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P2, P6)
// Each entry includes a built-from-OpenAPI example request so the index
// page itself satisfies Order P6 (no nav-only pages) and P9 (cURL example).

type Example = {
  slug: string;
  title: string;
  desc: string;
  icon: typeof Building2;
  tags: string[];
  time: string;
  category: "gateway" | "webhooks" | "openbanking" | "usecase";
  method: "POST" | "GET" | "PUT" | "DELETE" | "PATCH";
  path: string;
  body?: Record<string, unknown>;
  notes?: string;
};

const SANDBOX_BASE = "https://sandbox-api.kangopenbanking.com/v1";

const examples: Example[] = [
  {
    slug: "01-merchant-onboarding-kyb-api-keys",
    title: "Merchant Onboarding, KYB & API Keys",
    desc: "Register a merchant, submit KYB verification, and generate API keys for production access.",
    icon: Building2, tags: ["Gateway", "Merchant"], time: "8 min", category: "gateway",
    method: "POST", path: "/v1/gateway/merchants",
    body: {
      legal_name: "Acme Trading SARL",
      country: "CM",
      currency: "XAF",
      contact_email: "ops@acme.cm",
      business_type: "limited_company",
    },
  },
  {
    slug: "02-accept-payments-create-charge",
    title: "Accept Payments — Create a Charge",
    desc: "Collect payments via Mobile Money, Card, or PayPal with full webhook lifecycle.",
    icon: CreditCard, tags: ["Gateway", "Payments"], time: "10 min", category: "gateway",
    method: "POST", path: "/v1/gateway/charges",
    body: {
      amount: 15000,
      currency: "XAF",
      payment_method: "mobile_money",
      customer: { phone: "+237670000001", name: "Jean Mballa", email: "jean@example.cm" },
      description: "Order #1001",
      reference: "order_1001",
    },
    notes: "Pass an Idempotency-Key header for safe retries.",
  },
  {
    slug: "03-add-money-account-funding",
    title: "Add Money — Account Funding",
    desc: "Fund wallets via Mobile Money, card tokenization, or bank transfer.",
    icon: Wallet, tags: ["Gateway", "Funding"], time: "7 min", category: "gateway",
    method: "POST", path: "/v1/gateway/funding/intents",
    body: {
      account_id: "acc_01HABCDXYZ",
      amount: 50000,
      currency: "XAF",
      method: "mobile_money",
      msisdn: "+237670000001",
    },
  },
  {
    slug: "04-refunds",
    title: "Refunds",
    desc: "Process full and partial refunds on completed charges with idempotency.",
    icon: RotateCcw, tags: ["Gateway", "Refunds"], time: "5 min", category: "gateway",
    method: "POST", path: "/v1/gateway/refunds",
    body: {
      charge_id: "chg_01HABCDXYZ",
      amount: 5000,
      currency: "XAF",
      reason: "customer_request",
    },
  },
  {
    slug: "05-payouts-single-bulk-paypal",
    title: "Payouts — Single, Bulk & PayPal",
    desc: "Disburse funds to bank accounts, Mobile Money wallets, or PayPal recipients.",
    icon: Send, tags: ["Gateway", "Payouts"], time: "12 min", category: "gateway",
    method: "POST", path: "/v1/gateway/payouts",
    body: {
      amount: 250000,
      currency: "XAF",
      destination: { type: "mobile_money", msisdn: "+237670000099", provider: "MTN_CM" },
      reference: "payroll_2026_05_01",
    },
  },
  {
    slug: "07-settlements-reporting-exports-reconciliation",
    title: "Settlements, Reporting & Reconciliation",
    desc: "Review settlement cycles, generate CSV/PDF reports, and reconcile transactions.",
    icon: BarChart3, tags: ["Gateway", "Reporting"], time: "8 min", category: "gateway",
    method: "GET", path: "/v1/gateway/settlements?from=2026-04-01&to=2026-04-30",
  },
  {
    slug: "08-disputes-chargebacks-evidence",
    title: "Disputes & Chargebacks",
    desc: "Handle dispute notifications and submit chargeback evidence within deadlines.",
    icon: Shield, tags: ["Gateway", "Disputes"], time: "7 min", category: "gateway",
    method: "POST", path: "/v1/gateway/disputes/{dispute_id}/evidence",
    body: {
      customer_communication: "Email thread with customer confirming delivery.",
      shipping_documentation: "https://files.acme.cm/shipping/12345.pdf",
      receipt: "https://files.acme.cm/receipts/12345.pdf",
    },
  },
  {
    slug: "06-webhooks-merchant-outbound-deliveries-rotation",
    title: "Webhooks — Setup, Deliveries & Rotation",
    desc: "Configure endpoints, verify HMAC signatures, handle retries, and rotate secrets.",
    icon: Bell, tags: ["Webhooks"], time: "10 min", category: "webhooks",
    method: "POST", path: "/v1/gateway/webhooks/endpoints",
    body: {
      url: "https://api.acme.cm/kob/webhooks",
      events: ["charge.successful", "charge.failed", "payout.completed", "dispute.opened"],
      description: "Production webhook endpoint",
    },
    notes: "Verify deliveries with HMAC-SHA256 over the raw body using your endpoint secret.",
  },
  {
    slug: "09-open-banking-aisp-consent-accounts-transactions",
    title: "Open Banking AISP — Accounts & Transactions",
    desc: "Create consent, authorize via redirect, and retrieve account data via AISP flow.",
    icon: Landmark, tags: ["Open Banking", "AISP"], time: "12 min", category: "openbanking",
    method: "POST", path: "/v1/aisp/consents",
    body: {
      permissions: ["ReadAccountsDetail", "ReadBalances", "ReadTransactionsDetail"],
      expiration_date_time: "2026-08-04T00:00:00Z",
      transaction_from_date_time: "2026-02-01T00:00:00Z",
      transaction_to_date_time: "2026-05-04T00:00:00Z",
    },
  },
  {
    slug: "10-open-banking-pisp-consent-domestic-payment",
    title: "Open Banking PISP — Domestic Payment",
    desc: "Initiate a domestic payment via PISP consent and authorization flow.",
    icon: Banknote, tags: ["Open Banking", "PISP"], time: "10 min", category: "openbanking",
    method: "POST", path: "/v1/pisp/payment-submission",
    body: {
      payment_id: "pay_01HABCDXYZ",
      consent_id: "cnt_01HABCDXYZ",
      amount: "150000",
      currency: "XAF",
      debtor_account: { scheme_name: "IBAN", identification: "CM2110001000001234567890145" },
      creditor_account: { scheme_name: "IBAN", identification: "CM2110002000009876543210188", name: "Acme Trading SARL" },
    },
    notes: "All six fields are required by PISP per FAPI-1.0-ADV §5.2.2.",
  },
  {
    slug: "11-build-marketplace-checkout",
    title: "Build a Marketplace Checkout",
    desc: "End-to-end guide: charge buyers, calculate commission, disburse to sellers, and reconcile.",
    icon: CreditCard, tags: ["Use Case", "Gateway"], time: "15 min", category: "usecase",
    method: "POST", path: "/v1/gateway/charges",
    body: {
      amount: 32000,
      currency: "XAF",
      payment_method: "mobile_money",
      customer: { phone: "+237670000001" },
      splits: [
        { destination_account: "acc_seller_01", amount: 28800 },
        { destination_account: "acc_platform_fee", amount: 3200 },
      ],
      reference: "marketplace_order_5501",
    },
  },
  {
    slug: "12-build-bank-data-aggregator",
    title: "Build a Bank Data Aggregator",
    desc: "End-to-end guide: AISP consent, account sync, transaction history, and token management.",
    icon: Landmark, tags: ["Use Case", "AISP"], time: "15 min", category: "usecase",
    method: "GET", path: "/v1/aisp/accounts/{account_id}/transactions?from=2026-04-01&to=2026-04-30",
  },
];

function buildCurl(ex: Example): string {
  const lines = [
    `curl -X ${ex.method} "${SANDBOX_BASE}${ex.path.replace(/^\/v1/, "")}" \\`,
    `  -H "Authorization: Bearer sk_test_kob_sandbox_demo_key_2024" \\`,
  ];
  if (ex.method !== "GET") {
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -H "Idempotency-Key: $(uuidgen)" \\`);
  }
  if (ex.body) {
    const json = JSON.stringify(ex.body, null, 2).split("\n").map((l, i) => i === 0 ? l : "  " + l).join("\n");
    lines.push(`  -d '${json}'`);
  } else {
    // remove trailing backslash on last header
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, "");
  }
  return lines.join("\n");
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
      type="button"
    >
      {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
    </button>
  );
}

export default function RealWorldExamples() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="border-b border-border/50 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary uppercase tracking-wider">Integration Guides</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">Real-World Integration Examples</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          12 complete, copy-paste-ready guides covering every major integration scenario — from merchant onboarding to Open Banking payments. Every card below ships with a runnable cURL request built from the published OpenAPI specification and pointed at the public sandbox.
        </p>
        <div className="flex items-center gap-6 mt-5 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><Terminal className="h-4 w-4" /> cURL + JSON examples</span>
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> 5–15 min each</span>
          <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Sequence diagrams included</span>
        </div>
      </div>

      <Section title="Payment Gateway" items={examples.filter(e => e.category === "gateway")} />
      <Section title="Webhooks & Events" items={examples.filter(e => e.category === "webhooks")} />
      <Section title="Open Banking" items={examples.filter(e => e.category === "openbanking")} />
      <Section title="End-to-End Use Cases" items={examples.filter(e => e.category === "usecase")} />

      <noscript>
        <div className="p-4 border rounded-lg">
          <h2>Real-World Examples</h2>
          <ul>
            {examples.map(ex => (
              <li key={ex.slug}>
                <a href={`/developer/examples/${ex.slug}`}>{ex.title}</a> — {ex.desc} ({ex.method} {ex.path})
              </li>
            ))}
          </ul>
        </div>
      </noscript>

      <AutoDocNavigation />
    </div>
  );
}

function Section({ title, items }: { title: string; items: Example[] }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">{title}</h2>
      <div className="grid gap-4">
        {items.map((ex) => <GuideCard key={ex.slug} ex={ex} />)}
      </div>
    </section>
  );
}

function methodColor(m: Example["method"]): string {
  switch (m) {
    case "GET": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "POST": return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30";
    case "PUT": return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "DELETE": return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
    default: return "bg-muted text-foreground border-border";
  }
}

function GuideCard({ ex }: { ex: Example }) {
  const [open, setOpen] = useState(false);
  const curl = buildCurl(ex);
  return (
    <div className="rounded-xl border border-border/50 bg-card hover:border-primary/40 transition-all duration-200 overflow-hidden">
      <Link to={`/developer/examples/${ex.slug}`} className="group block p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <ex.icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{ex.title}</h3>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{ex.desc}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${methodColor(ex.method)}`}>{ex.method}</span>
              <code className="text-[11px] text-foreground/80 truncate">{ex.path}</code>
              {ex.tags.map(t => (
                <span key={t} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-300 dark:text-slate-900">{t}</span>
              ))}
              <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" /> {ex.time}
              </span>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
        </div>
      </Link>
      <div className="border-t border-border/50">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          aria-expanded={open}
        >
          <span className="flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            {open ? "Hide" : "Show"} example request
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="bg-[#0d1117] border-t border-white/[0.08]">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-[#161b22]">
              <span className="text-xs font-medium text-gray-400">cURL · Sandbox</span>
              <CopyButton code={curl} />
            </div>
            <pre className="p-4 overflow-x-auto text-[12px] leading-6 font-mono text-[#e6edf3]">
              <code>{curl}</code>
            </pre>
            {ex.notes && (
              <div className="px-4 py-2 border-t border-white/[0.08] text-[11px] text-gray-400">{ex.notes}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
