/**
 * Admin KYC Gateway Console
 *
 * Operator-facing view for the Unified KYC Gateway (Youverify primary,
 * self-hosted fallback). Lets admins:
 *   - Toggle feature flags and adjust rollout percentages / country allowlists
 *   - Inspect the current circuit breaker state
 *   - Read recent audit rows (trace_id, provider, fallback reason, latency)
 *   - View provider metrics (latency, fallback rate, error breakdowns)
 *
 * All mutations go through the standard supabase client and are gated by the
 * existing RLS policies (admin-only via public.has_role).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, RefreshCw, Activity, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface FlagRow {
  id: string;
  flag_key: string;
  is_enabled: boolean;
  rollout_percentage: number;
  country_codes: string[];
  description: string | null;
  updated_at: string;
}

interface BreakerRow {
  provider: string;
  state: "closed" | "open" | "half_open";
  failure_count: number;
  opened_at: string | null;
  last_failure_at: string | null;
  updated_at: string;
}

interface AuditRow {
  id: string;
  trace_id: string;
  verification_type: string;
  provider_used: string;
  fallback_triggered: boolean;
  fallback_reason: string | null;
  verification_result: string | null;
  country: string | null;
  youverify_response_time_ms: number | null;
  self_hosted_response_time_ms: number | null;
  error_code: string | null;
  created_at: string;
}

interface MetricsResp {
  totals: {
    total_requests: number;
    youverify_success_rate: number | null;
    fallback_rate: number;
    youverify_failures: number;
  };
  latency_ms: {
    youverify: { p50: number | null; p95: number | null };
    self_hosted: { p50: number | null; p95: number | null };
  };
  fallback_reasons: Record<string, number>;
  youverify_errors_by_country: Record<string, Record<string, number>>;
  circuit_breaker: BreakerRow | { state: string };
}

function breakerBadge(state: string) {
  const variant =
    state === "closed" ? "default" : state === "half_open" ? "secondary" : "destructive";
  return <Badge variant={variant as never}>{state}</Badge>;
}

export default function AdminKycGateway() {
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [breaker, setBreaker] = useState<BreakerRow | null>(null);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [metrics, setMetrics] = useState<MetricsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [flagRes, brRes, auRes, mRes] = await Promise.all([
      supabase.from("kyc_feature_flags").select("*").order("flag_key"),
      supabase.from("kyc_circuit_breaker_state").select("*").eq("provider", "youverify").maybeSingle(),
      supabase.from("kyc_verification_audit").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.functions.invoke("kyc-metrics", { method: "GET" as never }),
    ]);
    setFlags((flagRes.data as FlagRow[]) ?? []);
    setBreaker((brRes.data as BreakerRow) ?? null);
    setAudits((auRes.data as AuditRow[]) ?? []);
    if (mRes.data) setMetrics(mRes.data as MetricsResp);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateFlag = async (row: FlagRow, patch: Partial<FlagRow>) => {
    setSavingKey(row.flag_key);
    const { error } = await supabase
      .from("kyc_feature_flags")
      .update({
        is_enabled: patch.is_enabled ?? row.is_enabled,
        rollout_percentage: patch.rollout_percentage ?? row.rollout_percentage,
        country_codes: patch.country_codes ?? row.country_codes,
      })
      .eq("id", row.id);
    setSavingKey(null);
    if (error) { toast.error(`Failed to update ${row.flag_key}: ${error.message}`); return; }
    toast.success(`${row.flag_key} updated`);
    void load();
  };

  const resetBreaker = async () => {
    const { error } = await supabase
      .from("kyc_circuit_breaker_state")
      .update({ state: "closed", failure_count: 0, opened_at: null })
      .eq("provider", "youverify");
    if (error) { toast.error(error.message); return; }
    toast.success("Circuit breaker reset to closed");
    void load();
  };

  const fallbackPills = useMemo(() => {
    if (!metrics) return [] as Array<[string, number]>;
    return Object.entries(metrics.fallback_reasons).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [metrics]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <AdminPageHeader
        icon={ShieldCheck}
        title="KYC Gateway"
        description="Toggle Youverify rollout, monitor circuit breaker, and review audit logs."
      >
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </AdminPageHeader>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Requests (last 60m)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{metrics?.totals.total_requests ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Youverify success</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">
            {metrics?.totals.youverify_success_rate != null ? `${metrics.totals.youverify_success_rate}%` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Fallback rate</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{metrics ? `${metrics.totals.fallback_rate}%` : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Circuit breaker</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            {breakerBadge(breaker?.state ?? "unknown")}
            {breaker && breaker.state !== "closed" && (
              <Button size="sm" variant="outline" onClick={resetBreaker}>Reset</Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Latency + fallback reasons */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Latency (p50 / p95)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Youverify</span>
              <span>{metrics?.latency_ms.youverify.p50 ?? "—"} / {metrics?.latency_ms.youverify.p95 ?? "—"} ms</span>
            </div>
            <div className="flex justify-between"><span>Self-hosted</span>
              <span>{metrics?.latency_ms.self_hosted.p50 ?? "—"} / {metrics?.latency_ms.self_hosted.p95 ?? "—"} ms</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Top fallback reasons</CardTitle></CardHeader>
          <CardContent>
            {fallbackPills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fallbacks in window.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {fallbackPills.map(([k, v]) => (
                  <Badge key={k} variant="outline">{k}: {v}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature flags */}
      <Card>
        <CardHeader><CardTitle>Feature flags</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flag</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-32">Rollout %</TableHead>
                <TableHead>Countries</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((f) => (
                <FlagRowEditor key={f.id} row={f} saving={savingKey === f.flag_key} onSave={updateFlag} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Errors by country */}
      <Card>
        <CardHeader><CardTitle>Youverify errors by country (last 60m)</CardTitle></CardHeader>
        <CardContent>
          {!metrics || Object.keys(metrics.youverify_errors_by_country).length === 0 ? (
            <p className="text-sm text-muted-foreground">No errors recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Country</TableHead><TableHead>Error breakdown</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(metrics.youverify_errors_by_country).map(([country, errs]) => (
                  <TableRow key={country}>
                    <TableCell className="font-medium">{country}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(errs).map(([code, n]) => (
                          <Badge key={code} variant="outline">{code}: {n}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent audits */}
      <Card>
        <CardHeader><CardTitle>Recent verification audits</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Trace</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Latency (ms)</TableHead>
                <TableHead>Fallback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{new Date(a.created_at).toLocaleTimeString()}</TableCell>
                  <TableCell className="font-mono text-xs">{a.trace_id.slice(0, 8)}</TableCell>
                  <TableCell>{a.verification_type}</TableCell>
                  <TableCell>{a.country ?? "—"}</TableCell>
                  <TableCell><Badge variant={a.provider_used === "youverify" ? "default" : "secondary"}>{a.provider_used}</Badge></TableCell>
                  <TableCell>{a.verification_result ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {a.youverify_response_time_ms ?? "—"} / {a.self_hosted_response_time_ms ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{a.fallback_triggered ? (a.fallback_reason ?? "yes") : "no"}</TableCell>
                </TableRow>
              ))}
              {audits.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No audit rows yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FlagRowEditor({
  row, saving, onSave,
}: { row: FlagRow; saving: boolean; onSave: (r: FlagRow, p: Partial<FlagRow>) => void }) {
  const [pct, setPct] = useState(row.rollout_percentage);
  const [countries, setCountries] = useState(row.country_codes.join(","));
  useEffect(() => { setPct(row.rollout_percentage); setCountries(row.country_codes.join(",")); }, [row]);
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{row.flag_key}</div>
        {row.description && <div className="text-xs text-muted-foreground">{row.description}</div>}
      </TableCell>
      <TableCell>
        <Switch checked={row.is_enabled} onCheckedChange={(v) => onSave(row, { is_enabled: v })} />
      </TableCell>
      <TableCell>
        <Input type="number" min={0} max={100} value={pct}
          onChange={(e) => setPct(Math.max(0, Math.min(100, parseInt(e.target.value || "0", 10))))} />
      </TableCell>
      <TableCell>
        <Input value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="CM,GA,CG" />
      </TableCell>
      <TableCell>
        <Button size="sm" disabled={saving}
          onClick={() => onSave(row, {
            rollout_percentage: pct,
            country_codes: countries.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
          })}>
          Save
        </Button>
      </TableCell>
    </TableRow>
  );
}
