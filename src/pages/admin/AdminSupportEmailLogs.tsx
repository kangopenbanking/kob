import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Mail, CheckCircle2, AlertCircle, Clock, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type LogRow = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const SUPPORT_TEMPLATES = [
  "support-agent-invite",
  "support-new-chat-agent",
  "support-sla-supervisor",
  "chat-assigned",
];

const STATUS_TONE: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  dlq: "bg-rose-50 text-rose-700 border-rose-200",
  bounced: "bg-rose-50 text-rose-700 border-rose-200",
  complained: "bg-rose-50 text-rose-700 border-rose-200",
  suppressed: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function AdminSupportEmailLogs() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"24h" | "7d" | "30d">("7d");

  const since = useMemo(() => {
    const ms = range === "24h" ? 24 * 3600e3 : range === "7d" ? 7 * 86400e3 : 30 * 86400e3;
    return new Date(Date.now() - ms).toISOString();
  }, [range]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_send_log" as any)
        .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at")
        .in("template_name", SUPPORT_TEMPLATES)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Dedupe by message_id, keep latest
      const seen = new Set<string>();
      const dedup: LogRow[] = [];
      for (const r of (data as any[]) || []) {
        const key = r.message_id || r.id;
        if (seen.has(key)) continue;
        seen.add(key);
        dedup.push(r);
      }
      setRows(dedup);
    } catch (e: any) {
      toast({ title: "Failed to load email logs", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since]);

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
    if (search && !(r.recipient_email || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = useMemo(() => {
    const total = filtered.length;
    const sent = filtered.filter((r) => r.status === "sent").length;
    const failed = filtered.filter((r) => ["failed", "dlq", "bounced", "complained"].includes(r.status)).length;
    const pending = filtered.filter((r) => r.status === "pending").length;
    return { total, sent, failed, pending };
  }, [filtered]);

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link to="/admin/support-chat" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to support workspace
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Support email delivery</h1>
          <p className="text-sm text-muted-foreground">
            Delivery status for agent invitations, new-chat alerts, and SLA escalation emails sent through Lovable Cloud.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Mail className="h-4 w-4" />} label="Total" value={stats.total} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Delivered" value={stats.sent} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="In queue" value={stats.pending} />
        <StatCard icon={<AlertCircle className="h-4 w-4" />} label="Failed" value={stats.failed} tone={stats.failed > 0 ? "danger" : undefined} />
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Filter className="h-4 w-4 text-muted-foreground" /> Recent sends
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All support templates</SelectItem>
                {SUPPORT_TEMPLATES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="dlq">DLQ</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search recipient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">No support emails found in this period.</TableCell></TableRow>
              )}
              {!loading && filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.template_name}</TableCell>
                  <TableCell className="text-sm">{r.recipient_email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_TONE[r.status] || ""}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                    {r.error_message || (r.status === "sent" ? "Delivered to provider" : "—")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "danger" }) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-rose-600" : "text-foreground"}`}>{value}</p>
        </div>
        <div className="rounded-md border border-border/60 p-2 text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}
