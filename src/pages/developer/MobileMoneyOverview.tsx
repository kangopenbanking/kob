import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const momoCharge = `// Initiate MTN MoMo charge
const charge = await fetch('https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_sandbox_KangOB2026Demo',
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify({
    merchant_id: 'merch_test_001',
    amount: '5000',
    currency: 'XAF',
    channel: 'mobile_money',
    provider: 'mtn_momo',
    customer_phone: '+237650000000',
    description: 'Order #12345',
    tx_ref: 'order_' + Date.now(),
  }),
});
const { data } = await charge.json();
// data.status: 'pending' — user receives push notification on phone

// Poll for completion
const result = await fetch(
  \`https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router?action=get_charge&charge_id=\${data.id}\`,
  { headers: { 'Authorization': 'Bearer sk_test_sandbox_KangOB2026Demo' } }
);
// result.data.status: 'successful' | 'failed'`;

const payoutExample = `# Payout to mobile money wallet
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/payouts \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "amount": "10000",
    "currency": "XAF",
    "channel": "mtn_momo",
    "beneficiary_phone": "+237650000000",
    "tx_ref": "payout_001",
    "narration": "Salary March 2026"
  }'`;

export default function MobileMoneyOverview() {
  return (
    <>
      <Helmet>
        <title>Mobile Money Integration | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Accept MTN MoMo and Orange Money payments in Cameroon and CEMAC. Charge flow, payout guide, test numbers, and provider-specific details." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/mobile-money" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Mobile Money</h1>
          <p className="text-lg text-muted-foreground">
            Accept payments and send payouts via MTN Mobile Money, Orange Money, and Express Union across Cameroon and the CEMAC region.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="providers">Supported Providers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Provider</th>
                  <th className="text-left p-3 font-medium text-foreground">API Channel Value</th>
                  <th className="text-left p-3 font-medium text-foreground">Countries</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["MTN Mobile Money", "mtn_momo", "CM, CI, GH, RW, UG, ZM"],
                  ["Orange Money", "orange_money", "CM, CI, SN, ML, BF"],
                  ["Express Union", "express_union", "CM"],
                ].map(([provider, channel, countries]) => (
                  <tr key={provider} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{provider}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{channel}</td>
                    <td className="p-3 text-muted-foreground">{countries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="charge-flow">Charge Flow</h2>
          <div className="bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm text-muted-foreground overflow-x-auto whitespace-pre mb-4">
{`1. Your app → POST /v1/gateway/charges (channel: mobile_money)
2. Kang API → Sends USSD push to customer's phone
3. Customer → Enters PIN to confirm payment
4. Provider → Confirms to Kang (async)
5. Kang → Fires charge.captured webhook to your server
6. Your app → Fulfils order`}
          </div>
          <CodeBlock examples={[{ code: momoCharge, language: "javascript" }]} title="MTN MoMo Charge (Node.js)" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="payouts">Payout to Mobile Money Wallet</h2>
          <CodeBlock examples={[{ code: payoutExample, language: "bash" }]} title="Mobile Money Payout" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="test-numbers">Test Numbers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Phone Number</th>
                  <th className="text-left p-3 font-medium text-foreground">Provider</th>
                  <th className="text-left p-3 font-medium text-foreground">Behavior</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["+237650000000", "MTN MoMo", "Always succeeds immediately"],
                  ["+237690000000", "Orange Money", "Always succeeds immediately"],
                  ["+237650000001", "MTN MoMo", "Pending then success (5s delay)"],
                  ["+237650000002", "MTN MoMo", "Fails — insufficient funds"],
                  ["+237690000001", "Orange Money", "Fails — account blocked"],
                  ["+237650000099", "Any", "Timeout after 30s"],
                ].map(([phone, provider, behavior]) => (
                  <tr key={phone} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{phone}</td>
                    <td className="p-3 text-muted-foreground">{provider}</td>
                    <td className="p-3 text-muted-foreground">{behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="provider-guides">Provider Guides</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link to="/developer/mobile-money/mtn" className="block border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
              <h3 className="font-semibold text-foreground mb-1">MTN MoMo</h3>
              <p className="text-sm text-muted-foreground">USSD push, disbursement, status callbacks, and MTN-specific parameters</p>
            </Link>
            <Link to="/developer/mobile-money/orange" className="block border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
              <h3 className="font-semibold text-foreground mb-1">Orange Money</h3>
              <p className="text-sm text-muted-foreground">Payment initiation, QR code payments, and Orange-specific flows</p>
            </Link>
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
