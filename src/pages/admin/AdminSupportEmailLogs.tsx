import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Mail, CheckCircle2, AlertCircle, Clock, Filter, ShieldCheck, ShieldAlert, Globe2 } from "lucide-react";
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
  attempt_count?: number | null;
  last_attempt_at?: string | null;
  next_retry_at?: string | null;
  provider_event?: string | null;
  provider_event_at?: string | null;
};

type DnsCheck = { ok: boolean; value?: string | null; records?: string[] };
type DomainStatus = {
  domain: string;
  checked_at: string;
  ns: DnsCheck;
  mx: DnsCheck;
  spf: DnsCheck;
  dmarc: DnsCheck;
  dkim: DnsCheck & { selector?: string };
  overall_ok: boolean;
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
  const [domain, setDomain] = useState<DomainStatus | null>(null);
  const [domainLoading, setDomainLoading] = useState(false);

  const since = useMemo(() => {
    const ms = range === "24h" ? 24 * 3600e3 : range === "7d" ? 7 * 86400e3 : 30 * 86400e3;
    return new Date(Date.now() - ms).toISOString();
  }, [range]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_send_log" as any)
        .select("id, message_id, template_name, recipient_email, status, error_message, metadata, created_at, attempt_count, last_attempt_at, next_retry_at, provider_event, provider_event_at")
        .in("template_name", SUPPORT_TEMPLATES)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
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

  const loadDomain = async () => {
    setDomainLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-email-domain-status");
      if (error) throw error;
      setDomain(data as DomainStatus);
    } catch (e: any) {
      toast({ title: "Failed to read sender domain status", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setDomainLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since]);

  useEffect(() => {
    loadDomain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const retried = filtered.filter((r) => (r.attempt_count || 1) > 1).length;
    return { total, sent, failed, pending, retried };
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
            Delivery status, retry queue and webhook events for agent invitations, new-chat alerts and SLA escalation emails.
          </p>
        </div>
        <Button variant="outline" onClick={() => { load(); loadDomain(); }} disabled={loading || domainLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${(loading || domainLoading) ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Sender domain deliverability */}
      <Card className="mb-6 border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Globe2 className="h-4 w-4 text-muted-foreground" />
            Sender domain · {domain?.domain || "notify.info.kangopenbanking.com"}
            {domain && (
              <Badge variant="outline" className={domain.overall_ok ? "ml-2 bg-emerald-50 text-emerald-700 border-emerald-200" : "ml-2 bg-amber-50 text-amber-700 border-amber-200"}>
                {domain.overall_ok ? "All checks passing" : "Action recommended"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 md:grid-cols-4">
          <DnsRow label="MX" check={domain?.mx} loading={domainLoading} />
          <DnsRow label="SPF" check={domain?.spf} loading={domainLoading} />
          <DnsRow label="DKIM (lovable._domainkey)" check={domain?.dkim} loading={domainLoading} />
          <DnsRow label="DMARC (_dmarc)" check={domain?.dmarc} loading={domainLoading} />
          <div className="md:col-span-4 text-xs text-muted-foreground">
            {domain
              ? <>Last checked {new Date(domain.checked_at).toLocaleString()}. Records served via Cloudflare DoH.</>
              : "Checking deliverability records…"}
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard icon={<Mail className="h-4 w-4" />} label="Total" value={stats.total} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Delivered" value={stats.sent} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="In queue" value={stats.pending} />
        <StatCard icon={<RefreshCw className="h-4 w-4" />} label="Retried" value={stats.retried} />
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
                <SelectItem value="complained">Complained</SelectItem>
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
                <TableHead>Attempts</TableHead>
                <TableHead>Provider event</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">Loading…</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">No support emails found in this period.</TableCell></TableRow>
              )}
              {!loading && filtered.map((r) => {
                const attempts = r.attempt_count ?? 1;
                const nextAt = r.next_retry_at ? new Date(r.next_retry_at) : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.template_name}</TableCell>
                    <TableCell className="text-sm">{r.recipient_email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_TONE[r.status] || ""}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className={attempts > 1 ? "font-medium text-amber-700" : "text-muted-foreground"}>
                        {attempts}
                      </span>
                      {nextAt && nextAt.getTime() > Date.now() && (
                        <div className="text-[11px] text-muted-foreground">retry {nextAt.toLocaleTimeString()}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.provider_event
                        ? <Badge variant="outline" className="border-border/60">{r.provider_event}</Badge>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                      {r.error_message || (r.status === "sent" ? "Delivered to provider" : "—")}
                    </TableCell>
                  </TableRow>
                );
              })}
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

function DnsRow({ label, check, loading }: { label: string; check?: DnsCheck; loading: boolean }) {
  const ok = !!check?.ok;
  return (
    <div className="rounded-md border border-border/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {loading
          ? <Badge variant="outline" className="bg-muted text-muted-foreground">Checking…</Badge>
          : ok
            ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><ShieldCheck className="mr-1 h-3 w-3" /> OK</Badge>
            : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><ShieldAlert className="mr-1 h-3 w-3" /> Missing</Badge>}
      </div>
      <p className="mt-2 break-all text-[11px] leading-snug text-muted-foreground">
        {check?.value || check?.records?.[0] || (loading ? " " : "No record found")}
      </p>
    </div>
  );
}
