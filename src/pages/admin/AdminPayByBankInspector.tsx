import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Search, ShieldCheck, AlertTriangle, Landmark, Download, FileJson, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Intent = {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
  target_type: string;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
};

type WebhookRow = {
  id: string;
  source: string;
  event_id: string;
  event_type: string | null;
  status: string | null;
  attempt_count: number | null;
  max_attempts: number | null;
  next_retry_at: string | null;
  is_processed: boolean | null;
  processed_at: string | null;
  processing_error: string | null;
  created_at: string;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  authorized: "secondary",
  awaiting_auth: "outline",
  failed: "destructive",
  expired: "destructive",
};

export default function AdminPayByBankInspector() {
  const [loading, setLoading] = useState(true);
  const [intents, setIntents] = useState<Intent[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [railFilter, setRailFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Intent | null>(null);
  const [timeline, setTimeline] = useState<any | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pay_by_bank_intents")
      .select("id,status,amount,currency,target_type,failure_reason,created_at,updated_at,metadata")
      .order("created_at", { ascending: false })
      .limit(200);
    setIntents((data as Intent[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return intents.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      const rail = (i.metadata?.rail as string) || "";
      if (railFilter !== "all" && rail !== railFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!i.id.toLowerCase().includes(q)
          && !(i.metadata?.idempotency_key || "").toLowerCase().includes(q)
          && !(i.metadata?.trace_id || "").toLowerCase().includes(q)
          && !(i.metadata?.flw_tx_ref || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [intents, statusFilter, railFilter, query]);

  const idempotencyStats = useMemo(() => {
    const seen = new Map<string, number>();
    for (const i of intents) {
      const k = i.metadata?.idempotency_key;
      if (k) seen.set(k, (seen.get(k) || 0) + 1);
    }
    const total = intents.length;
    const withKey = Array.from(seen.values()).reduce((a, b) => a + b, 0);
    const dupes = Array.from(seen.values()).filter((v) => v > 1).length;
    return { total, withKey, uniqueKeys: seen.size, dupes };
  }, [intents]);

  const openIntent = async (i: Intent) => {
    setSelected(i);
    setTimeline(null);
    setTimelineLoading(true);
    try {
      const { data } = await supabase.functions.invoke("pay-by-bank", {
        body: { action: "get_timeline", intent_id: i.id },
      });
      setTimeline(data);
    } finally {
      setTimelineLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Landmark}
        title="Pay-by-Bank Inspector"
        description="Inspect payment intents, idempotency-key usage, and webhook retry / replay history across the KOB PISP and Flutterwave rails."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total intents (last 200)</CardDescription><CardTitle>{idempotencyStats.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>With idempotency key</CardDescription><CardTitle>{idempotencyStats.withKey}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Unique idempotency keys</CardDescription><CardTitle>{idempotencyStats.uniqueKeys}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Replayed keys</CardDescription><CardTitle className="flex items-center gap-2">{idempotencyStats.dupes}{idempotencyStats.dupes > 0 && <ShieldCheck className="h-4 w-4 text-primary" />}</CardTitle></CardHeader></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div>
              <CardTitle>Payment intents</CardTitle>
              <CardDescription>Filter, search by id / idempotency key / trace id / FW tx_ref.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="pl-8 w-56" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="awaiting_auth">Awaiting auth</SelectItem>
                  <SelectItem value="authorized">Authorized</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={railFilter} onValueChange={setRailFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Rail" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rails</SelectItem>
                  <SelectItem value="kob">KOB PISP</SelectItem>
                  <SelectItem value="flutterwave">Flutterwave hosted</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rail</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Idempotency</TableHead>
                  <TableHead>Trace id</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => openIntent(i)}>
                    <TableCell className="font-mono text-xs">{i.id.slice(0, 8)}…</TableCell>
                    <TableCell><Badge variant={statusVariant[i.status] || "outline"}>{i.status}</Badge></TableCell>
                    <TableCell className="text-sm">{i.metadata?.rail || "—"}</TableCell>
                    <TableCell className="text-right">{i.currency} {Number(i.amount).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{i.metadata?.idempotency_key ? i.metadata.idempotency_key.slice(0, 8) + "…" : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{i.metadata?.trace_id ? i.metadata.trace_id.slice(0, 12) + "…" : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(i.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No intents match the current filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Intent {selected.id}</CardTitle>
            <CardDescription>
              Trace id: <span className="font-mono">{selected.metadata?.trace_id || "—"}</span>
              {selected.metadata?.idempotency_key && (
                <> · Idempotency key: <span className="font-mono">{selected.metadata.idempotency_key}</span></>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="timeline">
              <TabsList>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="webhooks">Webhook history</TabsTrigger>
                <TabsTrigger value="raw">Raw metadata</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="pt-4">
                {timelineLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <ol className="space-y-3">
                    {(timeline?.timeline || []).map((e: any, idx: number) => (
                      <li key={idx} className="flex gap-3 items-start">
                        <Badge variant={e.status === "confirmed" ? "default" : e.status === "failed" ? "destructive" : "outline"}>{e.status}</Badge>
                        <div className="text-sm">
                          <div className="text-foreground">{e.source}{e.detail ? ` · ${e.detail}` : ""}</div>
                          <div className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</div>
                        </div>
                      </li>
                    ))}
                    {(!timeline?.timeline || timeline.timeline.length === 0) && (
                      <li className="text-sm text-muted-foreground">No timeline events recorded.</li>
                    )}
                  </ol>
                )}
              </TabsContent>

              <TabsContent value="webhooks" className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Next retry</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(timeline?.webhook_history || []).map((w: WebhookRow) => (
                      <TableRow key={w.id}>
                        <TableCell>{w.source}</TableCell>
                        <TableCell className="font-mono text-xs">{w.event_type || w.event_id}</TableCell>
                        <TableCell>{w.attempt_count ?? 0}/{w.max_attempts ?? "—"}</TableCell>
                        <TableCell>
                          {w.is_processed ? <Badge>processed</Badge>
                            : w.status === "failed" ? <Badge variant="destructive">failed</Badge>
                            : <Badge variant="outline">{w.status || "pending"}</Badge>}
                          {w.processing_error && <div className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{w.processing_error.slice(0, 80)}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{w.next_retry_at ? new Date(w.next_retry_at).toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-xs">{new Date(w.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {(!timeline?.webhook_history || timeline.webhook_history.length === 0) && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No webhook deliveries recorded for this intent.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="raw" className="pt-4">
                <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">{JSON.stringify(selected.metadata, null, 2)}</pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
