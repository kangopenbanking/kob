import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, Mail, CheckCircle2, AlertCircle, Clock,
  AlertTriangle, Send, Search, ChevronDown, ChevronRight, Bell, ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
};

type RedeliveryRow = {
  id: string;
  original_message_id: string;
  new_message_id: string;
  template_name: string;
  recipient_email: string;
  redelivery_attempt: number;
  triggered_by: string;
  result_status: string | null;
  error_message: string | null;
  created_at: string;
};

type AlertRow = {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  acknowledged_at: string | null;
  created_at: string;
};

type GroupedInvite = {
  recipient: string;
  latest: LogRow;
  history: LogRow[];
  redeliveries: RedeliveryRow[];
};

const INVITE_TEMPLATE_PATTERNS = [
  "support-agent-invite",
  "managed-support_agent_invite",
  "invite",
  "support-new-chat-agent",
];

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    sent: { label: "Sent", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
    dlq: { label: "Dead-letter", cls: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
    failed: { label: "Failed", cls: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
    bounced: { label: "Bounced", cls: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
    suppressed: { label: "Suppressed", cls: "bg-slate-50 text-slate-700 border-slate-200", icon: ShieldAlert },
    complained: { label: "Complained", cls: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  };
  const cfg = map[status] || { label: status, cls: "bg-slate-50 text-slate-700 border-slate-200", icon: Mail };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.cls} font-medium gap-1`}>
      <Icon className="h-3 w-3" strokeWidth={1.75} />
      {cfg.label}
    </Badge>
  );
}

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    info: "bg-sky-50 text-sky-700 border-sky-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    critical: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <Badge variant="outline" className={`${map[severity] || ""} font-medium uppercase text-[10px] tracking-wider`}>
      {severity}
    </Badge>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function AdminInviteEmailHistory() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [redeliveries, setRedeliveries] = useState<RedeliveryRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [search, setSearch] = useState("");
  const [openRecipients, setOpenRecipients] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

      const orFilter = INVITE_TEMPLATE_PATTERNS.map((p) => `template_name.ilike.%${p}%`).join(",");

      const [logsRes, redelivRes, alertsRes] = await Promise.all([
        supabase
          .from("email_send_log")
          .select("id,message_id,template_name,recipient_email,status,error_message,metadata,created_at,attempt_count,last_attempt_at,next_retry_at")
          .or(orFilter)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("email_dlq_redeliveries")
          .select("*")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("admin_alerts")
          .select("*")
          .in("alert_type", ["email_dlq_growth", "email_queue_backlog", "email_send_failure_spike"])
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (logsRes.error) throw logsRes.error;
      setLogs((logsRes.data as any) || []);
      setRedeliveries((redelivRes.data as any) || []);
      setAlerts((alertsRes.data as any) || []);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Group logs by recipient, computing latest status from the most recent row.
  const grouped: GroupedInvite[] = useMemo(() => {
    const byRecipient = new Map<string, LogRow[]>();
    for (const row of logs) {
      const r = (row.recipient_email || "").toLowerCase();
      if (!r) continue;
      if (!byRecipient.has(r)) byRecipient.set(r, []);
      byRecipient.get(r)!.push(row);
    }
    const redelByOriginal = new Map<string, RedeliveryRow[]>();
    for (const r of redeliveries) {
      if (!redelByOriginal.has(r.recipient_email.toLowerCase())) {
        redelByOriginal.set(r.recipient_email.toLowerCase(), []);
      }
      redelByOriginal.get(r.recipient_email.toLowerCase())!.push(r);
    }
    const out: GroupedInvite[] = [];
    for (const [recipient, history] of byRecipient.entries()) {
      const sorted = [...history].sort((a, b) => b.created_at.localeCompare(a.created_at));
      out.push({
        recipient,
        latest: sorted[0],
        history: sorted,
        redeliveries: redelByOriginal.get(recipient) || [],
      });
    }
    return out
      .filter((g) => !search || g.recipient.includes(search.toLowerCase()))
      .sort((a, b) => b.latest.created_at.localeCompare(a.latest.created_at));
  }, [logs, redeliveries, search]);

  const stats = useMemo(() => {
    const dedupBy = new Map<string, LogRow>();
    for (const r of logs) {
      const key = r.message_id || r.id;
      const existing = dedupBy.get(key);
      if (!existing || existing.created_at < r.created_at) dedupBy.set(key, r);
    }
    const latest = Array.from(dedupBy.values());
    return {
      total: latest.length,
      sent: latest.filter((r) => r.status === "sent").length,
      pending: latest.filter((r) => r.status === "pending").length,
      dlq: latest.filter((r) => r.status === "dlq" || r.status === "failed" || r.status === "bounced").length,
      suppressed: latest.filter((r) => r.status === "suppressed").length,
      unackedAlerts: alerts.filter((a) => !a.acknowledged_at).length,
    };
  }, [logs, alerts]);

  const toggleOpen = (recipient: string) => {
    setOpenRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(recipient)) next.delete(recipient); else next.add(recipient);
      return next;
    });
  };

  const retryDlq = async (messageId: string, recipient: string) => {
    setRetrying(messageId);
    try {
      const { data, error } = await supabase.functions.invoke("email-dlq-redelivery", {
        body: { triggered_by: "admin", message_id: messageId },
      });
      if (error) throw error;
      const result = (data as any)?.results?.[0];
      if (result?.status === "queued") {
        toast({ title: "Re-delivery queued", description: `New attempt queued for ${recipient}.` });
      } else if (result?.status === "failed") {
        toast({ title: "Re-delivery failed", description: result.error || "Unknown error", variant: "destructive" });
      } else {
        toast({ title: "No action taken", description: "The message may already be resolved or skipped." });
      }
      await load();
    } catch (e: any) {
      toast({ title: "Retry failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setRetrying(null);
    }
  };

  const acknowledgeAlert = async (id: string) => {
    const { error } = await supabase
      .from("admin_alerts")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to acknowledge", description: error.message, variant: "destructive" });
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> Admin
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Invite Email History</h1>
          <p className="text-sm text-muted-foreground">
            Per-recipient invite delivery timeline, DLQ retry tools, and queue health alerts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} strokeWidth={1.75} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total invites" value={stats.total} />
        <StatCard label="Sent" value={stats.sent} accent="emerald" />
        <StatCard label="Pending" value={stats.pending} accent="amber" />
        <StatCard label="Failed / DLQ" value={stats.dlq} accent="red" />
        <StatCard label="Open alerts" value={stats.unackedAlerts} accent={stats.unackedAlerts > 0 ? "red" : "slate"} />
      </div>

      <Tabs defaultValue="recipients">
        <TabsList>
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
          <TabsTrigger value="redeliveries">DLQ Re-deliveries</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts {stats.unackedAlerts > 0 && (
              <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200">
                {stats.unackedAlerts}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recipients" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative max-w-md">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                <Input
                  placeholder="Search recipient email"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Recipient</TableHead>
                    <TableHead>Latest status</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Last attempt</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No invite emails in the last 30 days.
                      </TableCell>
                    </TableRow>
                  )}
                  {grouped.map((g) => {
                    const isOpen = openRecipients.has(g.recipient);
                    const dlqMsgIds = Array.from(new Set(
                      g.history.filter((r) => r.status === "dlq" || r.status === "failed").map((r) => r.message_id).filter(Boolean) as string[]
                    ));
                    const canRetry = dlqMsgIds.length > 0;
                    return (
                      <Collapsible
                        key={g.recipient}
                        open={isOpen}
                        onOpenChange={() => toggleOpen(g.recipient)}
                        asChild
                      >
                        <>
                          <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => toggleOpen(g.recipient)}>
                            <TableCell>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                            </TableCell>
                            <TableCell className="font-medium">{g.recipient}</TableCell>
                            <TableCell>{statusBadge(g.latest.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{g.latest.template_name}</TableCell>
                            <TableCell className="text-xs">{formatDate(g.latest.created_at)}</TableCell>
                            <TableCell>{g.history.length}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              {canRetry && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={retrying !== null}
                                  onClick={() => retryDlq(dlqMsgIds[0], g.recipient)}
                                >
                                  {retrying === dlqMsgIds[0] ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5 mr-1" strokeWidth={1.75} />
                                  )}
                                  Retry
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/20 p-4">
                                <div className="space-y-3">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Send history
                                  </div>
                                  <div className="space-y-2">
                                    {g.history.map((h) => (
                                      <div key={h.id} className="flex items-start gap-3 text-sm border border-border rounded-md p-3 bg-background">
                                        <div className="mt-0.5">{statusBadge(h.status)}</div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{formatDate(h.created_at)}</span>
                                            <span>•</span>
                                            <span className="font-mono truncate">{h.message_id}</span>
                                            {h.attempt_count && <><span>•</span><span>attempt {h.attempt_count}</span></>}
                                          </div>
                                          {h.error_message && (
                                            <div className="mt-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 font-mono break-words">
                                              {h.error_message}
                                            </div>
                                          )}
                                          {h.next_retry_at && h.status === "pending" && (
                                            <div className="mt-1 text-xs text-amber-700">
                                              Next retry: {formatDate(h.next_retry_at)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {g.redeliveries.length > 0 && (
                                    <>
                                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">
                                        Automated re-deliveries
                                      </div>
                                      <div className="space-y-2">
                                        {g.redeliveries.map((r) => (
                                          <div key={r.id} className="text-xs flex items-center gap-3 border border-border rounded-md p-2 bg-background">
                                            <Badge variant="outline" className={r.result_status === "queued" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                                              {r.result_status}
                                            </Badge>
                                            <span className="text-muted-foreground">attempt {r.redelivery_attempt}</span>
                                            <span className="text-muted-foreground">via {r.triggered_by}</span>
                                            <span className="text-muted-foreground">{formatDate(r.created_at)}</span>
                                            {r.error_message && <span className="text-red-700 font-mono truncate">{r.error_message}</span>}
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redeliveries">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Automated DLQ re-delivery log</CardTitle>
              <CardDescription>
                Every 15 minutes the system scans the dead-letter queue, generates a fresh idempotency key,
                and re-invokes the send pipeline. Each attempt is recorded here.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Triggered by</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redeliveries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No re-deliveries recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {redeliveries.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                      <TableCell className="text-sm font-medium">{r.recipient_email}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.template_name}</TableCell>
                      <TableCell>{r.redelivery_attempt}</TableCell>
                      <TableCell><Badge variant="outline">{r.triggered_by}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={r.result_status === "queued" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}>
                          {r.result_status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-red-700 font-mono max-w-xs truncate">{r.error_message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" strokeWidth={1.75} />
                Email queue alerts
              </CardTitle>
              <CardDescription>
                Backlog and DLQ growth alerts. Alerts deduplicate per hour and notify all admins by email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No alerts in the last 30 days. Queue is healthy.
                </div>
              )}
              {alerts.map((a) => (
                <div key={a.id} className={`border rounded-md p-4 ${a.acknowledged_at ? "border-border bg-muted/20" : "border-red-200 bg-red-50/30"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-4 w-4 ${a.severity === "critical" ? "text-red-600" : "text-amber-600"}`} strokeWidth={1.75} />
                        <span className="font-semibold text-sm">{a.title}</span>
                        {severityBadge(a.severity)}
                        {a.acknowledged_at && <Badge variant="outline" className="text-[10px]">Acknowledged</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{a.message}</p>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(a.created_at)}
                        {a.metadata && Object.keys(a.metadata).length > 0 && (
                          <> · <span className="font-mono">{JSON.stringify(a.metadata)}</span></>
                        )}
                      </div>
                    </div>
                    {!a.acknowledged_at && (
                      <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(a.id)}>
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "amber" | "red" | "slate" }) {
  const accentClass =
    accent === "emerald" ? "text-emerald-700"
    : accent === "amber" ? "text-amber-700"
    : accent === "red" ? "text-red-700"
    : accent === "slate" ? "text-slate-700"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${accentClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
