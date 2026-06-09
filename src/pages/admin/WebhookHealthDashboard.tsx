/**
 * Webhook ingestion health dashboard.
 *
 * Aggregates last-24h Youverify webhook outcomes plus open admin alerts
 * for step-up / manual-review spikes raised by `webhook-health-rollup`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, AlertTriangle, CheckCircle2, GitMerge, RefreshCw } from "lucide-react";

export default function WebhookHealthDashboard() {
  const since24h = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString();
  }, []);

  const events = useQuery({
    queryKey: ["webhook-health-events", since24h],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youverify_webhook_events")
        .select("id, event_id, event_type, outcome, outcome_detail, discrepancy, skew_seconds, processed_at")
        .gte("processed_at", since24h)
        .order("processed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const alerts = useQuery({
    queryKey: ["webhook-health-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_alerts")
        .select("id, alert_type, severity, title, message, metadata, created_at, acknowledged_at")
        .in("alert_type", ["webhook_manual_review_spike", "step_up_denied_spike", "webhook_correlation_failure_spike"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const idem = useQuery({
    queryKey: ["webhook-health-idem"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("kyc_gateway_idempotency")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since24h);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  const counters = useMemo(() => {
    const rows = events.data ?? [];
    const total = rows.length;
    const processed = rows.filter((r) => r.outcome === "processed" || r.outcome === "applied").length;
    const manualReview = rows.filter((r) => r.outcome_detail?.includes("manual_review") || r.outcome === "discrepancy").length;
    const duplicates = rows.filter((r) => r.outcome === "duplicate").length;
    const failures = rows.filter((r) => ["bad_signature", "missing_timestamp", "stale", "session_not_found", "no_session"].includes(r.outcome ?? "")).length;
    const successPct = total > 0 ? Math.round((processed / total) * 100) : 100;
    return { total, processed, manualReview, duplicates, failures, successPct };
  }, [events.data]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Webhook Health</h1>
          <p className="text-sm text-muted-foreground">Last 24 hours · Youverify ingestion, manual-review fallbacks, idempotency, and active alerts.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { events.refetch(); alerts.refetch(); idem.refetch(); }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="webhook-kpis">
        <Kpi icon={Activity} label="Events" value={counters.total} />
        <Kpi icon={CheckCircle2} label="Success %" value={`${counters.successPct}%`} accent={counters.successPct >= 95 ? "good" : "warn"} />
        <Kpi icon={AlertTriangle} label="Manual review" value={counters.manualReview} accent={counters.manualReview > 0 ? "warn" : undefined} />
        <Kpi icon={GitMerge} label="Duplicates" value={counters.duplicates} />
        <Kpi icon={Activity} label="Idempotency keys (24h)" value={idem.data ?? 0} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Active alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {(alerts.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhook or step-up alerts in the queue.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(alerts.data ?? []).map((a) => (
                  <TableRow key={a.id} data-alert-row={a.alert_type}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{a.alert_type}</Badge></TableCell>
                    <TableCell><Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>{a.severity}</Badge></TableCell>
                    <TableCell className="text-sm">{a.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Skew (s)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events.data ?? []).slice(0, 100).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{new Date(e.processed_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{e.event_type}</TableCell>
                  <TableCell><Badge variant={e.outcome === "processed" || e.outcome === "applied" ? "secondary" : "outline"}>{e.outcome ?? "—"}</Badge></TableCell>
                  <TableCell className="text-xs">{e.outcome_detail ?? ""}</TableCell>
                  <TableCell className="text-xs">{e.skew_seconds ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: "good" | "warn" }) {
  const tone = accent === "warn" ? "text-amber-600" : accent === "good" ? "text-emerald-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
        <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
