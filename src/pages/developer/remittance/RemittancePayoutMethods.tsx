import { CodeBlock } from "@/components/developer/CodeBlock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RemittancePayoutMethods() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-3">
        <Badge variant="outline" className="text-xs font-mono">remittance-outbound</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Payout Methods</h1>
        <p className="text-lg text-muted-foreground">
          Deliver funds to recipients via Mobile Money (MTN/Orange), bank transfer, PayPal, or KOB wallet.
        </p>
      </div>

      {/* MoMo */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Mobile Money (MTN / Orange)</h2>
        <p className="text-muted-foreground">
          The most popular payout method in Cameroon. Funds are delivered directly to the recipient's MoMo wallet.
        </p>
        <CodeBlock
          title="MoMo Payout Fields"
          examples={[{
            language: "json",
            code: JSON.stringify({
              payout_method: "momo_mtn",
              recipient_phone: "+237670000000",
              recipient_name: "Marie Ngo",
            }, null, 2),
          }]}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2">Provider</th>
                <th className="text-left py-2 px-2">Method Value</th>
                <th className="text-left py-2 px-2">Delivery Time</th>
                <th className="text-left py-2 px-2">Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="py-2 px-2">MTN MoMo</td><td className="py-2 px-2 font-mono text-xs">momo_mtn</td><td>Instant – 2 min</td><td>5,000,000 XAF/day</td></tr>
              <tr><td className="py-2 px-2">Orange Money</td><td className="py-2 px-2 font-mono text-xs">momo_orange</td><td>Instant – 5 min</td><td>3,000,000 XAF/day</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bank */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Bank Transfer</h2>
        <CodeBlock
          title="Bank Payout Fields"
          examples={[{
            language: "json",
            code: JSON.stringify({
              payout_method: "bank",
              recipient_name: "Marie Ngo",
              bank_code: "10005",
              bank_account_number: "CM2110005000001234567890",
              bank_name: "Afriland First Bank",
            }, null, 2),
          }]}
        />
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-600">⏱ Bank Settlement Times</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bank payouts in Cameroon typically settle within <strong>1–3 business days</strong> via the BEAC
              clearing system. Same-day settlement is available for select banks with direct integration.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PayPal */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">PayPal</h2>
        <CodeBlock
          title="PayPal Payout Fields"
          examples={[{
            language: "json",
            code: JSON.stringify({
              payout_method: "paypal",
              paypal_email: "recipient@example.com",
              recipient_name: "Marie Ngo",
            }, null, 2),
          }]}
        />
      </div>

      {/* KOB Wallet */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">KOB Wallet</h2>
        <p className="text-muted-foreground">
          Instant delivery to recipient's KOB account. Ideal for internal transfers and repeat users.
        </p>
        <CodeBlock
          title="Wallet Payout Fields"
          examples={[{
            language: "json",
            code: JSON.stringify({
              payout_method: "kob_wallet",
              recipient_kob_id: "usr_xxx",
              recipient_name: "Marie Ngo",
            }, null, 2),
          }]}
        />
      </div>

      {/* Payout Status Webhooks */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Payout Status Updates</h2>
        <p className="text-muted-foreground">
          Monitor payout status via webhooks. Register for these events:
        </p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
          <li><code className="text-xs bg-muted px-1 py-0.5 rounded">remittance.payout.succeeded</code> — Funds delivered</li>
          <li><code className="text-xs bg-muted px-1 py-0.5 rounded">remittance.payout.failed</code> — Delivery failed</li>
          <li><code className="text-xs bg-muted px-1 py-0.5 rounded">remittance.transfer.completed</code> — Full lifecycle complete</li>
        </ul>
      </div>
    </div>
  );
}
