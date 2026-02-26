import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Lock, ArrowLeftRight, Database } from "lucide-react";

export default function LedgerSystem() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Architecture</Badge>
        <h1 className="text-4xl font-bold mb-4">Double-Entry Ledger System</h1>
        <p className="text-xl text-muted-foreground">
          Immutable, GAAP-compliant financial ledger powering all fund movements across the Kang Open Banking platform.
        </p>
      </div>

      <Separator className="my-8" />

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-primary" />
              <CardTitle>Core Principles</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: "Double-Entry Accounting", desc: "Every transaction creates equal debit and credit entries. Total debits always equal total credits across the system." },
                { title: "Immutability", desc: "Journal entries are append-only. Corrections are made via reversal entries, never by modifying existing records." },
                { title: "Idempotent Posting", desc: "The journal-post function uses idempotency_keys to prevent duplicate postings. Same key = same result." },
                { title: "Atomic Operations", desc: "Wallet credits/debits use database transactions ensuring balance consistency even under concurrent access." },
              ].map((p) => (
                <div key={p.title} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">{p.title}</h4>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="h-6 w-6 text-primary" />
              <CardTitle>Transaction Flow</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-6 rounded-lg overflow-x-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre">{`
Charge Successful (Card via Stripe)
═══════════════════════════════════

  Stripe Webhook (charge.succeeded)
         ↓
  gateway-webhook-stripe
         ↓
  ┌─────────────────────────────────┐
  │  journal-post                   │
  │                                 │
  │  DEBIT   Stripe Receivable      │  +50,000 XAF
  │  CREDIT  Merchant Revenue       │  -50,000 XAF
  │                                 │
  │  DEBIT   Merchant Revenue       │  +1,500 XAF (KOB fee)
  │  CREDIT  KOB Fee Income         │  -1,500 XAF
  └─────────────────────────────────┘
         ↓
  Merchant Wallet Credit: 48,500 XAF
  (atomic wallet_credit function)


Refund Processed
═══════════════

  ┌─────────────────────────────────┐
  │  journal-post (reversal)        │
  │                                 │
  │  DEBIT   Merchant Revenue       │  +50,000 XAF
  │  CREDIT  Stripe Receivable      │  -50,000 XAF
  │                                 │
  │  DEBIT   KOB Fee Income         │  +1,500 XAF (fee reversal)
  │  CREDIT  Merchant Revenue       │  -1,500 XAF
  └─────────────────────────────────┘
         ↓
  Merchant Wallet Debit: 48,500 XAF`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <CardTitle>Data Model</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Table</th>
                    <th className="text-left p-3 font-semibold">Purpose</th>
                    <th className="text-left p-3 font-semibold">Key Fields</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3 font-mono text-xs">ledger_entries</td><td className="p-3">Individual debit/credit postings</td><td className="p-3">account, amount, direction, journal_id</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono text-xs">journal_entries</td><td className="p-3">Grouped transaction records</td><td className="p-3">reference, type, narration, idempotency_key</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono text-xs">merchant_wallets</td><td className="p-3">Real-time merchant balances</td><td className="p-3">merchant_id, available_balance, pending_balance</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono text-xs">settlement_transactions</td><td className="p-3">Payout settlement records</td><td className="p-3">merchant_id, amount, status, settled_at</td></tr>
                  <tr><td className="p-3 font-mono text-xs">idempotency_keys</td><td className="p-3">Duplicate posting prevention</td><td className="p-3">key, response_body, expires_at</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-primary" />
              <CardTitle>Integrity Guarantees</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">1</Badge> All wallet operations use PostgreSQL <code className="text-xs bg-muted px-1 rounded">SELECT ... FOR UPDATE</code> row-level locking</li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">2</Badge> Journal entries enforce <code className="text-xs bg-muted px-1 rounded">SUM(debits) = SUM(credits)</code> per journal</li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">3</Badge> Idempotency keys expire after 24 hours with automated TTL cleanup</li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">4</Badge> RLS policies ensure merchants only see their own ledger entries</li>
              <li className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5">5</Badge> Audit logs capture all financial operations with IP, user agent, and geolocation</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
