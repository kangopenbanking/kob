/**
 * Admin audit log explorer focused on KYC/KYB hardening signals:
 * step-up denials, manual-review fallbacks, and Youverify webhook
 * correlation outcomes. Supports ID-based search across the JSON
 * details payload so a reviewer can trace one verification or
 * institution end-to-end.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Download, ShieldAlert, AlertTriangle, Webhook, RefreshCw } from "lucide-react";

const QUICK_FILTERS = [
  { key: "all", label: "All", icon: null, match: () => true as boolean, pattern: null as string | null },
  { key: "step_up_denied", label: "Step-up denied", icon: ShieldAlert, match: (t: string) => t.endsWith(".step_up_denied"), pattern: "step_up_denied" },
  { key: "manual_review", label: "Manual review", icon: AlertTriangle, match: (t: string) => t.includes("manual_review") || t.includes("unmapped_status"), pattern: "manual_review|unmapped_status" },
  { key: "webhook", label: "Webhook correlation", icon: Webhook, match: (t: string) => t.startsWith("youverify_webhook.") || t.includes("webhook_correlation") || t.includes("persist_yv_session"), pattern: "youverify_webhook|webhook_correlation|persist_yv_session" },
] as const;

type QuickKey = (typeof QUICK_FILTERS)[number]["key"];
type RangeKey = "1d" | "7d" | "30d";

const RANGES: Record<RangeKey, number> = { "1d": 1, "7d": 7, "30d": 30 };

export default function AuditLogExplorer() {
  const [quick, setQuick] = useState<QuickKey>("all");
  const [range, setRange] = useState<RangeKey>("7d");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - RANGES[range]);
    return d.toISOString();
  }, [range]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit-log-explorer", quick, range],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, action_type, entity_type, entity_id, performed_by, details, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      const filter = QUICK_FILTERS.find((f) => f.key === quick);
      if (filter?.pattern) {
        const ors = filter.pattern.split("|").map((p) => `action_type.ilike.%${p}%`).join(",");
        q = q.or(ors);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    if (!search.trim()) return rows;
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      const blob = JSON.stringify({
        entity_id: r.entity_id,
        details: r.details,
      }).toLowerCase();
      return blob.includes(needle);
    });
  }, [data, search]);

  const exportCsv = () => {
    const header = "created_at,action_type,entity_type,entity_id,performed_by,details\n";
    const rows = filtered
      .map((r) =>
        [
          r.created_at,
          r.action_type,
          r.entity_type,
          r.entity_id ?? "",
          r.performed_by ?? "",
          JSON.stringify(r.details ?? {}).replace(/"/g, '""'),
        ]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${quick}-${range}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const badgeFor = (action: string) => {
    if (action.endsWith(".step_up_denied")) return <Badge variant="destructive">step-up denied</Badge>;
    if (action.includes("manual_review") || action.includes("unmapped_status")) return <Badge className="bg-amber-500 text-white hover:bg-amber-600">manual review</Badge>;
    if (action.startsWith("youverify_webhook.")) return <Badge variant="secondary">webhook</Badge>;
    if (action.includes("persist_yv_session")) return <Badge variant="outline">persist</Badge>;
    return <Badge variant="outline">{action.split(".").slice(-1)[0]}</Badge>;
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit Log Explorer</h1>
          <p className="text-sm text-muted-foreground">Step-up denials, manual-review fallbacks, and webhook correlation traces.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="audit-export-csv">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((f) => {
              const Icon = f.icon;
              const active = quick === f.key;
              return (
                <Button
                  key={f.key}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => setQuick(f.key)}
                  data-testid={`audit-filter-${f.key}`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
                  {f.label}
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search institution/verification/session id or any details field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="audit-search"
              />
            </div>
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">{filtered.length} events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No events match these filters.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id} data-audit-row={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{badgeFor(r.action_type)} <span className="ml-2 text-xs text-muted-foreground">{r.action_type}</span></TableCell>
                  <TableCell className="text-xs">{r.entity_type}</TableCell>
                  <TableCell className="font-mono text-xs">{r.entity_id?.slice(0, 12) ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(r.details as any)?.reason ?? (r.details as any)?.outcome ?? ""}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.action_type}</DialogTitle>
          </DialogHeader>
          <pre className="bg-muted rounded-md p-3 text-xs overflow-auto max-h-[60vh]">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
