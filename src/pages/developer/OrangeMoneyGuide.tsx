import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function OrangeMoneyGuide() {
  return (
    <>
      <Helmet>
        <title>Orange Money Integration | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Integrate Orange Money payments in Cameroon and West Africa. Payment initiation, QR codes, test numbers, and code examples." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/mobile-money/orange" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Orange Money</h1>
          <p className="text-lg text-muted-foreground">
            Accept payments from Orange Money subscribers across Cameroon, Cote d'Ivoire, Senegal, Mali, and Burkina Faso.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="flow">Payment Flow</h2>
          <div className="bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm text-muted-foreground overflow-x-auto whitespace-pre">
{`1. POST /v1/gateway/charges with provider: "orange_money"
2. Customer receives payment prompt on their phone
3. Customer confirms with Orange Money PIN
4. Orange confirms → Kang updates charge status
5. Webhook fires: charge.captured`}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="example">Create Charge</h2>
          <CodeBlock examples={[
            { code: `curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "merchant_id": "merch_test_001",
    "amount": "3000",
    "currency": "XAF",
    "channel": "mobile_money",
    "provider": "orange_money",
    "customer_phone": "+237690000000",
    "tx_ref": "order_67890"
  }'`, language: "bash", label: "cURL" },
            { code: `import KangSDK from '@kang/openbanking';

const kang = new KangSDK({ secretKey: 'sk_test_sandbox_KangOB2026Demo' });

const charge = await kang.charges.create({
  merchantId: 'merch_test_001',
  amount: '3000',
  currency: 'XAF',
  channel: 'mobile_money',
  provider: 'orange_money',
  customerPhone: '+237690000000',
  txRef: 'order_67890',
});
console.log(charge.data.status); // 'pending'`, language: "javascript", label: "Node.js" },
          ]} title="Orange Money Charge" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="test-numbers">Test Numbers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Phone Number</th>
                  <th className="text-left p-3 font-medium text-foreground">Behavior</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["+237690000000", "Always succeeds immediately"],
                  ["+237690000001", "Always fails (account blocked)"],
                  ["+237690000002", "Pending then success (5s delay)"],
                ].map(([phone, behavior]) => (
                  <tr key={phone} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{phone}</td>
                    <td className="p-3 text-muted-foreground">{behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="differences">Orange vs MTN Differences</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Feature</th>
                  <th className="text-left p-3 font-medium text-foreground">MTN MoMo</th>
                  <th className="text-left p-3 font-medium text-foreground">Orange Money</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Push method", "USSD push", "SIM Toolkit / API push"],
                  ["Avg. settlement", "2-5 seconds", "3-8 seconds"],
                  ["QR payments", "Not supported", "Supported"],
                  ["Max single transaction", "1,000,000 XAF", "500,000 XAF"],
                ].map(([feature, mtn, orange]) => (
                  <tr key={feature} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{feature}</td>
                    <td className="p-3 text-muted-foreground">{mtn}</td>
                    <td className="p-3 text-muted-foreground">{orange}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
