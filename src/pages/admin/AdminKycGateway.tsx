/**
 * Admin KYC Gateway Console
 *
 * Operator-facing view for the Unified KYC Gateway (Youverify primary,
 * self-hosted fallback). Admin-only — gated by ProtectedRoute requiredRole="admin".
 *
 *  - Toggle feature flags / rollout %, country allowlist
 *  - Configure circuit breaker thresholds (failure count, min samples, window, cooldown)
 *  - Inspect current breaker state + reset
 *  - Read recent audit rows (trace_id, provider, fallback reason, latency)
 *  - Provider metrics with auto-refresh polling
 *  - Export audit logs to CSV / JSON with filters
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, RefreshCw, Activity, AlertTriangle, Download, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  failure_threshold: number;
  min_samples: number;
  window_seconds: number;
  cooldown_seconds: number;
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

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminKycGateway() {
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [breaker, setBreaker] = useState<BreakerRow | null>(null);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [metrics, setMetrics] = useState<MetricsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Export filters
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const [exportCountry, setExportCountry] = useState("");
  const [exportProvider, setExportProvider] = useState<"" | "youverify" | "self_hosted">("");
  const [exportFrom, setExportFrom] = useState(sevenDaysAgo);
  const [exportTo, setExportTo] = useState(today);
  const [exporting, setExporting] = useState(false);

  // Breaker config draft
  const [bkThreshold, setBkThreshold] = useState<number>(5);
  const [bkSamples, setBkSamples] = useState<number>(10);
  const [bkWindow, setBkWindow] = useState<number>(30);
  const [bkCooldown, setBkCooldown] = useState<number>(60);
  const [savingBreaker, setSavingBreaker] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    const [flagRes, brRes, auRes, mRes] = await Promise.all([
      supabase.from("kyc_feature_flags").select("*").order("flag_key"),
      supabase.from("kyc_circuit_breaker_state").select("*").eq("provider", "youverify").maybeSingle(),
      supabase.from("kyc_verification_audit").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.functions.invoke("kyc-metrics", { method: "GET" as never }),
    ]);
    setFlags((flagRes.data as FlagRow[]) ?? []);
    const br = (brRes.data as BreakerRow) ?? null;
    setBreaker(br);
    if (br) {
      setBkThreshold(br.failure_threshold);
      setBkSamples(br.min_samples);
      setBkWindow(br.window_seconds);
      setBkCooldown(br.cooldown_seconds);
    }
    setAudits((auRes.data as AuditRow[]) ?? []);
    if (mRes.data) setMetrics(mRes.data as MetricsResp);
    if (showSpinner) setLoading(false);
  }, []);

  useEffect(() => { void load(true); }, [load]);

  // Auto-refresh polling — every 15s, only when tab is visible
  const intervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoRefresh) return;
    const tick = () => { if (document.visibilityState === "visible") void load(false); };
    intervalRef.current = window.setInterval(tick, 15_000);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

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
    void load(false);
  };

  const resetBreaker = async () => {
    const { error } = await supabase
      .from("kyc_circuit_breaker_state")
      .update({ state: "closed", failure_count: 0, opened_at: null })
      .eq("provider", "youverify");
    if (error) { toast.error(error.message); return; }
    toast.success("Circuit breaker reset to closed");
    void load(false);
  };

  const saveBreakerConfig = async () => {
    // Bounds match the migration CHECK constraints
    if (bkThreshold < 1 || bkThreshold > 1000) return toast.error("Failure threshold must be 1-1000");
    if (bkSamples < 1 || bkSamples > 10000) return toast.error("Min samples must be 1-10000");
    if (bkWindow < 5 || bkWindow > 3600) return toast.error("Window must be 5-3600 seconds");
    if (bkCooldown < 5 || bkCooldown > 86400) return toast.error("Cooldown must be 5-86400 seconds");
    setSavingBreaker(true);
    const { error } = await supabase
      .from("kyc_circuit_breaker_state")
      .update({
        failure_threshold: bkThreshold,
        min_samples: bkSamples,
        window_seconds: bkWindow,
        cooldown_seconds: bkCooldown,
      })
      .eq("provider", "youverify");
    setSavingBreaker(false);
    if (error) { toast.error(`Failed to save thresholds: ${error.message}`); return; }
    toast.success("Circuit breaker thresholds saved");
    void load(false);
  };

  const exportAudits = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      let q = supabase
        .from("kyc_verification_audit")
        .select("*")
        .gte("created_at", `${exportFrom}T00:00:00Z`)
        .lte("created_at", `${exportTo}T23:59:59Z`)
        .order("created_at", { ascending: false })
        .limit(50000);
      if (exportProvider) q = q.eq("provider_used", exportProvider);
      if (exportCountry) q = q.eq("country", exportCountry.toUpperCase());
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      if (!rows.length) { toast.message("No rows match the filter."); return; }
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      if (format === "json") {
        downloadBlob(JSON.stringify(rows, null, 2), "application/json", `kyc-audit-${ts}.json`);
      } else {
        downloadBlob(toCsv(rows), "text/csv", `kyc-audit-${ts}.csv`);
      }
      toast.success(`Exported ${rows.length} rows`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
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
        description="Toggle Youverify rollout, configure circuit breaker, monitor traffic, and export audit logs."
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
            <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground">
              Auto-refresh {autoRefresh ? "(15s)" : "off"}
            </Label>
          </div>
          <Button variant="secondary" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
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

      {/* Circuit breaker configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Circuit breaker — Youverify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="bk-threshold">Failure threshold</Label>
              <Input id="bk-threshold" type="number" min={1} max={1000}
                value={bkThreshold} onChange={(e) => setBkThreshold(parseInt(e.target.value || "0", 10))} />
              <p className="text-xs text-muted-foreground">Failures before opening</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bk-samples">Min samples</Label>
              <Input id="bk-samples" type="number" min={1} max={10000}
                value={bkSamples} onChange={(e) => setBkSamples(parseInt(e.target.value || "0", 10))} />
              <p className="text-xs text-muted-foreground">Required before evaluating</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bk-window">Window (s)</Label>
              <Input id="bk-window" type="number" min={5} max={3600}
                value={bkWindow} onChange={(e) => setBkWindow(parseInt(e.target.value || "0", 10))} />
              <p className="text-xs text-muted-foreground">Rolling failure window</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bk-cooldown">Cooldown (s)</Label>
              <Input id="bk-cooldown" type="number" min={5} max={86400}
                value={bkCooldown} onChange={(e) => setBkCooldown(parseInt(e.target.value || "0", 10))} />
              <p className="text-xs text-muted-foreground">Stay open before half-open probe</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Current: {breaker ? (
                <>state <strong>{breaker.state}</strong> · failures {breaker.failure_count}
                {breaker.opened_at && <> · opened at {new Date(breaker.opened_at).toLocaleString()}</>}
                </>
              ) : "—"}
            </div>
            <Button onClick={saveBreakerConfig} disabled={savingBreaker}>
              <Save className="h-4 w-4 mr-2" />
              {savingBreaker ? "Saving…" : "Save thresholds"}
            </Button>
          </div>
        </CardContent>
      </Card>

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

      {/* Export audits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Export audit logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Country (ISO-2)</Label>
              <Input placeholder="e.g. CM" value={exportCountry}
                onChange={(e) => setExportCountry(e.target.value.toUpperCase())} maxLength={2} />
            </div>
            <div className="space-y-1">
              <Label>Provider</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={exportProvider}
                onChange={(e) => setExportProvider(e.target.value as "" | "youverify" | "self_hosted")}
              >
                <option value="">Any</option>
                <option value="youverify">youverify</option>
                <option value="self_hosted">self_hosted</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="secondary" disabled={exporting} onClick={() => void exportAudits("csv")}>
                CSV
              </Button>
              <Button variant="secondary" disabled={exporting} onClick={() => void exportAudits("json")}>
                JSON
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Up to 50,000 rows per export. RLS restricts visibility to admins.
          </p>
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
