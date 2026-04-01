import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Info } from "lucide-react";

const SLAMonitorGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="SLA Monitoring API | Kang Open Banking" description="Real-time uptime metrics, latency percentiles (p50/p95/p99), incident tracking, and historical performance for platform SLA compliance." />
    <div>
      <Badge variant="outline" className="mb-2">Operations</Badge>
      <h1 className="text-3xl font-bold">SLA Monitoring API</h1>
      <p className="text-muted-foreground mt-2">
        Access real-time and historical platform performance data including uptime percentages, latency percentiles, and incident management. 
        Use these endpoints to verify SLA compliance and integrate with your own monitoring stack.
      </p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        KOB continuously monitors all API endpoints and payment rails. Health checks run every 30 seconds from multiple geographic points. Metrics are aggregated into SLA reports, and incidents are tracked with real-time status updates. Use the <a href="/developer/status" className="text-primary underline">API Status Page</a> for a visual dashboard.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Monitoring Architecture</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Health Checks (30s)", "Metric Aggregation", "SLA Calculation", "Anomaly Detection", "Incident Creation", "Alert Dispatch"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* SLA Targets */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">SLA Targets</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Measurement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { metric: "API Uptime", target: "99.95%", measurement: "Rolling 30-day, excludes scheduled maintenance" },
            { metric: "API Latency (p95)", target: "< 500ms", measurement: "95th percentile response time" },
            { metric: "Webhook Delivery", target: "< 5 seconds", measurement: "Time from event to first delivery attempt" },
            { metric: "Incident Response", target: "< 15 minutes", measurement: "Time from detection to first status update" },
            { metric: "Payment Processing", target: "< 3 seconds", measurement: "End-to-end charge creation time" },
          ].map(s => (
            <TableRow key={s.metric}>
              <TableCell className="font-medium text-sm">{s.metric}</TableCell>
              <TableCell className="text-sm"><code className="bg-muted px-1.5 py-0.5 rounded">{s.target}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.measurement}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Incident Severity */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Incident Severity Levels</h2>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { level: "critical", desc: "Complete service outage or data loss. All hands on deck.", color: "destructive" as const },
          { level: "major", desc: "Significant degradation affecting multiple customers or payment channels.", color: "secondary" as const },
          { level: "minor", desc: "Elevated latency or intermittent errors. Limited customer impact.", color: "outline" as const },
        ].map(l => (
          <div key={l.level} className="border rounded-lg p-3">
            <Badge variant={l.color}>{l.level}</Badge>
            <p className="text-xs text-muted-foreground mt-2">{l.desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="GET" endpoint="/v1/sla/metrics" description="Retrieve current SLA metrics including uptime, latency, and error rate."
      parameters={[
        { name: "period", type: "string", required: false, description: "Time period: 24h, 7d, 30d, 90d (default: 30d)" },
        { name: "service", type: "string", required: false, description: "Filter by service: charges, payouts, wallets, webhooks, all (default: all)" },
      ]}
      response={JSON.stringify({
        data: {
          uptime_percentage: 99.97,
          period: "30d",
          latency: { p50_ms: 145, p95_ms: 380, p99_ms: 720 },
          total_requests: 2847391,
          error_rate: 0.03,
          services: [
            { name: "charges", uptime: 99.99, p95_ms: 290 },
            { name: "payouts", uptime: 99.95, p95_ms: 450 },
            { name: "wallets", uptime: 99.99, p95_ms: 120 },
            { name: "webhooks", uptime: 99.98, p95_ms: 180 },
          ],
          measured_at: "2026-03-01T10:00:00Z"
        }
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/sla/incidents" description="List current and past service incidents with status updates."
      parameters={[
        { name: "status", type: "string", required: false, description: "Filter: active, resolved, all (default: all)" },
        { name: "severity", type: "string", required: false, description: "Filter: critical, major, minor" },
        { name: "limit", type: "number", required: false, description: "Results per page (default: 10)" },
      ]}
      response={JSON.stringify({
        data: [
          {
            id: "inc_001", title: "Elevated latency on payout processing", severity: "minor",
            status: "resolved", started_at: "2026-02-28T14:00:00Z", resolved_at: "2026-02-28T14:45:00Z",
            affected_services: ["payouts", "instant-payouts"],
            impact: "2.3% of payout requests experienced >2s latency",
            updates: [
              { message: "Investigating elevated p95 latency on payout endpoints", timestamp: "2026-02-28T14:05:00Z" },
              { message: "Root cause: provider rate limiting. Mitigation applied.", timestamp: "2026-02-28T14:30:00Z" },
              { message: "All systems nominal. Incident resolved.", timestamp: "2026-02-28T14:45:00Z" },
            ]
          }
        ]
      }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/sla/metrics/history" description="Retrieve historical SLA metrics for trend analysis."
      parameters={[
        { name: "period", type: "string", required: false, description: "Granularity: hourly, daily, weekly (default: daily)" },
        { name: "from", type: "string", required: false, description: "Start date (ISO 8601)" },
        { name: "to", type: "string", required: false, description: "End date (ISO 8601)" },
      ]}
      response={JSON.stringify({
        data: [
          { date: "2026-02-28", uptime: 99.95, p95_ms: 380, total_requests: 94913, error_rate: 0.05 },
          { date: "2026-02-27", uptime: 99.99, p95_ms: 320, total_requests: 91254, error_rate: 0.01 },
        ]
      }, null, 2)}
    />

    {/* Code Example */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Integration Example</h2>
      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`// Poll SLA metrics and alert on degradation
const metrics = await fetch('/v1/sla/metrics?period=24h', {
  headers: { 'Authorization': 'Bearer sk_live_...' }
}).then(r => r.json());

if (metrics.data.uptime_percentage < 99.9) {
  alert('SLA breach: uptime below 99.9%');
}
if (metrics.data.latency.p95_ms > 500) {
  alert('Latency SLA breach: p95 > 500ms');
}

// Check for active incidents
const incidents = await fetch('/v1/sla/incidents?status=active', {
  headers: { 'Authorization': 'Bearer sk_live_...' }
}).then(r => r.json());

if (incidents.data.length > 0) {
  console.log('Active incidents:', incidents.data.map(i => i.title));
}`}
      </pre>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Public Status Page</strong> — For a visual dashboard of current system status without authentication, visit the <a href="/developer/status" className="text-primary underline">API Status Page</a>. It shows real-time uptime, latency, and active incidents.
      </AlertDescription>
    </Alert>

    <DocNavigation
      previousPage={{ title: "Webhooks v2", path: "/developer/gateway/webhooks-v2" }}
      nextPage={{ title: "API Status", path: "/developer/status" }}
    />
  </div>
);

export default SLAMonitorGuide;
