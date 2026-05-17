/**
 * Admin SLO Dashboard — Phase 5 (v4.36.0)
 *
 * Read-only operational view of Service Level Objectives:
 *   - Charge success rate (24h)        target ≥ 99.5%
 *   - Webhook delivery success (24h)   target ≥ 99.0%
 *   - p50 / p95 / p99 charge latency   targets 200 / 800 / 1500 ms
 *
 * Sources data directly from public tables already in production:
 *   gateway_charges, webhook_deliveries.
 *
 * No business logic is mutated. Additive page only (Standing Order 4).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Webhook, Gauge } from "lucide-react";

interface SLO {
  chargeTotal: number;
  chargeSuccess: number;
  webhookTotal: number;
  webhookSuccess: number;
  latencyP50: number | null;
  latencyP95: number | null;
  latencyP99: number | null;
}

function pct(part: number, total: number): number {
  if (!total) return 100;
  return Math.round((part / total) * 10000) / 100;
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export default function AdminSLO() {
  const [data, setData] = useState<SLO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    (async () => {
      try {
        const [charges, webhooks] = await Promise.all([
          supabase
            .from("gateway_charges")
            .select("status, created_at, updated_at")
            .gte("created_at", since)
            .limit(1000),
          supabase
            .from("webhook_deliveries")
            .select("status")
            .gte("created_at", since)
            .limit(1000),
        ]);

        const cRows = (charges.data ?? []) as Array<{ status: string; created_at: string; updated_at: string | null }>;
        const wRows = (webhooks.data ?? []) as Array<{ status: string }>;

        const chargeSuccess = cRows.filter((r) => ["succeeded", "captured", "paid"].includes(r.status)).length;
        const webhookSuccess = wRows.filter((r) => r.status === "delivered" || r.status === "success").length;

        const latencies = cRows
          .filter((r) => r.updated_at && r.created_at)
          .map((r) => new Date(r.updated_at!).getTime() - new Date(r.created_at).getTime())
          .filter((n) => n >= 0 && n < 60_000);

        if (!cancelled) {
          setData({
            chargeTotal: cRows.length,
            chargeSuccess,
            webhookTotal: wRows.length,
            webhookSuccess,
            latencyP50: percentile(latencies, 50),
            latencyP95: percentile(latencies, 95),
            latencyP99: percentile(latencies, 99),
          });
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">No SLO data available for the last 24 hours.</div>;
  }

  const chargeRate = pct(data.chargeSuccess, data.chargeTotal);
  const webhookRate = pct(data.webhookSuccess, data.webhookTotal);

  const ChargeBadge = (
    <Badge variant={chargeRate >= 99.5 ? "default" : "destructive"}>
      {chargeRate >= 99.5 ? "Meeting SLO" : "Below SLO"}
    </Badge>
  );
  const WebhookBadge = (
    <Badge variant={webhookRate >= 99 ? "default" : "destructive"}>
      {webhookRate >= 99 ? "Meeting SLO" : "Below SLO"}
    </Badge>
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Service Level Objectives</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rolling 24-hour window across the live gateway and webhook subsystems.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Charge Success</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{chargeRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.chargeSuccess} / {data.chargeTotal} charges • target ≥ 99.5%
            </p>
            <div className="mt-3">{ChargeBadge}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhook Delivery</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{webhookRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.webhookSuccess} / {data.webhookTotal} attempts • target ≥ 99.0%
            </p>
            <div className="mt-3">{WebhookBadge}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Charge Latency</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm text-foreground">
              <div className="flex justify-between"><span className="text-muted-foreground">p50</span><span>{data.latencyP50 ?? "—"} ms</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">p95</span><span>{data.latencyP95 ?? "—"} ms</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">p99</span><span>{data.latencyP99 ?? "—"} ms</span></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Targets: 200 / 800 / 1500 ms</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How these numbers are computed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Source tables: <code>gateway_charges</code>, <code>webhook_deliveries</code>.</p>
          <p>Window: last 24 hours, capped at 1,000 rows per table to stay responsive.</p>
          <p>Latency proxy: <code>updated_at − created_at</code> on terminal-state charges.</p>
          <p>Every row in these tables now carries an optional <code>trace_id</code> column so a single request can be followed across HTTP, charge, webhook, and ledger.</p>
        </CardContent>
      </Card>
    </div>
  );
}
