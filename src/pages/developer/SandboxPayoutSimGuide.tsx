import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Info } from "lucide-react";

const SandboxPayoutSimGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Payout Simulation | Kang Open Banking Sandbox" description="Test payout scenarios in sandbox mode — simulate success, failure, timeout, reversal, and compliance blocks with automated webhook dispatch." />
    <div>
      <Badge variant="outline" className="mb-2">Sandbox</Badge>
      <h1 className="text-3xl font-bold">Payout Simulation</h1>
      <p className="text-muted-foreground mt-2">
        Test complex payout lifecycles in sandbox mode without using real funds. 
        Choose from pre-seeded scenarios to simulate success, failure, timeout, and reversal conditions. Webhooks are dispatched for each state transition, letting you test your webhook handler end-to-end.
      </p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        The payout simulator replays a full payout lifecycle with realistic timing and webhook events. Select a scenario, provide an amount and destination, and the simulator generates a timeline of events — each dispatching a webhook to your configured endpoint. This lets you test your integration's handling of every possible payout outcome.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Simulation Flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Choose Scenario", "Submit Simulation", "Timeline Generated", "Webhooks Dispatched", "Verify Your Handler"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="POST" endpoint="/v1/sandbox/payout-sim" description="Simulate a payout with a specific scenario. Webhooks are dispatched to your configured endpoint."
      parameters={[
        { name: "scenario", type: "string", required: true, description: "Pre-seeded scenario name (see table below)" },
        { name: "amount", type: "number", required: true, description: "Simulated payout amount" },
        { name: "currency", type: "string", required: true, description: "ISO 4217 currency code" },
        { name: "destination_type", type: "string", required: false, description: "bank_account, mobile_money, or card" },
        { name: "webhook_url", type: "string", required: false, description: "Override webhook URL for this simulation" },
      ]}
      response={JSON.stringify({
        data: {
          simulation_id: "sim_001",
          scenario: "reversed_after_success",
          timeline: [
            { event: "payout.created", timestamp: "T+0s", status: "pending" },
            { event: "payout.processing", timestamp: "T+2s", status: "processing" },
            { event: "payout.completed", timestamp: "T+5s", status: "successful" },
            { event: "payout.reversed", timestamp: "T+30s", status: "reversed" },
          ],
          webhooks_dispatched: 4
        }
      }, null, 2)}
    />

    {/* Available Scenarios */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Available Scenarios</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scenario</TableHead>
            <TableHead>Final Status</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Webhooks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { scenario: "success", status: "successful", desc: "Standard successful payout — funds delivered", webhooks: 3 },
            { scenario: "insufficient_funds", status: "failed", desc: "Fails due to low treasury float balance", webhooks: 2 },
            { scenario: "network_timeout", status: "failed", desc: "Provider timeout after 30 seconds", webhooks: 2 },
            { scenario: "invalid_account", status: "failed", desc: "Destination account not found or invalid", webhooks: 2 },
            { scenario: "reversed_after_success", status: "reversed", desc: "Completes successfully, then reversed after 30s", webhooks: 4 },
            { scenario: "compliance_block", status: "blocked", desc: "Blocked by inline compliance screening", webhooks: 2 },
            { scenario: "delayed_settlement", status: "successful", desc: "Settlement delayed to T+48h (standard rail)", webhooks: 3 },
          ].map(s => (
            <TableRow key={s.scenario}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{s.scenario}</code></TableCell>
              <TableCell><Badge variant={s.status === "successful" ? "default" : s.status === "failed" || s.status === "blocked" ? "destructive" : "secondary"}>{s.status}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.desc}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.webhooks}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Code Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Code Example</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Test the "reversed_after_success" scenario
curl -X POST https://api.kangopenbanking.com/v1/sandbox/payout-sim \\
  -H "Authorization: Bearer sk_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "scenario": "reversed_after_success",
    "amount": 25000,
    "currency": "XAF",
    "destination_type": "mobile_money",
    "webhook_url": "https://your-app.com/webhooks/test"
  }'

# Your webhook handler will receive 4 events:
# T+0s  → payout.created   (status: pending)
# T+2s  → payout.processing (status: processing)
# T+5s  → payout.completed  (status: successful)
# T+30s → payout.reversed   (status: reversed)
# Verify your handler correctly reverses the credit!`}
      </pre>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Testing Best Practices</strong> — Test every scenario before going live, especially <code className="bg-muted px-1 rounded">reversed_after_success</code> and <code className="bg-muted px-1 rounded">compliance_block</code>. These edge cases are rare in production but critical to handle correctly. Use the <code className="bg-muted px-1 rounded">webhook_url</code> parameter to point simulations at your staging environment.
      </AlertDescription>
    </Alert>

    <AutoDocNavigation />
  </div>
);

export default SandboxPayoutSimGuide;
