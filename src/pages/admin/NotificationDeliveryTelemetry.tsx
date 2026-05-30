import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

interface KPI {
  channel: "email" | "push" | "sms";
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  suppressed: number;
  rate_limited: number;
  success_rate: number | null;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
}

interface EventRow {
  id: string;
  channel: string;
  status: string;
  provider: string | null;
  template_name: string | null;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
  created_at: string;
}

const RANGES: Record<string, number> = {
  "1h": 1,
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

export default function NotificationDeliveryTelemetry() {
  const [range, setRange] = useState("24h");
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [recent, setRecent] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const since = useMemo(
    () => new Date(Date.now() - RANGES[range] * 3600 * 1000).toISOString(),
    [range],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [kRes, rRes] = await Promise.all([
        supabase.rpc("notification_delivery_kpis", { _since: since }),
        supabase
          .from("notification_delivery_events")
          .select("id, channel, status, provider, template_name, error_code, error_message, latency_ms, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (kRes.error) throw kRes.error;
      if (rRes.error) throw rRes.error;
      setKpis((kRes.data ?? []) as KPI[]);
      setRecent((rRes.data ?? []) as EventRow[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load telemetry");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const totals = useMemo(() => {
    const t = kpis.reduce(
      (acc, k) => {
        acc.total += k.total;
        acc.failed += k.failed;
        return acc;
      },
      { total: 0, failed: 0 },
    );
    const success = t.total > 0 ? Math.round(((t.total - t.failed) / t.total) * 10000) / 100 : null;
    return { ...t, success };
  }, [kpis]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notification Delivery Telemetry</h1>
          <p className="text-sm text-muted-foreground">
            Unified observability across email, push, and SMS.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(RANGES).map(k => <SelectItem key={k} value={k}>Last {k}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="flex items-center gap-2 py-3 text-destructive">
            <AlertTriangle className="h-4 w-4" /> {error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total events</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{totals.total.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Overall success</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totals.success ?? "—"}{totals.success != null && "%"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Failed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold text-destructive">{totals.failed.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Channels active</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{kpis.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Per-channel KPIs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Bounced</TableHead>
                <TableHead className="text-right">Rate-limited</TableHead>
                <TableHead className="text-right">Success %</TableHead>
                <TableHead className="text-right">p50 ms</TableHead>
                <TableHead className="text-right">p95 ms</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.length === 0 && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">No events in range</TableCell></TableRow>
              )}
              {kpis.map(k => (
                <TableRow key={k.channel}>
                  <TableCell className="font-medium uppercase">{k.channel}</TableCell>
                  <TableCell className="text-right">{k.total}</TableCell>
                  <TableCell className="text-right">{k.sent}</TableCell>
                  <TableCell className="text-right">{k.delivered}</TableCell>
                  <TableCell className="text-right text-destructive">{k.failed}</TableCell>
                  <TableCell className="text-right">{k.bounced}</TableCell>
                  <TableCell className="text-right">{k.rate_limited}</TableCell>
                  <TableCell className="text-right">{k.success_rate ?? "—"}</TableCell>
                  <TableCell className="text-right">{k.p50_latency_ms != null ? Math.round(k.p50_latency_ms) : "—"}</TableCell>
                  <TableCell className="text-right">{k.p95_latency_ms != null ? Math.round(k.p95_latency_ms) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent events (100)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No recent events</TableCell></TableRow>
              )}
              {recent.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                  <TableCell className="uppercase">{e.channel}</TableCell>
                  <TableCell>
                    <Badge variant={
                      e.status === "delivered" || e.status === "sent" ? "default"
                      : e.status === "failed" || e.status === "bounced" ? "destructive"
                      : "secondary"
                    }>
                      {e.status === "delivered" || e.status === "sent"
                        ? <CheckCircle2 className="mr-1 h-3 w-3" />
                        : (e.status === "failed" || e.status === "bounced") && <AlertTriangle className="mr-1 h-3 w-3" />}
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{e.provider ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.template_name ?? "—"}</TableCell>
                  <TableCell>{e.latency_ms != null ? `${e.latency_ms} ms` : "—"}</TableCell>
                  <TableCell className="text-xs text-destructive">{e.error_message ?? e.error_code ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
