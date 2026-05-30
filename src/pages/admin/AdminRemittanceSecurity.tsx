// Admin · Remittance security audit console.
// Reviews allowed and denied requests across all RaaS endpoints with filters
// by endpoint, decision, user, and time window. Reads from `security_audit_logs`
// scoped to `event_category = 'remittance'`.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

type Row = {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  risk_score: number | null;
  blocked: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
};

const DECISION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  allowed: "default",
  denied_unauthenticated: "destructive",
  denied_unauthorized: "destructive",
  denied_validation: "secondary",
  denied_idempotency: "outline",
  denied_provider: "secondary",
  system_error: "destructive",
};

export default function AdminRemittanceSecurity() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [endpoint, setEndpoint] = useState<string>("all");
  const [decision, setDecision] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("security_audit_logs")
      .select("id, user_id, event_type, ip_address, user_agent, risk_score, blocked, metadata, created_at")
      .eq("event_category", "remittance")
      .order("created_at", { ascending: false })
      .limit(200);
    if (endpoint !== "all") q = q.ilike("event_type", `remittance.${endpoint}%`);
    const { data } = await q;
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [endpoint]);

  const filtered = useMemo(() => rows.filter((r) => {
    const d = r.metadata?.decision ?? (r.blocked ? "denied" : "allowed");
    if (decision !== "all" && d !== decision) return false;
    if (search) {
      const s = search.toLowerCase();
      const blob = `${r.user_id ?? ""} ${r.ip_address ?? ""} ${r.event_type} ${JSON.stringify(r.metadata ?? {})}`.toLowerCase();
      if (!blob.includes(s)) return false;
    }
    return true;
  }), [rows, decision, search]);

  const stats = useMemo(() => {
    const allowed = filtered.filter((r) => !r.blocked).length;
    const denied = filtered.filter((r) => r.blocked).length;
    return { allowed, denied, total: filtered.length };
  }, [filtered]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <SEO title="Remittance security audit" description="Allowed and denied RaaS requests" />
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Remittance security audit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Who, what, and when — every touch on a remittance endpoint.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Allowed</CardDescription><CardTitle className="text-2xl flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> {stats.allowed}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Denied</CardDescription><CardTitle className="text-2xl flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" /> {stats.denied}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total events</CardDescription><CardTitle className="text-2xl">{stats.total}</CardTitle></CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Select value={endpoint} onValueChange={setEndpoint}>
            <SelectTrigger className="w-full md:w-64"><SelectValue placeholder="Endpoint" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All endpoints</SelectItem>
              <SelectItem value="remittance-outbound">Outbound (send/quote/track)</SelectItem>
              <SelectItem value="remittance-fulfill">Fulfill (payout)</SelectItem>
              <SelectItem value="remittance-routing-engine">Routing engine</SelectItem>
              <SelectItem value="remittance-recon-cron">Reconciliation cron</SelectItem>
              <SelectItem value="remittance-payin-intent">Pay-in intent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={decision} onValueChange={setDecision}>
            <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="Decision" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All decisions</SelectItem>
              <SelectItem value="allowed">Allowed</SelectItem>
              <SelectItem value="denied_unauthenticated">Denied — unauthenticated</SelectItem>
              <SelectItem value="denied_unauthorized">Denied — unauthorized</SelectItem>
              <SelectItem value="denied_validation">Denied — validation</SelectItem>
              <SelectItem value="denied_idempotency">Denied — idempotency</SelectItem>
              <SelectItem value="denied_provider">Denied — provider</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Search user id, IP, or remittance id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:flex-1"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest 200 events — most recent first</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Remittance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const d = (r.metadata?.decision ?? (r.blocked ? "denied" : "allowed")) as string;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{format(new Date(r.created_at), "MMM d, HH:mm:ss")}</TableCell>
                        <TableCell className="text-xs">{r.event_type}</TableCell>
                        <TableCell>
                          <Badge variant={DECISION_VARIANT[d] ?? "outline"}>{d}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.user_id?.slice(0, 8) ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.ip_address ?? "—"}</TableCell>
                        <TableCell>{r.risk_score ?? 0}</TableCell>
                        <TableCell className="font-mono text-xs">{(r.metadata?.remittance_id as string | undefined)?.slice(0, 8) ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No events match these filters.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
