import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const SandboxPayoutSimGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Payout Simulation | Kang Open Banking Sandbox" description="Test payout scenarios in sandbox mode including failures, timeouts, and reversals with automated timeline generation." />
    <div>
      <Badge variant="outline" className="mb-2">Sandbox</Badge>
      <h1 className="text-3xl font-bold">Payout Simulation</h1>
      <p className="text-muted-foreground mt-2">
        Test complex payout lifecycles in sandbox mode without using real funds. 
        Choose from pre-seeded scenarios to simulate success, failure, timeout, and reversal conditions. Webhooks are dispatched for each state transition.
      </p>
    </div>

    <ApiEndpoint method="POST" endpoint="/v1/sandbox/payout-sim" description="Simulate a payout with a specific scenario."
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

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Available Scenarios</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">Scenario</th>
              <th className="text-left py-2 font-semibold">Final Status</th>
              <th className="text-left py-2 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b"><td className="py-2 font-mono">success</td><td>successful</td><td>Standard successful payout</td></tr>
            <tr className="border-b"><td className="py-2 font-mono">insufficient_funds</td><td>failed</td><td>Fails due to low float balance</td></tr>
            <tr className="border-b"><td className="py-2 font-mono">network_timeout</td><td>failed</td><td>Provider timeout after 30s</td></tr>
            <tr className="border-b"><td className="py-2 font-mono">invalid_account</td><td>failed</td><td>Destination account not found</td></tr>
            <tr className="border-b"><td className="py-2 font-mono">reversed_after_success</td><td>reversed</td><td>Completes then reverses after 30s</td></tr>
            <tr className="border-b"><td className="py-2 font-mono">compliance_block</td><td>blocked</td><td>Blocked by compliance screening</td></tr>
            <tr><td className="py-2 font-mono">delayed_settlement</td><td>successful</td><td>Settlement delayed to T+48h</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <DocNavigation
      previousPage={{ title: "Data Generator", path: "/developer/sandbox/data-generator" }}
      nextPage={{ title: "API Status", path: "/developer/status" }}
    />
  </div>
);

export default SandboxPayoutSimGuide;
