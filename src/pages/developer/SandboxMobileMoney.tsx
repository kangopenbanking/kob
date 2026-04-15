import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const momoCharge = `curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "merchant_id": "merch_test_001",
    "amount": 5000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237650000000",
    "tx_ref": "test_momo_001"
  }'`;

const nodeExample = `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  apiKey: 'sk_test_sandbox_KangOB2026Demo',
  environment: 'sandbox',
});

const charge = await kob.charges.create({
  merchant_id: 'merch_test_001',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '+237650000000',
  tx_ref: 'test_momo_001',
});

console.log(charge.data.status); // "successful"`;

const pythonExample = `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    api_key="sk_test_sandbox_KangOB2026Demo",
    environment="sandbox",
)

charge = kob.charges.create(
    merchant_id="merch_test_001",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="+237650000000",
    tx_ref="test_momo_001",
)

print(charge.data.status)  # "successful"`;

export default function SandboxMobileMoney() {
  return (
    <>
      <Helmet>
        <title>Test Mobile Money Numbers | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Test mobile money phone numbers for MTN MoMo and Orange Money in the Kang Open Banking sandbox. Simulate success, failure, pending, and timeout scenarios." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/sandbox/mobile-money" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Test Mobile Money Numbers</h1>
          <p className="text-lg text-muted-foreground">
            Use these phone numbers in the sandbox to simulate MTN MoMo and Orange Money payment outcomes without real transactions.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="mtn">MTN MoMo Test Numbers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Phone Number</th>
                  <th className="text-left p-3 font-medium text-foreground">Behavior</th>
                  <th className="text-left p-3 font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["+237650000000", "Always succeeds immediately", "successful"],
                  ["+237650000001", "Pending then succeeds (5s delay)", "pending > successful"],
                  ["+237650000002", "Always fails (insufficient funds)", "failed"],
                  ["+237650000003", "Always fails (account blocked)", "failed"],
                  ["+237650000004", "Always fails (invalid number)", "failed"],
                  ["+237650000099", "Triggers timeout after 30s", "timeout"],
                ].map(([phone, behavior, status]) => (
                  <tr key={phone} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{phone}</td>
                    <td className="p-3 text-muted-foreground">{behavior}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="orange">Orange Money Test Numbers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Phone Number</th>
                  <th className="text-left p-3 font-medium text-foreground">Behavior</th>
                  <th className="text-left p-3 font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["+237690000000", "Always succeeds immediately", "successful"],
                  ["+237690000001", "Always fails (account blocked)", "failed"],
                  ["+237690000002", "Always fails (daily limit exceeded)", "failed"],
                  ["+237690000099", "Triggers timeout after 30s", "timeout"],
                ].map(([phone, behavior, status]) => (
                  <tr key={phone} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{phone}</td>
                    <td className="p-3 text-muted-foreground">{behavior}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="example">Example: Create a Mobile Money Charge</h2>
          <CodeBlock examples={[
            { code: momoCharge, language: "bash", label: "cURL" },
            { code: nodeExample, language: "javascript", label: "Node.js" },
            { code: pythonExample, language: "python", label: "Python" },
          ]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="ussd-codes">USSD Simulation</h2>
          <p className="text-muted-foreground mb-4">
            In the sandbox, USSD confirmation prompts are auto-approved. In production, the customer receives a real USSD push notification on their phone to approve the payment.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Provider</th>
                  <th className="text-left p-3 font-medium text-foreground">Sandbox Behavior</th>
                  <th className="text-left p-3 font-medium text-foreground">Production Behavior</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["MTN MoMo", "Auto-approved (no USSD prompt)", "USSD push to customer phone"],
                  ["Orange Money", "Auto-approved (no USSD prompt)", "USSD push to customer phone"],
                ].map(([provider, sandbox, prod]) => (
                  <tr key={provider} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{provider}</td>
                    <td className="p-3 text-muted-foreground">{sandbox}</td>
                    <td className="p-3 text-muted-foreground">{prod}</td>
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
