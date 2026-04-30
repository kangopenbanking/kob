// Phase 3 — Webhook Deliveries viewer with replay
// Additive component shared by merchant and admin webhook pages.
// Reads gateway_webhook_deliveries_v2 (RLS-scoped); replay invokes
// gateway-webhook-replay-delivery edge function which writes its own audit row.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";

interface Props {
  /** When set, restrict to one merchant's endpoints; admin view leaves undefined. */
  merchantId?: string;
  scope: "merchant" | "admin";
}

export function WebhookDeliveriesPanel({ merchantId, scope }: Props) {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [endpointId, setEndpointId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  useEffect(() => { loadEndpoints(); }, [merchantId]);
  useEffect(() => { if (endpointId) loadDeliveries(); }, [endpointId, statusFilter]);

  const loadEndpoints = async () => {
    setLoading(true);
    let q = supabase.from("gateway_webhook_endpoints").select("id, url, merchant_id, is_active").order("created_at", { ascending: false }).limit(200);
    if (merchantId) q = q.eq("merchant_id", merchantId);
    const { data } = await q;
    setEndpoints(data ?? []);
    if (data?.length && !endpointId) setEndpointId(data[0].id);
    setLoading(false);
  };

  const loadDeliveries = async () => {
    let q = supabase.from("gateway_webhook_deliveries_v2")
      .select("id, endpoint_id, merchant_id, event_type, status, attempt, max_attempts, response_status, created_at, delivered_at")
      .eq("endpoint_id", endpointId)
      .order("created_at", { ascending: false }).limit(100);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    setDeliveries(data ?? []);
  };

  const replay = async (deliveryId: string) => {
    setReplayingId(deliveryId);
    try {
      const { data, error } = await supabase.functions.invoke("gateway-webhook-replay-delivery", {
        body: { endpoint_id: endpointId, delivery_id: deliveryId },
      });
      if (error) throw error;
      const status = (data as any)?.status ?? "unknown";
      const code = (data as any)?.response_status ?? "—";
      toast.success(`Replay ${status} (HTTP ${code})`);
      await loadDeliveries();
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e));
    } finally { setReplayingId(null); }
  };

  const filtered = search
    ? deliveries.filter((d) =>
        [d.event_type, d.id, d.endpoint_id].some((v) => String(v ?? "").toLowerCase().includes(search.toLowerCase())))
    : deliveries;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!endpoints.length) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">No webhook endpoints configured.</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook deliveries</CardTitle>
        <CardDescription>
          {scope === "admin"
            ? "All endpoints across the platform — replay writes a new delivery row and preserves the original for audit."
            : "Recent delivery attempts to your endpoint. Replays use the existing 7-attempt retry contract one-shot."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1 min-w-0 space-y-1">
            <label className="text-xs text-muted-foreground">Endpoint</label>
            <Select value={endpointId} onValueChange={setEndpointId}>
              <SelectTrigger><SelectValue placeholder="Select endpoint" /></SelectTrigger>
              <SelectContent>
                {endpoints.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="truncate">{e.url}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1">
            <label className="text-xs text-muted-foreground">Search (event type / id)</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="charge.succeeded" />
          </div>
          <Button variant="outline" onClick={loadDeliveries} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No deliveries match.</TableCell></TableRow>
              )}
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.event_type}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === "delivered" ? "default" : d.status === "failed" ? "destructive" : "secondary"}>
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d.attempt}/{d.max_attempts}</TableCell>
                  <TableCell className="text-sm">{d.response_status ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.created_at ? format(new Date(d.created_at), "MMM d, HH:mm:ss") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={replayingId === d.id}
                      onClick={() => replay(d.id)}>
                      {replayingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      Replay
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
