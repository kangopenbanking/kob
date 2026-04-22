import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, Mail, CheckCircle2, AlertCircle, Clock, Filter,
  ShieldCheck, ShieldAlert, Globe2, Activity, LayoutTemplate, BarChart3, Send,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type TemplatePreview = {
  name: string;
  displayName: string;
  subject: string;
  html: string;
};

type HealthReport = {
  overall_ok: boolean;
  checked_at: string;
  webhook: { ok: boolean; status?: number; error?: string; latency_ms?: number; audit_row_seen?: boolean; probe_id?: string };
  send: { ok: boolean; idempotencyKey?: string; error?: string; latency_ms?: number };
  last_sent: Record<string, string | null>;
  last_failed: Record<string, string | null>;
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

  const [previews, setPreviews] = useState<TemplatePreview[]>([]);
  const [previewsLoading, setPreviewsLoading] = useState(false);
  const [activePreview, setActivePreview] = useState<string>("support-agent-invite");

  const [health, setHealth] = useState<HealthReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [sendTestEmail, setSendTestEmail] = useState("");

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
        .limit(1000);
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

  const loadPreviews = async () => {
    setPreviewsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-email-preview");
      if (error) throw error;
      setPreviews((data as any)?.previews || []);
    } catch (e: any) {
      toast({ title: "Failed to render template previews", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setPreviewsLoading(false);
    }
  };

  const runHealthCheck = async (withSendTest: boolean) => {
    setHealthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-email-health", {
        body: { includeSendTest: withSendTest, sinkEmail: sendTestEmail || undefined },
      });
      if (error) throw error;
      setHealth(data as HealthReport);
      toast({
        title: (data as any)?.overall_ok ? "Email pipeline healthy" : "Issues detected",
        description: withSendTest ? "Webhook and send test executed." : "Webhook check executed.",
        variant: (data as any)?.overall_ok ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Health check failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => { load(); }, [since]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadDomain(); loadPreviews(); runHealthCheck(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Time-bucketed delivery analytics ------------------------------------
  const chartData = useMemo(() => {
    const buckets = range === "24h" ? 24 : range === "7d" ? 7 : 30;
    const bucketSize = range === "24h" ? 3600e3 : 86400e3;
    const start = Date.now() - buckets * bucketSize;
    const series: Record<string, { t: string; sent: number; delivered: number; bounced: number; complained: number; failed: number }> = {};
    for (let i = 0; i < buckets; i++) {
      const ts = new Date(start + i * bucketSize);
      const label = range === "24h"
        ? ts.toLocaleTimeString([], { hour: "2-digit" })
        : ts.toLocaleDateString([], { month: "short", day: "2-digit" });
      series[String(i)] = { t: label, sent: 0, delivered: 0, bounced: 0, complained: 0, failed: 0 };
    }
    for (const r of filtered) {
      const idx = Math.floor((new Date(r.created_at).getTime() - start) / bucketSize);
      if (idx < 0 || idx >= buckets) continue;
      const b = series[String(idx)];
      if (!b) continue;
      if (r.status === "sent") {
        b.sent++;
        // Treat any sent row that received a webhook 'delivered' event as delivered.
        if (r.provider_event === "delivered" || r.provider_event === undefined || r.provider_event === null) {
          b.delivered++;
        }
      } else if (r.status === "bounced") b.bounced++;
      else if (r.status === "complained") b.complained++;
      else if (r.status === "failed" || r.status === "dlq") b.failed++;
    }
    return Object.values(series);
  }, [filtered, range]);

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link to="/admin/support-chat" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to support workspace
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Support email delivery</h1>
          <p className="text-sm text-muted-foreground">
            Delivery status, template previews, analytics and pipeline health for the support email stack.
          </p>
        </div>
        <Button variant="outline" onClick={() => { load(); loadDomain(); }} disabled={loading || domainLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${(loading || domainLoading) ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Email health status card */}
      <Card className="mb-6 border-border/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Activity className="h-4 w-4 text-muted-foreground" /> Email pipeline health
            {health && (
              <Badge variant="outline" className={health.overall_ok ? "ml-2 bg-emerald-50 text-emerald-700 border-emerald-200" : "ml-2 bg-rose-50 text-rose-700 border-rose-200"}>
                {health.overall_ok ? "Healthy" : "Issues detected"}
              </Badge>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Optional: address for live send test"
              value={sendTestEmail}
              onChange={(e) => setSendTestEmail(e.target.value)}
              className="h-9 w-72"
            />
            <Button variant="outline" size="sm" className="h-9" onClick={() => runHealthCheck(false)} disabled={healthLoading}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${healthLoading ? "animate-spin" : ""}`} strokeWidth={1.5} /> Webhook check
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => runHealthCheck(true)} disabled={healthLoading || !sendTestEmail}>
              <Send className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} /> Run send test
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-4">
          <HealthTile
            label="Webhook reachability"
            ok={!!health?.webhook?.ok && !!health?.webhook?.audit_row_seen}
            primary={health ? `${health.webhook.status ?? "—"} · ${health.webhook.latency_ms ?? "—"}ms` : "Not checked yet"}
            secondary={health ? (health.webhook.audit_row_seen ? "Audit row recorded" : "No audit row found") : ""}
          />
          <HealthTile
            label="Send pipeline"
            ok={!!health?.send?.ok}
            primary={health?.send?.idempotencyKey ? `${health.send.latency_ms ?? "—"}ms` : "Not run"}
            secondary={health?.send?.error || (health?.send?.ok ? `key ${health.send.idempotencyKey}` : "Provide an address and run send test")}
          />
          <HealthTile
            label="Last successful send"
            ok={!!latest(health?.last_sent)}
            primary={fmt(latest(health?.last_sent))}
            secondary={recentLine(health?.last_sent)}
          />
          <HealthTile
            label="Last failure"
            ok={!latest(health?.last_failed)}
            tone={latest(health?.last_failed) ? "danger" : undefined}
            primary={fmt(latest(health?.last_failed))}
            secondary={recentLine(health?.last_failed) || "No failures in the last 7 days"}
          />
          <div className="md:col-span-2 lg:col-span-4 text-xs text-muted-foreground">
            {health
              ? <>Last checked {new Date(health.checked_at).toLocaleString()}.</>
              : "Health probe runs automatically on load."}
          </div>
        </CardContent>
      </Card>

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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="overview"><Mail className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} /> Overview</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} /> Analytics</TabsTrigger>
          <TabsTrigger value="templates"><LayoutTemplate className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} /> Templates</TabsTrigger>
        </TabsList>

        {/* OVERVIEW ----------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <StatCard icon={<Mail className="h-4 w-4" strokeWidth={1.5} />} label="Total" value={stats.total} />
            <StatCard icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />} label="Delivered" value={stats.sent} />
            <StatCard icon={<Clock className="h-4 w-4" strokeWidth={1.5} />} label="In queue" value={stats.pending} />
            <StatCard icon={<RefreshCw className="h-4 w-4" strokeWidth={1.5} />} label="Retried" value={stats.retried} />
            <StatCard icon={<AlertCircle className="h-4 w-4" strokeWidth={1.5} />} label="Failed" value={stats.failed} tone={stats.failed > 0 ? "danger" : undefined} />
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Filter className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> Recent sends
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
        </TabsContent>

        {/* ANALYTICS ---------------------------------------------------- */}
        <TabsContent value="analytics">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <BarChart3 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> Delivery over time
              </CardTitle>
              <Select value={range} onValueChange={(v) => setRange(v as any)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-5">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g-delivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="t" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="delivered" name="Delivered" stroke="hsl(var(--primary))" fill="url(#g-delivered)" strokeWidth={2} />
                    <Area type="monotone" dataKey="sent" name="Sent" stroke="#10b981" fill="transparent" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="bounced" name="Bounced" stroke="#f43f5e" fill="transparent" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="complained" name="Complained" stroke="#f59e0b" fill="transparent" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="failed" name="Failed" stroke="#64748b" fill="transparent" strokeWidth={1.5} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Delivered events come from the provider webhook and supersede the initial Sent counter once received.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEMPLATES ---------------------------------------------------- */}
        <TabsContent value="templates">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <LayoutTemplate className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} /> Template previews
              </CardTitle>
              <Button variant="outline" size="sm" className="h-9" onClick={loadPreviews} disabled={previewsLoading}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${previewsLoading ? "animate-spin" : ""}`} strokeWidth={1.5} /> Re-render
              </Button>
            </CardHeader>
            <CardContent className="p-5">
              {previewsLoading && previews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Rendering previews…</p>
              ) : previews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No previews available.</p>
              ) : (
                <Tabs value={activePreview} onValueChange={setActivePreview}>
                  <TabsList className="bg-muted/40">
                    {previews.map((p) => (
                      <TabsTrigger key={p.name} value={p.name}>{p.displayName}</TabsTrigger>
                    ))}
                  </TabsList>
                  {previews.map((p) => (
                    <TabsContent key={p.name} value={p.name} className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Subject: </span>
                          <span className="font-medium text-foreground">{p.subject}</span>
                        </div>
                        <code className="font-mono text-[11px] text-muted-foreground">{p.name}</code>
                      </div>
                      <div className="overflow-hidden rounded-md border border-border/60 bg-white">
                        <iframe
                          title={p.name}
                          srcDoc={p.html}
                          className="h-[640px] w-full"
                          sandbox=""
                        />
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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

function HealthTile({
  label, ok, primary, secondary, tone,
}: { label: string; ok: boolean; primary: string; secondary?: string; tone?: "danger" }) {
  return (
    <div className="rounded-md border border-border/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {ok
          ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><ShieldCheck className="mr-1 h-3 w-3" strokeWidth={1.5} /> OK</Badge>
          : <Badge variant="outline" className={tone === "danger" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"}><ShieldAlert className="mr-1 h-3 w-3" strokeWidth={1.5} /> Attention</Badge>}
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{primary}</p>
      {secondary && <p className="mt-1 break-all text-[11px] text-muted-foreground">{secondary}</p>}
    </div>
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
            ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><ShieldCheck className="mr-1 h-3 w-3" strokeWidth={1.5} /> OK</Badge>
            : <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><ShieldAlert className="mr-1 h-3 w-3" strokeWidth={1.5} /> Missing</Badge>}
      </div>
      <p className="mt-2 break-all text-[11px] leading-snug text-muted-foreground">
        {check?.value || check?.records?.[0] || (loading ? " " : "No record found")}
      </p>
    </div>
  );
}

function latest(map?: Record<string, string | null> | null): string | null {
  if (!map) return null;
  const values = Object.values(map).filter(Boolean) as string[];
  if (!values.length) return null;
  return values.sort().reverse()[0];
}
function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
function recentLine(map?: Record<string, string | null> | null): string {
  if (!map) return "";
  const entries = Object.entries(map).filter(([, v]) => v) as [string, string][];
  if (!entries.length) return "";
  return entries
    .sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .slice(0, 2)
    .map(([t, v]) => `${t}: ${new Date(v).toLocaleTimeString()}`)
    .join(" · ");
}
