import { CodeBlock } from "@/components/developer/CodeBlock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RemittanceCorridorsQuotes() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-3">
        <Badge variant="outline" className="text-xs font-mono">remittance-engine</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Corridors & Quotes</h1>
        <p className="text-lg text-muted-foreground">
          Discover available corridors and get real-time FX quotes with transparent fees.
        </p>
      </div>

      {/* Corridors */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">List Corridors</h2>
        <p className="text-muted-foreground">
          Retrieve all active remittance corridors. Filter by destination country.
        </p>
        <CodeBlock
          title="GET corridors"
          examples={[{
            language: "bash",
            code: `curl "https://api.kangopenbanking.com/v1/remittance-engine?action=list_corridors&to_country=CM" \\
  -H "Authorization: Bearer YOUR_TOKEN"`
          }]}
        />
        <CodeBlock
          title="Response"
          examples={[{
            language: "json",
            code: JSON.stringify({
              corridors: [
                {
                  id: "corr_001",
                  from_country: "FR",
                  to_country: "CM",
                  from_currency: "EUR",
                  to_currency: "XAF",
                  is_active: true,
                  supported_payin: ["card", "bank_transfer"],
                  supported_payout: ["momo_mtn", "momo_orange", "bank"],
                },
                {
                  id: "corr_002",
                  from_country: "CM",
                  to_country: "CM",
                  from_currency: "XAF",
                  to_currency: "XAF",
                  is_active: true,
                  supported_payin: ["momo_mtn", "momo_orange", "wallet"],
                  supported_payout: ["momo_mtn", "momo_orange", "bank", "wallet"],
                },
              ],
            }, null, 2),
          }]}
        />
      </div>

      {/* Default Corridors */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Default Corridors</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium">Route</th>
                <th className="text-left py-3 px-2 font-medium">Send Currency</th>
                <th className="text-left py-3 px-2 font-medium">Receive Currency</th>
                <th className="text-left py-3 px-2 font-medium">Pay-in</th>
                <th className="text-left py-3 px-2 font-medium">Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                ["CM → CM", "XAF", "XAF", "MoMo, Wallet", "MoMo, Bank, Wallet"],
                ["FR → CM", "EUR", "XAF", "Card, Bank", "MoMo, Bank"],
                ["GB → CM", "GBP", "XAF", "Card, Bank", "MoMo, Bank"],
                ["US → CM", "USD", "XAF", "Card, PayPal", "MoMo, Bank"],
              ].map(([route, send, recv, payin, payout]) => (
                <tr key={route}>
                  <td className="py-2 px-2 font-mono text-xs font-medium">{route}</td>
                  <td className="py-2 px-2">{send}</td>
                  <td className="py-2 px-2">{recv}</td>
                  <td className="py-2 px-2 text-muted-foreground">{payin}</td>
                  <td className="py-2 px-2 text-muted-foreground">{payout}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quotes */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Create Quote</h2>
        <p className="text-muted-foreground">
          Get a locked FX rate with transparent fee breakdown. Quotes expire after 30 minutes.
        </p>
        <CodeBlock
          title="POST create_quote"
          examples={[{
            language: "bash",
            code: `curl -X POST https://api.kangopenbanking.com/v1/remittance-engine \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create_quote",
    "from_country": "FR",
    "to_country": "CM",
    "send_amount": 100,
    "send_currency": "EUR",
    "receive_currency": "XAF"
  }'`
          }]}
        />
        <CodeBlock
          title="Response"
          examples={[{
            language: "json",
            code: JSON.stringify({
              quote: {
                id: "qt_abc123",
                corridor_id: "corr_001",
                send_amount: 100,
                send_currency: "EUR",
                receive_amount: 63250,
                receive_currency: "XAF",
                exchange_rate: 655.957,
                rate_with_margin: 632.50,
                fee_amount: 2.50,
                fee_currency: "EUR",
                total_cost: 102.50,
                expires_at: "2026-03-25T20:30:00Z",
                status: "active",
              },
            }, null, 2),
          }]}
        />
      </div>

      {/* Quote Expiry */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-amber-600">⏰ Quote Expiry</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Quotes expire after <strong>30 minutes</strong>. Attempting to create a transfer with an
            expired quote returns <code className="text-xs bg-muted px-1 py-0.5 rounded">409 quote_expired</code>.
            Create a new quote before retrying.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
