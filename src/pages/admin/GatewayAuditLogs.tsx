import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Activity, AlertTriangle, Clock, Users } from "lucide-react";

interface AuditRow {
  id: string;
  request_id: string | null;
  client_id: string | null;
  key_version: number | null;
  method: string;
  path: string;
  status: number;
  latency_ms: number;
  ip: string | null;
  country: string | null;
  created_at: string;
}

interface AuditResponse {
  days: number;
  total: number;
  avg_latency_ms: number;
  by_status: Record<string, number>;
  by_client: Record<string, number>;
  rows: AuditRow[];
}

export default function GatewayAuditLogs() {
  const [days, setDays] = useState(7);
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: String(days), limit: "1000" });
      if (clientFilter) params.set("client_id", clientFilter);
      if (statusFilter) params.set("status", statusFilter);
      const { data: res, error } = await supabase.functions.invoke(
        `admin-gateway-audit?${params.toString()}`,
        { method: "GET" },
      );
      if (error) throw error;
      setData(res as AuditResponse);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const statusBadge = (s: number) => {
    if (s >= 500) return <Badge variant="destructive">{s}</Badge>;
    if (s === 429) return <Badge variant="destructive">429</Badge>;
    if (s >= 400) return <Badge variant="outline">{s}</Badge>;
    return <Badge variant="secondary">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Gateway Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Authenticated requests routed through api.kangopenbanking.com — last {days} days.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4"/>Total Requests</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data?.total ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4"/>Avg Latency</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{data?.avg_latency_ms ?? 0} ms</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>4xx / 5xx</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {Object.entries(data?.by_status ?? {})
                .filter(([k]) => parseInt(k) >= 400)
                .reduce((acc, [, v]) => acc + v, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4"/>Unique Clients</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-semibold">{Object.keys(data?.by_client ?? {}).length}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Window</label>
            <div className="flex gap-2">
              {[7, 14, 30].map((d) => (
                <Button key={d} variant={days === d ? "default" : "outline"} size="sm" onClick={() => setDays(d)}>
                  {d} days
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Client ID</label>
            <Input value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} placeholder="kob_client_..." className="w-64"/>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Input value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="200, 401, 429..." className="w-32"/>
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Apply"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card><CardContent className="pt-6 text-destructive">{error}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Requests</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Request ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs font-mono">{r.client_id ?? "—"}{r.key_version ? ` v${r.key_version}` : ""}</TableCell>
                  <TableCell className="text-xs"><Badge variant="outline">{r.method}</Badge></TableCell>
                  <TableCell className="text-xs font-mono max-w-xs truncate">{r.path}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-xs">{r.latency_ms} ms</TableCell>
                  <TableCell className="text-xs">{r.country ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono max-w-[140px] truncate">{r.request_id ?? "—"}</TableCell>
                </TableRow>
              ))}
              {!loading && (data?.rows ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No requests in this window.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
