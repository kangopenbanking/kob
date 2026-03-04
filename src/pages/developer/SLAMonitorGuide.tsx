import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const SLAMonitorGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="SLA Monitoring API | Kang Open Banking" description="Real-time uptime metrics, latency percentiles (p50/p95/p99), and incident tracking for platform SLA compliance." />
    <div>
      <Badge variant="outline" className="mb-2">Operations</Badge>
      <h1 className="text-3xl font-bold">SLA Monitoring API</h1>
      <p className="text-muted-foreground mt-2">
        Access real-time and historical platform performance data including uptime percentages, latency percentiles, and incident management. 
        Use these endpoints to verify SLA compliance and integrate with your own monitoring stack.
      </p>
    </div>

    <ApiEndpoint method="GET" endpoint="/v1/sla/metrics" description="Retrieve current SLA metrics including uptime and latency."
      parameters={[
        { name: "period", type: "string", required: false, description: "Time period: 24h, 7d, 30d, 90d (default: 30d)" },
      ]}
      response={JSON.stringify({
        data: {
          uptime_percentage: 99.97,
          period: "30d",
          latency: { p50_ms: 145, p95_ms: 380, p99_ms: 720 },
          total_requests: 2847391,
          error_rate: 0.03,
          measured_at: "2026-03-01T10:00:00Z"
        }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/sla/incidents" description="List current and past service incidents."
      parameters={[
        { name: "status", type: "string", required: false, description: "Filter by status: active, resolved, all (default: all)" },
        { name: "limit", type: "number", required: false, description: "Results per page (default: 10)" },
      ]}
      response={JSON.stringify({
        data: [
          {
            id: "inc_001", title: "Elevated latency on payout processing", severity: "minor",
            status: "resolved", started_at: "2026-02-28T14:00:00Z", resolved_at: "2026-02-28T14:45:00Z",
            affected_services: ["payouts", "instant-payouts"],
            updates: [
              { message: "Investigating elevated p95 latency on payout endpoints", timestamp: "2026-02-28T14:05:00Z" },
              { message: "Root cause identified: provider rate limiting. Mitigation applied.", timestamp: "2026-02-28T14:30:00Z" },
              { message: "All systems nominal. Incident resolved.", timestamp: "2026-02-28T14:45:00Z" },
            ]
          }
        ]
      }, null, 2)}
    />

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">SLA Targets</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">Metric</th>
              <th className="text-left py-2 font-semibold">Target</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b"><td className="py-2">Uptime</td><td>99.95%</td></tr>
            <tr className="border-b"><td className="py-2">API Latency (p95)</td><td>&lt; 500ms</td></tr>
            <tr className="border-b"><td className="py-2">Webhook Delivery</td><td>&lt; 5 seconds</td></tr>
            <tr><td className="py-2">Incident Response</td><td>&lt; 15 minutes</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <DocNavigation
      previousPage={{ title: "Webhooks v2", path: "/developer/gateway/webhooks-v2" }}
      nextPage={{ title: "API Status", path: "/developer/status" }}
    />
  </div>
);

export default SLAMonitorGuide;
