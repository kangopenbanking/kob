import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { KOB_API_VERSION_LABEL } from "@/config/version";

const seedData = `# Generate a full set of test accounts, transactions, and merchants
curl -X POST https://sandbox-api.kangopenbanking.com/v1/sandbox/data/generate \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -d '{"scenario": "full_merchant", "reset": true}'`;

const simulateWebhook = `# Trigger a test webhook event
curl -X POST https://sandbox-api.kangopenbanking.com/v1/sandbox/webhooks \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_type": "charge.created",
    "target_url": "https://your-app.com/webhooks/kang"
  }'`;

export default function SandboxOverview() {
  return (
    <>
      <Helmet>
        <title>Sandbox Environment | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Free sandbox environment for testing the Kang Open Banking API. 1,000 requests/day, test credentials, simulated mobile money and card payments." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/sandbox" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Sandbox Environment</h1>
          <p className="text-lg text-muted-foreground">
            The Kang sandbox is a fully-functional test environment that mirrors production. Use it to test payments, open banking flows, and webhooks — free, no credit card required.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="overview">Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Property</th>
                  <th className="text-left p-3 font-medium text-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Sandbox Base URL", "https://sandbox-api.kangopenbanking.com/v1"],
                  ["Production Base URL", "https://api.kangopenbanking.com/v1"],
                  ["Free Tier", "1,000 requests/day, no credit card"],
                  ["Data Resets", "Every 24 hours (or on demand via API)"],
                  ["API Version", "Same as production (v4.28.2)"],
                  ["Rate Limits", "60 requests/minute"],
                ].map(([prop, val]) => (
                  <tr key={prop} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{prop}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="credentials">Test Credentials</h2>
          <p className="text-muted-foreground mb-4">
            Use these credentials immediately — no signup required:
          </p>
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
            {[
              ["Sandbox Secret Key", "sk_test_sandbox_KangOB2026Demo"],
              ["Sandbox Publishable Key", "pk_test_sandbox_KangOB2026Demo"],
              ["Test Merchant ID", "merch_test_001"],
              ["Sandbox Base URL", "https://sandbox-api.kangopenbanking.com/v1"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-sm font-medium text-foreground min-w-[200px]">{label}:</span>
                <code className="bg-muted px-2 py-1 rounded text-sm font-mono text-foreground break-all">{value}</code>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="test-mobile-money">Test Mobile Money Numbers</h2>
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
                  ["+237650000001", "MTN MoMo", "Simulates pending then success (5s delay)"],
                  ["+237650000002", "MTN MoMo", "Always fails (insufficient funds)"],
                  ["+237690000001", "Orange Money", "Always fails (account blocked)"],
                  ["+237650000099", "Any", "Triggers timeout after 30s"],
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
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="test-cards">Test Cards</h2>
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
                  ["4000 0000 0000 3220", "Visa", "3DS authentication required"],
                  ["4000 0000 0000 9995", "Visa", "Always fails (insufficient funds)"],
                  ["5555 5555 5555 4444", "Mastercard", "Always succeeds"],
                  ["5200 8282 8282 8210", "Mastercard", "Always fails (card declined)"],
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
          <p className="text-sm text-muted-foreground mt-2">Use any future expiry date, any 3-digit CVV, any billing postcode.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="seed-data">Seed Test Data</h2>
          <CodeBlock examples={[{ code: seedData, language: "bash" }]} title="Generate Seed Data" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="webhooks">Simulate Webhooks</h2>
          <CodeBlock examples={[{ code: simulateWebhook, language: "bash" }]} title="Trigger Test Webhook" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="deep-dive">Deep Dive</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "Test Credentials", desc: "Full list of sandbox keys and merchant IDs", path: "/developer/sandbox/credentials" },
              { title: "Test Cards", desc: "All test card numbers and their behaviors", path: "/developer/sandbox/test-cards" },
              { title: "Test Mobile Money", desc: "MTN MoMo and Orange Money test numbers", path: "/developer/sandbox/mobile-money" },
              { title: "Simulate Webhooks", desc: "Trigger all 52 webhook event types", path: "/developer/sandbox/simulate-webhooks" },
            ].map((card) => (
              <Link key={card.path} to={card.path} className="block border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <h3 className="font-semibold text-foreground mb-1">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
