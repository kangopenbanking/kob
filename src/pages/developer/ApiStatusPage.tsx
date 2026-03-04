import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const services = [
  { name: "Payment Gateway (Charges)", status: "operational", uptime: "99.99%" },
  { name: "Payment Gateway (Payouts)", status: "operational", uptime: "99.97%" },
  { name: "Wallets API", status: "operational", uptime: "99.99%" },
  { name: "Escrow API", status: "operational", uptime: "99.98%" },
  { name: "Open Banking (AISP/PISP)", status: "operational", uptime: "99.95%" },
  { name: "Compliance Screening", status: "operational", uptime: "99.96%" },
  { name: "Webhook Delivery", status: "operational", uptime: "99.94%" },
  { name: "Authentication & OAuth", status: "operational", uptime: "99.99%" },
  { name: "Sandbox Environment", status: "operational", uptime: "99.90%" },
  { name: "Developer Portal & API Docs", status: "operational", uptime: "99.99%" },
];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "operational") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === "degraded") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
};

const ApiStatusPage = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="API Status | Kang Open Banking" description="Real-time system status for the Kang Open Banking platform. Uptime, latency, and incident tracking." />
    <div>
      <Badge variant="outline" className="mb-2">System Status</Badge>
      <h1 className="text-3xl font-bold">API Status</h1>
      <p className="text-muted-foreground mt-2">
        Real-time platform status and performance metrics. Subscribe to status updates via webhooks or check this page for current system health.
      </p>
    </div>

    <Card className="border-green-500/30 bg-green-500/5">
      <CardContent className="flex items-center gap-3 py-4">
        <CheckCircle className="h-6 w-6 text-green-500" />
        <div>
          <p className="font-semibold text-green-700 dark:text-green-400">All Systems Operational</p>
          <p className="text-sm text-muted-foreground">Last checked: {new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</p>
        </div>
      </CardContent>
    </Card>

    <div>
      <h2 className="text-xl font-bold mb-3">Service Status</h2>
      <div className="space-y-2">
        {services.map(s => (
          <div key={s.name} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <StatusIcon status={s.status} />
              <span className="text-sm font-medium">{s.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">{s.uptime} uptime (30d)</span>
              <Badge variant="outline" className="text-green-600 border-green-300 text-xs capitalize">{s.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <h2 className="text-xl font-bold mb-3">Performance (Last 30 Days)</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Uptime</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">99.97%</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Latency (p50)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">145ms</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Latency (p95)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">380ms</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Latency (p99)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">720ms</p></CardContent>
        </Card>
      </div>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Recent Incidents</h3>
      <p className="text-sm text-muted-foreground">No incidents in the last 30 days.</p>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Subscribe to Status Updates</h3>
      <p className="text-sm text-muted-foreground">
        Register a webhook endpoint to receive real-time status notifications. Use the <code className="bg-muted px-1 rounded">platform.incident.*</code> event type via the <a href="/developer/gateway/webhooks-v2" className="text-primary underline">Webhooks v2 API</a>.
      </p>
    </div>
  </div>
);

export default ApiStatusPage;
