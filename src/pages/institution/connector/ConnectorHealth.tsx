import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { StatusBadge } from "@/components/institution/connector/StatusBadge";
import { ConnectorEmptyState } from "@/components/institution/connector/ConnectorEmptyState";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Wifi, Clock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { format, differenceInHours } from "date-fns";

export default function ConnectorHealth() {
  const { bankId, bankName, loading: bankLoading } = useBankConnector();

  const { data: lastUpload } = useQuery({
    queryKey: ["connector-health-last", bankId],
    queryFn: async () => {
      if (!bankId) return null;
      const { data } = await supabase
        .from("bank_file_uploads")
        .select("received_at, status, file_type")
        .eq("bank_id", bankId)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!bankId,
  });

  const { data: recentUploads } = useQuery({
    queryKey: ["connector-health-recent", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("bank_file_uploads")
        .select("status")
        .eq("bank_id", bankId)
        .gte("received_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      return data ?? [];
    },
    enabled: !!bankId,
  });

  const { data: connectorInstances } = useQuery({
    queryKey: ["connector-health-instances", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("bank_connector_instances")
        .select("id, name, status, last_seen_at, connector_type, environment")
        .eq("bank_id", bankId);
      return data ?? [];
    },
    enabled: !!bankId,
  });

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={Shield} title="Connector Health" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!bankId) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={Shield} title="Connector Health" description="Monitor connector status and system health" />
        <ConnectorEmptyState icon={Shield} title="No Bank Connected" description="Link a bank profile to monitor connector health." />
      </div>
    );
  }

  const hoursSinceLastUpload = lastUpload ? differenceInHours(new Date(), new Date(lastUpload.received_at)) : null;
  const failedRecent = recentUploads?.filter((u) => u.status === "failed").length ?? 0;
  const overallHealth = failedRecent > 2 ? "degraded" : hoursSinceLastUpload !== null && hoursSinceLastUpload > 48 ? "degraded" : "healthy";

  const alerts: { message: string; severity: "warning" | "error" }[] = [];
  if (hoursSinceLastUpload !== null && hoursSinceLastUpload > 48) {
    alerts.push({ message: `No files received in ${hoursSinceLastUpload} hours`, severity: "warning" });
  }
  if (failedRecent > 0) {
    alerts.push({ message: `${failedRecent} import(s) failed in the last 24 hours`, severity: "error" });
  }

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={Shield} title="Connector Health" description={`System health for ${bankName ?? "your bank"}`} />

      {/* Health Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            {overallHealth === "healthy" ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            )}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Overall Status</p>
              <StatusBadge status={overallHealth} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Last File Received</p>
              <p className="text-sm font-medium">
                {lastUpload ? format(new Date(lastUpload.received_at), "MMM d, yyyy HH:mm") : "Never"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Wifi className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Integration Mode</p>
              <p className="text-sm font-medium">File (Portal Upload)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Active Alerts</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className={`h-4 w-4 ${a.severity === "error" ? "text-red-500" : "text-orange-500"}`} />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connector Instances */}
      {connectorInstances && connectorInstances.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Connector Instances</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Environment</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {connectorInstances.map((ci) => (
                  <tr key={ci.id} className="border-b border-border/50">
                    <td className="p-3 font-medium">{ci.name}</td>
                    <td className="p-3">{ci.connector_type}</td>
                    <td className="p-3"><StatusBadge status={ci.environment} /></td>
                    <td className="p-3"><StatusBadge status={ci.status} /></td>
                    <td className="p-3 text-muted-foreground">{ci.last_seen_at ? format(new Date(ci.last_seen_at), "MMM d, HH:mm") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
