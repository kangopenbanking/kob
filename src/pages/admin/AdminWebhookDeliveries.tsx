// Admin webhook operations console
// Three tabs:
//   1. Deliveries  — live status across all merchant endpoints (replay supported).
//   2. Dead Letter — entries moved to webhook_inbox_dlq with manual replay.
//   3. Replay Log  — full audit of past replays, filterable by eventId.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { WebhookDeliveriesPanel } from "@/components/webhooks/WebhookDeliveriesPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { TestWebhookDialog } from "@/components/admin/TestWebhookDialog";

type DlqRow = {
  id: string;
  source: string;
  provider: string | null;
  event_id: string | null;
  event_type: string | null;
  dlq_reason: string;
  attempt_count: number;
  last_error: string | null;
  moved_to_dlq_at: string;
  replayed_at: string | null;
  replay_status: string | null;
};

type AuditRow = {
  id: string;
  inbox_id: string;
  provider: string;
  event_id: string | null;
  signature_valid: boolean | null;
  idempotent_skip: boolean | null;
  result_status: number | null;
  result_code: string | null;
  created_at: string;
};

export default function AdminWebhookDeliveries() {
  const [dlq, setDlq] = useState<DlqRow[]>([]);
  const [dlqLoading, setDlqLoading] = useState(true);
  const [dlqReplayingId, setDlqReplayingId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [eventIdFilter, setEventIdFilter] = useState("");

  async function loadDlq() {
    setDlqLoading(true);
    const { data, error } = await supabase
      .from("webhook_inbox_dlq")
      .select("id, source, provider, event_id, event_type, dlq_reason, attempt_count, last_error, moved_to_dlq_at, replayed_at, replay_status")
      .order("moved_to_dlq_at", { ascending: false })
      .limit(200);
    if (error) toast.error(`Failed to load DLQ: ${error.message}`);
    else setDlq((data ?? []) as DlqRow[]);
    setDlqLoading(false);
  }

  async function loadAudit(eventId?: string) {
    setAuditLoading(true);
    let q = supabase
      .from("webhook_replay_audit")
      .select("id, inbox_id, provider, event_id, signature_valid, idempotent_skip, result_status, result_code, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (eventId && eventId.trim()) q = q.eq("event_id", eventId.trim());
    const { data, error } = await q;
    if (error) toast.error(`Failed to load replay log: ${error.message}`);
    else setAudit((data ?? []) as AuditRow[]);
    setAuditLoading(false);
  }

  useEffect(() => { loadDlq(); loadAudit(); }, []);

  async function replayDlq(id: string) {
    setDlqReplayingId(id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-webhook-dlq-replay", {
        body: { dlq_id: id },
      });
      if (error) throw error;
      toast.success(`Re-enqueued (inbox_id: ${(data as any)?.inbox_id ?? "n/a"})`);
      await loadDlq();
    } catch (err) {
      toast.error(extractEdgeFunctionError(err) || "DLQ replay failed");
    } finally {
      setDlqReplayingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <SEO title="Webhook operations console" description="Monitor webhook deliveries, replay history, and dead-letter queue." />
      <div>
        <h1 className="text-2xl font-bold">Webhook operations</h1>
        <p className="text-muted-foreground">
          Operator view across all merchant endpoints. Replays write an auditable new delivery row.
        </p>
      </div>

      <Tabs defaultValue="deliveries" className="space-y-6">
        <TabsList>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="dlq">Dead letter queue</TabsTrigger>
          <TabsTrigger value="audit">Replay history</TabsTrigger>
        </TabsList>

        <TabsContent value="deliveries" className="space-y-4">
          <div className="flex justify-end">
            <TestWebhookDialog />
          </div>
          <WebhookDeliveriesPanel scope="admin" />
        </TabsContent>

        <TabsContent value="dlq" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Dead letter queue</CardTitle>
                <CardDescription>
                  Events that exhausted retries. Replay re-enqueues into webhook_inbox for the matching receiver.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadDlq} disabled={dlqLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${dlqLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {dlqLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading DLQ entries…
                </div>
              ) : dlq.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No dead-letter entries.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Moved at</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Replay</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dlq.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(r.moved_to_dlq_at), "yyyy-MM-dd HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{r.source}</div>
                          {r.provider && <div className="text-xs text-muted-foreground">{r.provider}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs">{r.event_id ?? "—"}</div>
                          {r.event_type && <div className="text-xs text-muted-foreground">{r.event_type}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="font-mono text-xs">{r.dlq_reason}</Badge>
                          {r.last_error && (
                            <div className="text-xs text-muted-foreground mt-1 max-w-xs truncate" title={r.last_error}>
                              {r.last_error}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{r.attempt_count}</TableCell>
                        <TableCell>
                          {r.replayed_at ? (
                            <Badge variant="secondary">{r.replay_status ?? "replayed"}</Badge>
                          ) : (
                            <Badge variant="outline">never</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => replayDlq(r.id)}
                            disabled={dlqReplayingId === r.id}
                          >
                            {dlqReplayingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <><RotateCcw className="h-4 w-4 mr-1" /> Replay</>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Replay history</CardTitle>
              <CardDescription>Audit trail of every manual replay across providers. Filter by event id.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Filter by event id…"
                    value={eventIdFilter}
                    onChange={(e) => setEventIdFilter(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadAudit(eventIdFilter)}
                  />
                </div>
                <Button variant="outline" onClick={() => loadAudit(eventIdFilter)} disabled={auditLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${auditLoading ? "animate-spin" : ""}`} />
                  Apply
                </Button>
                {eventIdFilter && (
                  <Button variant="ghost" onClick={() => { setEventIdFilter(""); loadAudit(); }}>
                    Clear
                  </Button>
                )}
              </div>

              {auditLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading replay log…
                </div>
              ) : audit.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No replays recorded for this filter.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Signature</TableHead>
                      <TableHead>Idempotent</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss")}
                        </TableCell>
                        <TableCell>{r.provider}</TableCell>
                        <TableCell className="font-mono text-xs">{r.event_id ?? "—"}</TableCell>
                        <TableCell>
                          {r.signature_valid === null ? (
                            <Badge variant="outline">n/a</Badge>
                          ) : r.signature_valid ? (
                            <Badge variant="secondary">valid</Badge>
                          ) : (
                            <Badge variant="destructive">invalid</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.idempotent_skip ? <Badge variant="secondary">skipped</Badge> : <Badge variant="outline">applied</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.result_status && r.result_status < 400 ? "secondary" : "destructive"} className="font-mono">
                            {r.result_status ?? "—"} {r.result_code ?? ""}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
