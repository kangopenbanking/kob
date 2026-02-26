import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Banknote, Clock, ArrowRight, Shield } from "lucide-react";

export default function SettlementEngine() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Architecture</Badge>
        <h1 className="text-4xl font-bold mb-4">Settlement Engine</h1>
        <p className="text-xl text-muted-foreground">
          Automated settlement processing with configurable timing, multi-currency support, and split payment distribution.
        </p>
      </div>

      <Separator className="my-8" />

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-primary" />
              <CardTitle>Settlement Lifecycle</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-6 rounded-lg overflow-x-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre">{`
Settlement Timeline
═══════════════════

Day 0: Charge captured → Funds held in merchant wallet (pending_balance)
       ↓
Day 1: Settlement window opens → Pending moves to available_balance
       ↓
Day T+N: Settlement cron runs (automated-settlement-cron)
       ↓
  ┌─────────────────────────────────────────┐
  │  For each merchant with settlement_due: │
  │                                         │
  │  1. Lock merchant wallet (FOR UPDATE)   │
  │  2. Calculate net settlement amount     │
  │     (charges - refunds - disputes)      │
  │  3. Debit merchant wallet               │
  │  4. Create settlement_transactions      │
  │  5. Initiate payout via processor       │
  │  6. Update settlement status            │
  └─────────────────────────────────────────┘
       ↓
Day T+N+1: Payout webhook confirms → Status: completed`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Banknote className="h-6 w-6 text-primary" />
              <CardTitle>Settlement Calculation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 mb-4">
              <pre className="text-xs text-muted-foreground">{`
Net Settlement = Σ(Captured Charges)
              - Σ(Refunds in Period)
              - Σ(Dispute Losses)
              - Σ(KOB Platform Fees)
              ─────────────────────
              = Available for Payout`}</pre>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Split Payment Handling</h4>
                <p className="text-sm text-muted-foreground">For marketplace transactions with subaccounts, settlement is calculated per-subaccount using configured split ratios (percentage or flat). Rounding differences are absorbed by the platform account.</p>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Multi-Currency</h4>
                <p className="text-sm text-muted-foreground">Cross-currency settlements use the exchange rate locked at charge time. Settlement currency is configurable per-merchant, with automatic FX conversion via the admin_exchange_rates table.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ArrowRight className="h-6 w-6 text-primary" />
              <CardTitle>Payout Channels</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { channel: "Bank Transfer", provider: "Flutterwave", currencies: "XAF, NGN, GHS, KES, ZAR", timing: "T+1 to T+3" },
                { channel: "Mobile Money", provider: "Flutterwave", currencies: "XAF (MTN/Orange)", timing: "T+0 to T+1" },
                { channel: "Card Refund", provider: "Stripe", currencies: "USD, EUR, GBP", timing: "T+5 to T+10" },
              ].map((c) => (
                <div key={c.channel} className="border rounded-lg p-4">
                  <h4 className="font-semibold">{c.channel}</h4>
                  <p className="text-xs text-muted-foreground mt-1">via {c.provider}</p>
                  <p className="text-xs text-muted-foreground">{c.currencies}</p>
                  <Badge variant="outline" className="mt-2 text-xs">{c.timing}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <CardTitle>Safety Mechanisms</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">1</Badge> <strong>Wallet Locking:</strong> Row-level locks prevent concurrent settlement attempts on the same merchant</li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">2</Badge> <strong>Failure Re-credit:</strong> If payout fails, merchant wallet is automatically re-credited with the settlement amount</li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">3</Badge> <strong>Date Isolation:</strong> Each merchant uses fresh Date objects to prevent settlement period mutation bugs</li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">4</Badge> <strong>Minimum Threshold:</strong> Settlements below configurable minimum are rolled into the next cycle</li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">5</Badge> <strong>Drift Detection:</strong> Reconciliation flags settlement amounts deviating &gt;0.01% from expected</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
