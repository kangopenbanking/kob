import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, CreditCard, Wallet, RotateCcw, Send, Bell, BarChart3, Shield, Landmark, Banknote, BookOpen, Clock, Terminal } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const examples = [
  { slug: "01-merchant-onboarding-kyb-api-keys", title: "Merchant Onboarding, KYB & API Keys", desc: "Register a merchant, submit KYB verification, and generate API keys for production access.", icon: Building2, tags: ["Gateway", "Merchant"], time: "8 min", category: "gateway" },
  { slug: "02-accept-payments-create-charge", title: "Accept Payments — Create a Charge", desc: "Collect payments via Mobile Money, Card, or PayPal with full webhook lifecycle.", icon: CreditCard, tags: ["Gateway", "Payments"], time: "10 min", category: "gateway" },
  { slug: "03-add-money-account-funding", title: "Add Money — Account Funding", desc: "Fund wallets via Mobile Money, card tokenization, or bank transfer.", icon: Wallet, tags: ["Gateway", "Funding"], time: "7 min", category: "gateway" },
  { slug: "04-refunds", title: "Refunds", desc: "Process full and partial refunds on completed charges with idempotency.", icon: RotateCcw, tags: ["Gateway", "Refunds"], time: "5 min", category: "gateway" },
  { slug: "05-payouts-single-bulk-paypal", title: "Payouts — Single, Bulk & PayPal", desc: "Disburse funds to bank accounts, Mobile Money wallets, or PayPal recipients.", icon: Send, tags: ["Gateway", "Payouts"], time: "12 min", category: "gateway" },
  { slug: "06-webhooks-merchant-outbound-deliveries-rotation", title: "Webhooks — Setup, Deliveries & Rotation", desc: "Configure endpoints, verify HMAC signatures, handle retries, and rotate secrets.", icon: Bell, tags: ["Webhooks"], time: "10 min", category: "webhooks" },
  { slug: "07-settlements-reporting-exports-reconciliation", title: "Settlements, Reporting & Reconciliation", desc: "Review settlement cycles, generate CSV/PDF reports, and reconcile transactions.", icon: BarChart3, tags: ["Gateway", "Reporting"], time: "8 min", category: "gateway" },
  { slug: "08-disputes-chargebacks-evidence", title: "Disputes & Chargebacks", desc: "Handle dispute notifications and submit chargeback evidence within deadlines.", icon: Shield, tags: ["Gateway", "Disputes"], time: "7 min", category: "gateway" },
  { slug: "09-open-banking-aisp-consent-accounts-transactions", title: "Open Banking AISP — Accounts & Transactions", desc: "Create consent, authorize via redirect, and retrieve account data via AISP flow.", icon: Landmark, tags: ["Open Banking", "AISP"], time: "12 min", category: "openbanking" },
  { slug: "10-open-banking-pisp-consent-domestic-payment", title: "Open Banking PISP — Domestic Payment", desc: "Initiate a domestic payment via PISP consent and authorization flow.", icon: Banknote, tags: ["Open Banking", "PISP"], time: "10 min", category: "openbanking" },
  { slug: "11-build-marketplace-checkout", title: "Build a Marketplace Checkout", desc: "End-to-end guide: charge buyers, calculate commission, disburse to sellers, and reconcile.", icon: CreditCard, tags: ["Use Case", "Gateway"], time: "15 min", category: "usecase" },
  { slug: "12-build-bank-data-aggregator", title: "Build a Bank Data Aggregator", desc: "End-to-end guide: AISP consent, account sync, transaction history, and token management.", icon: Landmark, tags: ["Use Case", "AISP"], time: "15 min", category: "usecase" },
];

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
          12 complete, copy-paste-ready guides covering every major integration scenario — from merchant onboarding to Open Banking payments. Includes two end-to-end "Build X" use-case guides with failure handling, retry logic, and production considerations.
        </p>
        <div className="flex items-center gap-6 mt-5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Terminal className="h-4 w-4" /> curl + JSON examples</span>
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> 5-15 min each</span>
          <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Sequence diagrams included</span>
        </div>
      </div>

      {/* Gateway Section */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Payment Gateway</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {examples.filter(e => e.category === "gateway").map((ex, i) => (
            <GuideCard key={ex.slug} ex={ex} index={examples.indexOf(ex)} />
          ))}
        </div>
      </section>

      {/* Webhooks Section */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Webhooks & Events</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {examples.filter(e => e.category === "webhooks").map((ex) => (
            <GuideCard key={ex.slug} ex={ex} index={examples.indexOf(ex)} />
          ))}
        </div>
      </section>

      {/* Open Banking Section */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Open Banking</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {examples.filter(e => e.category === "openbanking").map((ex) => (
            <GuideCard key={ex.slug} ex={ex} index={examples.indexOf(ex)} />
          ))}
        </div>
      </section>

      {/* Build X Use Cases */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">End-to-End Use Cases</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {examples.filter(e => e.category === "usecase").map((ex) => (
            <GuideCard key={ex.slug} ex={ex} index={examples.indexOf(ex)} />
          ))}
        </div>
      </section>

      <noscript>
        <div className="p-4 border rounded-lg">
          <h2>Real-World Examples</h2>
          <ul>
            {examples.map(ex => (
              <li key={ex.slug}>
                <a href={`/developer/examples/${ex.slug}`}>{ex.title}</a> — {ex.desc}
              </li>
            ))}
          </ul>
        </div>
      </noscript>

      <AutoDocNavigation />
    </div>
  );
}

function GuideCard({ ex, index }: { ex: typeof examples[0]; index: number }) {
  return (
    <Link to={`/developer/examples/${ex.slug}`} className="group block">
      <div className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
          <ex.icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{ex.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{ex.desc}</p>
          <div className="flex items-center gap-2">
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
  );
}
