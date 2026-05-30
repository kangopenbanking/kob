import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Activity, AlertTriangle, CheckCircle2, MailWarning, RefreshCw, ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type Range = "24h" | "7d" | "30d";

const RANGE_HOURS: Record<Range, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

interface LogRow {
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  user_id: string | null;
}

interface AlertRow {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
}

export default function EmailHealthDashboard() {
  const { toast } = useToast();
  const [range, setRange] = useState<Range>("24h");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);

  const since = useMemo(
    () => new Date(Date.now() - RANGE_HOURS[range] * 60 * 60 * 1000).toISOString(),
    [range]
  );

  const load = async () => {
    setLoading(true);
    try {
      const [logRes, alertRes] = await Promise.all([
        supabase
          .from("email_send_log")
          .select("message_id, template_name, recipient_email, status, error_message, created_at, user_id")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("admin_alerts")
          .select("id, alert_type, severity, title, message, created_at, acknowledged_at")
          .like("alert_type", "email_%")
          .order("created_at", { ascending: false })
          .limit(25),
      ]);
      if (logRes.error) throw logRes.error;
      if (alertRes.error) throw alertRes.error;
      setRows((logRes.data || []) as LogRow[]);
      setAlerts((alertRes.data || []) as AlertRow[]);
    } catch (e: any) {
      toast({ title: "Failed to load email metrics", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  // Deduplicate by message_id (latest status wins). Rows already ordered desc.
  const latestByMessage = useMemo(() => {
    const map = new Map<string, LogRow>();
    for (const r of rows) {
      const key = r.message_id || `__${r.recipient_email}_${r.created_at}`;
      if (!map.has(key)) map.set(key, r);
    }
    return Array.from(map.values());
  }, [rows]);

  const stats = useMemo(() => {
    const total = latestByMessage.length;
    const counts: Record<string, number> = {};
    for (const r of latestByMessage) counts[r.status] = (counts[r.status] || 0) + 1;
    const sent = counts["sent"] || 0;
    const bounced = counts["bounced"] || 0;
    const complained = counts["complained"] || 0;
    const failed = (counts["failed"] || 0) + (counts["dlq"] || 0);
    const suppressed = counts["suppressed"] || 0;
    const pending = counts["pending"] || 0;
    const delivered = sent + bounced + complained;
    const bounceRate = delivered > 0 ? ((bounced + complained) / delivered) * 100 : 0;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;
    return { total, sent, bounced, complained, failed, suppressed, pending, bounceRate, failureRate };
  }, [latestByMessage]);

  const topFailingTemplates = useMemo(() => {
    const agg = new Map<string, { sent: number; failed: number; bounced: number }>();
    for (const r of latestByMessage) {
      const a = agg.get(r.template_name) || { sent: 0, failed: 0, bounced: 0 };
      if (r.status === "sent") a.sent++;
      else if (r.status === "failed" || r.status === "dlq") a.failed++;
      else if (r.status === "bounced" || r.status === "complained") a.bounced++;
      agg.set(r.template_name, a);
    }
    return Array.from(agg.entries())
      .map(([template, v]) => ({ template, ...v, total: v.sent + v.failed + v.bounced }))
      .filter((t) => t.failed + t.bounced > 0)
      .sort((a, b) => (b.failed + b.bounced) - (a.failed + a.bounced))
      .slice(0, 8);
  }, [latestByMessage]);

  const recentFailures = useMemo(
    () => latestByMessage.filter((r) => ["failed", "dlq", "bounced", "complained"].includes(r.status)).slice(0, 25),
    [latestByMessage]
  );

  const runHealthCheck = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-queue-alerts", { body: {} });
      if (error) throw error;
      toast({
        title: "Health check complete",
        description: `Alerts fired: ${(data?.alerts_fired || []).join(", ") || "none"}`,
      });
      await load();
    } catch (e: any) {
      toast({ title: "Health check failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const acknowledge = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("admin_alerts")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user?.id })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      load();
    }
  };

  const statusBadge = (s: string) => {
    const variant: Record<string, string> = {
      sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      failed: "bg-red-50 text-red-700 border-red-200",
      dlq: "bg-red-50 text-red-700 border-red-200",
      bounced: "bg-orange-50 text-orange-700 border-orange-200",
      complained: "bg-orange-50 text-orange-700 border-orange-200",
      suppressed: "bg-zinc-100 text-zinc-700 border-zinc-200",
    };
    return <Badge variant="outline" className={variant[s] || ""}>{s}</Badge>;
  };

  const bounceRateCritical = stats.bounceRate > 5;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email health</h1>
          <p className="text-sm text-muted-foreground">
            Delivery, bounces, and dispatcher alerts across all transactional and auth emails.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as Range)}>
            <ToggleGroupItem value="24h">24h</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={runHealthCheck} disabled={running}>
            <Activity className="h-4 w-4 mr-2" />
            Run health check
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Unique emails" value={stats.total} icon={<MailWarning className="h-4 w-4" />} />
        <StatCard label="Delivered" value={stats.sent} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
        <StatCard
          label="Bounce + complaint rate"
          value={`${stats.bounceRate.toFixed(2)}%`}
          icon={<ShieldAlert className={`h-4 w-4 ${bounceRateCritical ? "text-red-600" : "text-muted-foreground"}`} />}
          tone={bounceRateCritical ? "danger" : "default"}
          hint={bounceRateCritical ? "Above 5% threshold" : "Healthy (<5%)"}
        />
        <StatCard
          label="Failure rate"
          value={`${stats.failureRate.toFixed(2)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <SubStat label="Bounced" value={stats.bounced} />
        <SubStat label="Complained" value={stats.complained} />
        <SubStat label="Failed / DLQ" value={stats.failed} />
        <SubStat label="Suppressed" value={stats.suppressed} />
        <SubStat label="Pending" value={stats.pending} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24" />
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No email alerts in the recent history.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.alert_type}</TableCell>
                    <TableCell>
                      <Badge variant={a.severity === "critical" ? "destructive" : "secondary"}>{a.severity}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md text-sm">{a.message}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {a.acknowledged_at ? (
                        <Badge variant="outline">Acknowledged</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Open</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!a.acknowledged_at && (
                        <Button size="sm" variant="ghost" onClick={() => acknowledge(a.id)}>
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Templates with most issues</CardTitle>
          </CardHeader>
          <CardContent>
            {topFailingTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failing templates in this window.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Bounced</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topFailingTemplates.map((t) => (
                    <TableRow key={t.template}>
                      <TableCell className="font-mono text-xs">{t.template}</TableCell>
                      <TableCell className="text-right">{t.sent}</TableCell>
                      <TableCell className="text-right text-orange-700">{t.bounced}</TableCell>
                      <TableCell className="text-right text-red-700">{t.failed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent failures</CardTitle>
          </CardHeader>
          <CardContent>
            {recentFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent failures.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentFailures.map((r, i) => (
                    <TableRow key={`${r.message_id}-${i}`}>
                      <TableCell className="font-mono text-xs">{r.template_name}</TableCell>
                      <TableCell className="text-xs">{r.recipient_email}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, tone = "default", hint,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  hint?: string;
}) {
  return (
    <Card className={tone === "danger" ? "border-red-200" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div className={`text-2xl font-semibold mt-1 ${tone === "danger" ? "text-red-700" : ""}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function SubStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-medium">{value}</div>
    </div>
  );
}
