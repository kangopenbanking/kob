import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCcw, CheckCircle, AlertTriangle, Clock } from "lucide-react";

export default function ReconciliationFramework() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">
          Architecture
        </Badge>
        <h1 className="text-4xl font-bold mb-4">Reconciliation Framework</h1>
        <p className="text-xl text-muted-foreground">
          Automated three-way reconciliation between Kang ledger, payment processors, and bank settlements.
        </p>
      </div>

      <Separator className="my-8" />

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <RefreshCcw className="h-6 w-6 text-primary" />
              <CardTitle>Reconciliation Process</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-6 rounded-lg overflow-x-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre">
                {`
Three-Way Reconciliation
════════════════════════

  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │  KOB Ledger  │    │  Processor   │    │  Bank        │
  │  (Internal)  │    │  (Stripe/FW) │    │  Settlement  │
  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
         │                   │                    │
         └───────────┬───────┘                    │
                     ↓                            │
           ┌─────────────────┐                    │
           │  Match Engine   │←───────────────────┘
           │                 │
           │  1. Amount match│
           │  2. Reference   │
           │  3. Date range  │
           │  4. Status      │
           └────────┬────────┘
                    ↓
           ┌─────────────────┐
           │  Results        │
           │  ✅ Matched     │
           │  ⚠️  Mismatch   │
           │  ❌ Unmatched   │
           └─────────────────┘`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <CardTitle className="text-lg">Matched</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Internal ledger amount and reference match processor settlement record exactly. No action required.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-lg">Mismatch</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Amount or status differs between internal ledger and processor. Queued for manual review with
                discrepancy details.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-red-600" />
                <CardTitle className="text-lg">Unmatched</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Record exists in one system but not the other. Triggers investigation workflow and potential
                stuck-transaction recovery.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Table</th>
                    <th className="text-left p-3 font-semibold">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="p-3 font-mono text-xs">reconciliation_runs</td>
                    <td className="p-3">
                      Each reconciliation execution with period, provider, status, and summary counts
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono text-xs">reconciliation_mismatches</td>
                    <td className="p-3">
                      Individual discrepancies with internal vs external amounts and resolution status
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-mono text-xs">bank_reconciliations</td>
                    <td className="p-3">Bank statement reconciliation with matched/unmatched counts</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-xs">bank_statements</td>
                    <td className="p-3">Imported bank statement records for three-way matching</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Automated Recovery</CardTitle>
            <CardDescription>Stuck transaction detection via gateway-reconcile-stuck cron</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              A scheduled cron function identifies charges stuck in{" "}
              <code className="text-xs bg-muted px-1 rounded">pending</code> or{" "}
              <code className="text-xs bg-muted px-1 rounded">processing</code> status beyond configured thresholds:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Mobile money charges pending &gt; 30 minutes → re-query Flutterwave status</li>
              <li>Card charges processing &gt; 15 minutes → re-query Stripe payment intent</li>
              <li>Auto-resolve or escalate based on processor response</li>
              <li>Settlement drift detection flags amount mismatches &gt; 0.01%</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
