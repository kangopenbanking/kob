import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const chargeExample = `curl -X POST https://api.kangopenbanking.com/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "merchant_id": "merch_test_001",
    "amount": 5000,
    "currency": "XAF",
    "channel": "card",
    "card": {
      "number": "4242424242424242",
      "exp_month": 12,
      "exp_year": 2030,
      "cvv": "123"
    },
    "tx_ref": "test_card_001"
  }'`;

export default function SandboxTestCards() {
  return (
    <>
      <Helmet>
        <title>Test Cards | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Test card numbers for the Kang Open Banking sandbox. Visa, Mastercard, 3D Secure, declined, and insufficient funds test scenarios." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/sandbox/test-cards" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Test Cards</h1>
          <p className="text-lg text-muted-foreground">
            Use these card numbers in the sandbox to simulate different payment outcomes. Use any future expiry date, any 3-digit CVV, and any billing postcode.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="successful">Successful Payments</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Card Number</th>
                  <th className="text-left p-3 font-medium text-foreground">Brand</th>
                  <th className="text-left p-3 font-medium text-foreground">Behavior</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["4242 4242 4242 4242", "Visa", "Always succeeds"],
                  ["5555 5555 5555 4444", "Mastercard", "Always succeeds"],
                  ["3782 822463 10005", "Amex", "Always succeeds"],
                  ["6011 1111 1111 1117", "Discover", "Always succeeds"],
                ].map(([card, brand, behavior]) => (
                  <tr key={card} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{card}</td>
                    <td className="p-3 text-muted-foreground">{brand}</td>
                    <td className="p-3 text-muted-foreground">{behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="3ds">3D Secure</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Card Number</th>
                  <th className="text-left p-3 font-medium text-foreground">Brand</th>
                  <th className="text-left p-3 font-medium text-foreground">Behavior</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["4000 0000 0000 3220", "Visa", "3DS required, authentication succeeds"],
                  ["4000 0025 0000 3155", "Visa", "3DS required, user must complete challenge"],
                  ["4000 0000 0000 3063", "Visa", "3DS required, authentication fails"],
                ].map(([card, brand, behavior]) => (
                  <tr key={card} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{card}</td>
                    <td className="p-3 text-muted-foreground">{brand}</td>
                    <td className="p-3 text-muted-foreground">{behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="declined">Declined and Errors</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Card Number</th>
                  <th className="text-left p-3 font-medium text-foreground">Error Code</th>
                  <th className="text-left p-3 font-medium text-foreground">Behavior</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["4000 0000 0000 0002", "card_declined", "Generic decline"],
                  ["4000 0000 0000 9995", "insufficient_funds", "Insufficient funds"],
                  ["4000 0000 0000 9987", "lost_card", "Lost card"],
                  ["4000 0000 0000 0069", "expired_card", "Expired card"],
                  ["4000 0000 0000 0127", "incorrect_cvc", "Incorrect CVV"],
                  ["4000 0000 0000 0119", "processing_error", "Processing error"],
                  ["4242 4242 4242 4241", "invalid_number", "Invalid card number"],
                ].map(([card, code, behavior]) => (
                  <tr key={card} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{card}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{code}</td>
                    <td className="p-3 text-muted-foreground">{behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="example">Example: Create a Card Charge</h2>
          <CodeBlock examples={[{ code: chargeExample, language: "bash", label: "cURL" }]} />
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
