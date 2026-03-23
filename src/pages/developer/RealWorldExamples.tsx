import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, CreditCard, Wallet, RotateCcw, Send, Bell, BarChart3, Shield, Landmark, Banknote } from "lucide-react";

const examples = [
  { slug: "01-merchant-onboarding-kyb-api-keys", title: "Merchant Onboarding, KYB & API Keys", desc: "Register a merchant, submit KYB, generate API keys", icon: Building2, tags: ["Gateway", "Merchant"] },
  { slug: "02-accept-payments-create-charge", title: "Accept Payments — Create a Charge", desc: "Collect payments via Mobile Money, Card, or PayPal", icon: CreditCard, tags: ["Gateway", "Payments"] },
  { slug: "03-add-money-account-funding", title: "Add Money — Account Funding", desc: "Fund wallets via Mobile Money, card, or bank transfer", icon: Wallet, tags: ["Gateway", "Funding"] },
  { slug: "04-refunds", title: "Refunds", desc: "Process full and partial refunds on charges", icon: RotateCcw, tags: ["Gateway", "Refunds"] },
  { slug: "05-payouts-single-bulk-paypal", title: "Payouts — Single, Bulk & PayPal", desc: "Disburse funds to bank, Mobile Money, or PayPal recipients", icon: Send, tags: ["Gateway", "Payouts"] },
  { slug: "06-webhooks-merchant-outbound-deliveries-rotation", title: "Webhooks — Setup, Deliveries & Rotation", desc: "Configure webhook endpoints, verify signatures, rotate secrets", icon: Bell, tags: ["Webhooks"] },
  { slug: "07-settlements-reporting-exports-reconciliation", title: "Settlements, Reporting & Reconciliation", desc: "Review settlements, generate reports, reconcile transactions", icon: BarChart3, tags: ["Gateway", "Reporting"] },
  { slug: "08-disputes-chargebacks-evidence", title: "Disputes & Chargebacks", desc: "Handle disputes and submit chargeback evidence", icon: Shield, tags: ["Gateway", "Disputes"] },
  { slug: "09-open-banking-aisp-consent-accounts-transactions", title: "Open Banking AISP — Accounts & Transactions", desc: "Access customer accounts via AISP consent flow", icon: Landmark, tags: ["Open Banking", "AISP"] },
  { slug: "10-open-banking-pisp-consent-domestic-payment", title: "Open Banking PISP — Domestic Payment", desc: "Initiate payments via PISP consent flow", icon: Banknote, tags: ["Open Banking", "PISP"] },
];

export default function RealWorldExamples() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Real-World Integration Examples</h1>
        <p className="text-xl text-muted-foreground">
          10 complete, copy-paste-ready guides covering every major KOB integration scenario — from merchant onboarding to Open Banking payments.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {examples.map((ex, i) => (
          <Link key={ex.slug} to={`/developer/examples/${ex.slug}`}>
            <Card className="h-full hover:shadow-md transition-shadow hover:border-primary/40 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ex.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{ex.title}</CardTitle>
                      <CardDescription className="mt-1">{ex.desc}</CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-1.5 flex-wrap">
                  {ex.tags.map(t => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                  <Badge variant="secondary" className="text-xs">Guide #{i + 1}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <noscript>
        <div className="p-4 border rounded-lg">
          <h2>Real-World Examples (No-JS fallback)</h2>
          <ul>
            {examples.map(ex => (
              <li key={ex.slug}>
                <a href={`/developer/examples/${ex.slug}`}>{ex.title}</a> — {ex.desc}
              </li>
            ))}
          </ul>
        </div>
      </noscript>
    </div>
  );
}
