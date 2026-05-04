import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { KOB_API_VERSION } from "@/config/version";

const mtnCharge = `curl -X POST https://api.kangopenbanking.com/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "merchant_id": "merch_test_001",
    "amount": "5000",
    "currency": "XAF",
    "channel": "mobile_money",
    "provider": "mtn_momo",
    "customer_phone": "+237650000000",
    "description": "Order #12345",
    "tx_ref": "order_12345",
    "metadata": {
      "order_id": "12345",
      "customer_name": "Jean Dupont"
    }
  }'`;

const pythonMtn = `import kang_openbanking as kang

client = kang.Client(secret_key="sk_test_sandbox_KangOB2026Demo")

charge = client.charges.create(
    merchant_id="merch_test_001",
    amount="5000",
    currency="XAF",
    channel="mobile_money",
    provider="mtn_momo",
    customer_phone="+237650000000",
    description="Order #12345",
    tx_ref="order_12345",
)
print(f"Charge ID: {charge['data']['id']}")
print(f"Status: {charge['data']['status']}")  # 'pending'

# Poll for result
import time
for _ in range(10):
    time.sleep(3)
    result = client.charges.get(charge["data"]["id"])
    if result["data"]["status"] != "pending":
        print(f"Final status: {result['data']['status']}")
        break`;

const nodeMtn = `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  apiKey: 'sk_test_sandbox_KangOB2026Demo',
  environment: 'sandbox',
});

const charge = await kob.charges.create({
  merchant_id: 'merch_test_001',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  provider: 'mtn_momo',
  customer_phone: '+237650000000',
  description: 'Order #12345',
  tx_ref: 'order_12345',
});

console.log('Charge ID:', charge.data.id);
console.log('Status:', charge.data.status);`;

const goMtn = `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	body, _ := json.Marshal(map[string]interface{}{
		"merchant_id":    "merch_test_001",
		"amount":         5000,
		"currency":       "XAF",
		"channel":        "mobile_money",
		"provider":       "mtn_momo",
		"customer_phone": "+237650000000",
		"tx_ref":         "order_12345",
	})
	req, _ := http.NewRequest("POST",
		"https://api.kangopenbanking.com/v1/gateway-charges-router",
		bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer sk_test_sandbox_KangOB2026Demo")
	req.Header.Set("Content-Type", "application/json")
	resp, _ := http.DefaultClient.Do(req)
	defer resp.Body.Close()
	fmt.Println("Status:", resp.Status)
}`;

const javaMtn = `import java.net.http.*;
import java.net.URI;

public class MtnCharge {
    public static void main(String[] args) throws Exception {
        String body = """
            {"merchant_id":"merch_test_001","amount":5000,
             "currency":"XAF","channel":"mobile_money",
             "provider":"mtn_momo","customer_phone":"+237650000000",
             "tx_ref":"order_12345"}""";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.kangopenbanking.com/v1/gateway-charges-router"))
            .header("Authorization", "Bearer sk_test_sandbox_KangOB2026Demo")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}`;

export default function MtnMomoGuide() {
  return (
    <>
      <Helmet>
        <title>MTN MoMo Integration | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Integrate MTN Mobile Money payments in Cameroon and CEMAC. USSD push, disbursement, callbacks, test numbers, and complete code examples." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/mobile-money/mtn" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">MTN Mobile Money (MoMo)</h1>
          <p className="text-lg text-muted-foreground">
            Accept payments from MTN Mobile Money subscribers across Cameroon, Cote d'Ivoire, Ghana, Rwanda, Uganda, and Zambia.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="how-it-works">How It Works</h2>
          <div className="bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm text-muted-foreground overflow-x-auto whitespace-pre">
{`1. POST /v1/gateway/charges with provider: "mtn_momo"
2. Kang sends USSD push to the customer's phone
3. Customer sees: "Pay 5,000 XAF to [Merchant]? Enter PIN"
4. Customer enters their MoMo PIN
5. MTN confirms → Kang updates charge status
6. Webhook fires: charge.captured (or charge.failed)
   Average settlement: 2-5 seconds`}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="create-charge">Create Charge</h2>
          <CodeBlock examples={[
            { code: mtnCharge, language: "bash", label: "cURL" },
            { code: nodeMtn, language: "javascript", label: "Node.js" },
            { code: pythonMtn, language: "python", label: "Python" },
            { code: goMtn, language: "go", label: "Go" },
            { code: javaMtn, language: "java", label: "Java" },
          ]} title="MTN MoMo Charge" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="response">Response</h2>
          <CodeBlock examples={[{ code: `{
  "data": {
    "id": "ch_mtn_abc123",
    "merchant_id": "merch_test_001",
    "amount": "5000",
    "currency": "XAF",
    "channel": "mobile_money",
    "provider": "mtn_momo",
    "status": "pending",
    "provider_ref": "mtn_ref_789",
    "fee_amount": "125",
    "net_amount": "4875",
    "tx_ref": "order_12345",
    "created_at": "2026-03-27T14:32:00Z"
  },
  "meta": { "request_id": "req_abc123", "api_version": "${KOB_API_VERSION}" }
}`, language: "json" }]} title="Charge Response" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="status-flow">Status Flow</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["pending", "USSD push sent, waiting for user PIN entry"],
                  ["processing", "User confirmed, payment being processed by MTN"],
                  ["successful", "Payment completed — funds settled to merchant"],
                  ["failed", "Payment failed (insufficient funds, cancelled, timeout)"],
                ].map(([status, desc]) => (
                  <tr key={status} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{status}</td>
                    <td className="p-3 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="disbursement">MTN MoMo Disbursement (Payout)</h2>
          <CodeBlock examples={[{ code: `curl -X POST https://api.kangopenbanking.com/v1/gateway-payouts-router \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "amount": "10000",
    "currency": "XAF",
    "channel": "mtn_momo",
    "beneficiary_phone": "+237650000000",
    "tx_ref": "salary_march_001"
  }'`, language: "bash" }]} title="MoMo Disbursement" />
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
