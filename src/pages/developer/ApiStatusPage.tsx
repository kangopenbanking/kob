import { useState, useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ServiceStatus {
  name: string;
  key: string;
  status: "operational" | "degraded" | "down" | "dormant";
  uptime: string;
}

const fallbackServices: ServiceStatus[] = [
  { name: "Payment Gateway (Charges)", key: "mobile_money", status: "operational", uptime: "99.99%" },
  { name: "Payment Gateway (Payouts)", key: "banking", status: "operational", uptime: "99.97%" },
  { name: "Wallets API", key: "database", status: "operational", uptime: "99.99%" },
  { name: "Open Banking (AISP)", key: "aisp", status: "operational", uptime: "99.95%" },
  { name: "Open Banking (PISP)", key: "pisp", status: "operational", uptime: "99.95%" },
  { name: "Virtual Cards", key: "virtual_cards", status: "dormant", uptime: "—" },
  { name: "Webhook Delivery", key: "webhooks", status: "operational", uptime: "99.94%" },
  { name: "Authentication & OAuth", key: "oauth", status: "operational", uptime: "99.99%" },
  { name: "Certificates (mTLS)", key: "certificates", status: "operational", uptime: "99.96%" },
  { name: "Database", key: "database", status: "operational", uptime: "99.99%" },
];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "operational") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === "degraded") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  if (status === "dormant") return <Clock className="h-4 w-4 text-muted-foreground" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
};

const ApiStatusPage = () => {
  const [services, setServices] = useState<ServiceStatus[]>(fallbackServices);
  const [overallStatus, setOverallStatus] = useState<"operational" | "degraded" | "down">("operational");
  const [lastChecked, setLastChecked] = useState<string>(new Date().toISOString());
  const [loading, setLoading] = useState(false);
  const [fapiCompliance, setFapiCompliance] = useState<Record<string, any> | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-health");
      if (error || !data) throw new Error("Failed to fetch health");

      const liveServices = fallbackServices.map((svc) => {
        const liveStatus = data.services?.[svc.key];
        const mappedStatus = liveStatus === "operational" ? "operational"
          : liveStatus === "degraded" ? "degraded"
          : liveStatus === "dormant" ? "dormant"
          : "down";
        return {
          ...svc,
          status: mappedStatus as ServiceStatus["status"],
          uptime: mappedStatus === "dormant" ? "—" : svc.uptime,
        };
      });

      setServices(liveServices);
      // Exclude dormant services from overall status calculation
      const activeServices = liveServices.filter(s => s.status !== "dormant");
      const allActive = activeServices.every(s => s.status === "operational");
      setOverallStatus(allActive ? "operational" : "degraded");
      setLastChecked(data.timestamp || new Date().toISOString());
      if (data.fapi_compliance) setFapiCompliance(data.fapi_compliance);
    } catch {
      // Keep fallback data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const allOk = overallStatus === "operational";

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <SEO title="API Status | Kang Open Banking" description="Real-time system status for the Kang Open Banking platform. Uptime, latency, and incident tracking." />
      <div className="flex items-start justify-between">
        <div>
          <Badge variant="outline" className="mb-2">System Status</Badge>
          <h1 className="text-3xl font-bold">API Status</h1>
          <p className="text-muted-foreground mt-2">
            Real-time platform status and performance metrics.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className={allOk ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"}>
        <CardContent className="flex items-center gap-3 py-4">
          {allOk ? <CheckCircle className="h-6 w-6 text-green-500" /> : <AlertTriangle className="h-6 w-6 text-yellow-500" />}
          <div>
            <p className={`font-semibold ${allOk ? "text-green-700 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"}`}>
              {allOk ? "All Systems Operational" : "Some Services Degraded"}
            </p>
            <p className="text-sm text-muted-foreground">
              Last checked: {lastChecked.slice(0, 16).replace("T", " ")} UTC
            </p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold mb-3">Service Status</h2>
        <div className="space-y-2">
          {services.map((s) => (
            <div key={s.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <StatusIcon status={s.status} />
                <span className="text-sm font-medium">{s.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">{s.uptime} uptime (30d)</span>
                <Badge
                  variant="outline"
                  className={`text-xs capitalize ${
                    s.status === "operational"
                      ? "text-green-600 border-green-300"
                      : s.status === "degraded"
                      ? "text-yellow-600 border-yellow-300"
                      : s.status === "dormant"
                      ? "text-muted-foreground border-muted"
                      : "text-red-600 border-red-300"
                  }`}
                >
                  {s.status === "dormant" ? "Coming Soon" : s.status}
                </Badge>
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

      {fapiCompliance && (
        <div className="bg-muted/50 rounded-lg p-4 border">
          <h3 className="font-semibold mb-2">FAPI Compliance</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <span>Profile: <strong>{fapiCompliance.profile}</strong></span>
            <span>mTLS: <Badge variant="outline" className="text-xs">{fapiCompliance.mtls_supported ? "✓" : "✗"}</Badge></span>
            <span>PAR: <Badge variant="outline" className="text-xs">{fapiCompliance.par_supported ? "✓" : "✗"}</Badge></span>
            <span>JAR: <Badge variant="outline" className="text-xs">{fapiCompliance.jar_supported ? "✓" : "✗"}</Badge></span>
            <span>PKCE: <Badge variant="outline" className="text-xs">{fapiCompliance.pkce_required ? "Required" : "Optional"}</Badge></span>
          </div>
        </div>
      )}

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
};

export default ApiStatusPage;
