import { Helmet } from "react-helmet-async";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Minus, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const providers = [
  { name: "KOB", score: 77, color: "hsl(var(--primary))" },
  { name: "Stripe", score: 33, color: "hsl(220 14% 50%)" },
  { name: "Flutterwave", score: 31, color: "hsl(30 80% 55%)" },
  { name: "CinetPay", score: 22, color: "hsl(200 60% 45%)" },
  { name: "DusuPay", score: 19, color: "hsl(160 50% 40%)" },
];

interface Feature {
  name: string;
  tooltip?: string;
  kob: boolean | "partial";
  stripe: boolean | "partial";
  flutterwave: boolean | "partial";
  cinetpay: boolean | "partial";
  dusupay: boolean | "partial";
}

interface Category {
  name: string;
  features: Feature[];
}

const categories: Category[] = [
  {
    name: "Collections",
    features: [
      { name: "Mobile Money (MTN, Orange)", tooltip: "Accept MoMo & OM in CEMAC", kob: true, stripe: false, flutterwave: true, cinetpay: true, dusupay: true },
      { name: "Card Payments (Visa/MC)", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: true },
      { name: "Bank Transfers", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: true },
      { name: "USSD Payments", kob: true, stripe: false, flutterwave: true, cinetpay: false, dusupay: false },
      { name: "Apple Pay / Google Pay", kob: true, stripe: true, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "QR Code Payments", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Payment Links", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: false },
      { name: "Recurring / Subscriptions", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: false },
    ],
  },
  {
    name: "Payouts",
    features: [
      { name: "Mobile Money Payouts", kob: true, stripe: false, flutterwave: true, cinetpay: true, dusupay: true },
      { name: "Bank Transfer Payouts", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: true },
      { name: "Instant Payouts (Visa Direct)", kob: true, stripe: true, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Bulk / Batch Payouts", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: true },
      { name: "Split Payments", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: false },
      { name: "Escrow Payments", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
    ],
  },
  {
    name: "Open Banking",
    features: [
      { name: "AISP (Account Info)", tooltip: "Read balances, transactions, beneficiaries", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "PISP (Payment Initiation)", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "CBPII (Funds Confirmation)", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Consent Management", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "International Payments", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: true },
      { name: "Standing Orders", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Scheduled Payments", kob: true, stripe: true, flutterwave: false, cinetpay: false, dusupay: false },
    ],
  },
  {
    name: "Bank Connectors",
    features: [
      { name: "File-Based (CSV/SFTP)", tooltip: "Banks without APIs can integrate via CSV uploads", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Database Connector", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Message Queue (Kafka/RabbitMQ)", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "REST API Pull", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "ISO 20022 Messaging", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
    ],
  },
  {
    name: "Security & Auth",
    features: [
      { name: "OAuth 2.0 + PKCE", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: true },
      { name: "mTLS Certificates", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "FAPI Compliance", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Detached JWS Signing", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "3D-Secure", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: false },
      { name: "Webhook HMAC Verification", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: true },
    ],
  },
  {
    name: "Compliance",
    features: [
      { name: "KYC/AML Screening", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: false },
      { name: "COBAC Compliance (CEMAC)", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "PCI DSS", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: true },
      { name: "Audit Logging", kob: true, stripe: true, flutterwave: "partial", cinetpay: false, dusupay: false },
    ],
  },
  {
    name: "SDKs & Libraries",
    features: [
      { name: "Node.js / JavaScript", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: true },
      { name: "Python", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: false },
      { name: "PHP / Laravel", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: false },
      { name: "Postman Collection", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: false },
      { name: "API Playground", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
    ],
  },
  {
    name: "Multi-Currency",
    features: [
      { name: "XAF Native Default", kob: true, stripe: false, flutterwave: true, cinetpay: true, dusupay: true },
      { name: "Real-Time FX Rates", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: true },
      { name: "EUR / USD / GBP", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: true },
    ],
  },
  {
    name: "Banking Infrastructure",
    features: [
      { name: "Double-Entry Ledger", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Loan Origination", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Savings Products", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Multi-Tenant Banking App", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Credit Scoring API", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Custodial Wallets", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
    ],
  },
  {
    name: "Developer Experience",
    features: [
      { name: "Free Sandbox", kob: true, stripe: true, flutterwave: true, cinetpay: true, dusupay: true },
      { name: "Interactive API Docs", kob: true, stripe: true, flutterwave: true, cinetpay: "partial", dusupay: false },
      { name: "Webhook Testing Tools", kob: true, stripe: true, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "Migration Guides", kob: true, stripe: false, flutterwave: false, cinetpay: false, dusupay: false },
      { name: "OpenAPI / Swagger Spec", kob: true, stripe: true, flutterwave: true, cinetpay: false, dusupay: false },
    ],
  },
];

function StatusIcon({ value }: { value: boolean | "partial" }) {
  if (value === true) return <Check className="h-4 w-4 text-emerald-600" />;
  if (value === "partial") return <Minus className="h-4 w-4 text-amber-500" />;
  return <X className="h-4 w-4 text-muted-foreground/40" />;
}

export default function CompetitiveComparison() {
  return (
    <>
      <Helmet>
        <title>KOB vs Stripe vs Flutterwave — API Comparison | Kang Open Banking</title>
        <meta name="description" content="Compare Kang Open Banking API features against Stripe, Flutterwave, CinetPay, and DusuPay. See why KOB is the only 3-layer payment + banking platform for Africa." />
      </Helmet>

      <div className="space-y-12 pb-12">
        <ScrollReveal>
          <div className="space-y-3">
            <Link to="/developer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Developer Portal
            </Link>
            <h1 className="text-4xl font-bold tracking-tight leading-[1.1]">API Feature Comparison</h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              How KOB stacks up against Stripe, Flutterwave, and regional payment gateways across 77 capabilities.
            </p>
          </div>
        </ScrollReveal>

        {/* Score Cards */}
        <ScrollReveal delay={0.1}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {providers.map((p) => (
              <Card key={p.name} className={p.name === "KOB" ? "border-primary/40 bg-primary/5" : ""}>
                <CardContent className="p-4 text-center space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{p.name}</p>
                  <p className="text-3xl font-bold tabular-nums" style={{ color: p.color }}>
                    {p.score}<span className="text-base font-normal text-muted-foreground">/77</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollReveal>

        {/* Comparison Matrix */}
        <TooltipProvider>
          {categories.map((cat, catIdx) => (
            <ScrollReveal key={cat.name} delay={0.05 * catIdx}>
              <div className="space-y-3">
                <h2 className="text-xl font-semibold">{cat.name}</h2>
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-3 font-medium min-w-[200px]">Feature</th>
                          {providers.map((p) => (
                            <th key={p.name} className="p-3 text-center font-medium w-24">
                              <span className={p.name === "KOB" ? "text-primary font-bold" : ""}>{p.name}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cat.features.map((f, i) => (
                          <tr key={f.name} className={i < cat.features.length - 1 ? "border-b border-border/50" : ""}>
                            <td className="p-3">
                              {f.tooltip ? (
                                <Tooltip>
                                  <TooltipTrigger className="text-left border-b border-dashed border-muted-foreground/30 cursor-help">
                                    {f.name}
                                  </TooltipTrigger>
                                  <TooltipContent><p className="max-w-[240px]">{f.tooltip}</p></TooltipContent>
                                </Tooltip>
                              ) : f.name}
                            </td>
                            <td className="p-3 text-center"><StatusIcon value={f.kob} /></td>
                            <td className="p-3 text-center"><StatusIcon value={f.stripe} /></td>
                            <td className="p-3 text-center"><StatusIcon value={f.flutterwave} /></td>
                            <td className="p-3 text-center"><StatusIcon value={f.cinetpay} /></td>
                            <td className="p-3 text-center"><StatusIcon value={f.dusupay} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </TooltipProvider>

        {/* Why KOB */}
        <ScrollReveal delay={0.15}>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Why KOB?</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: "3-Layer Architecture", desc: "The only platform combining Payment Gateway + Open Banking + Banking Infrastructure in one API. No other provider offers AISP/PISP alongside ledger, loans, and multi-tenant banking." },
                { title: "XAF-Native, Africa-First", desc: "Built for the CEMAC region with XAF as the default currency, MTN MoMo and Orange Money as first-class payment methods, and COBAC regulatory compliance." },
                { title: "Banks Without APIs", desc: "Unique 4-mode bank connector (File, DB, Message Queue, REST API pull) lets banks integrate without building their own API — no other gateway offers this." },
              ].map((c) => (
                <Card key={c.title}>
                  <CardContent className="p-5 space-y-2">
                    <h3 className="font-semibold">{c.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="flex flex-wrap gap-3">
            <Button asChild><Link to="/developer/migrate">Migration Guides →</Link></Button>
            <Button variant="outline" asChild><Link to="/developer/getting-started">Get Started Free</Link></Button>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
