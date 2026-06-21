import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const REQUIRED_PTP_EVENTS = [
  "ptp.created",
  "ptp.partial",
  "ptp.rescheduled",
  "ptp.kept",
  "ptp.broken",
  "ptp.swept",
  "ptp.cancelled",
] as const;

type Subscription = {
  id: string;
  institution_id: string | null;
  url: string | null;
  webhook_url: string | null;
  events: string[] | null;
  is_active: boolean;
};

type Delivery = {
  id: string;
  webhook_id: string;
  event_type: string;
  status: string;
  http_status: number | null;
  attempt_count: number;
  trace_id: string | null;
  created_at: string;
  delivered_at: string | null;
  response_body: string | null;
};

export default function PtpWebhookHealth() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: webhooks }, { data: logs }] = await Promise.all([
        supabase
          .from("webhooks")
          .select("id, institution_id, url, webhook_url, events, is_active")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("webhook_deliveries")
          .select("id, webhook_id, event_type, status, http_status, attempt_count, trace_id, created_at, delivered_at, response_body")
          .like("event_type", "ptp.%")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      setSubs(((webhooks ?? []) as Subscription[]).filter((w) => (w.events ?? []).some((e) => e.startsWith("ptp."))));
      setDeliveries((logs ?? []) as Delivery[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const missingFor = (s: Subscription) =>
    REQUIRED_PTP_EVENTS.filter((e) => !(s.events ?? []).includes(e));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">PTP Webhook Subscriptions</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Active institution endpoints subscribed to any <span className="font-mono">ptp.*</span> event.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Subscribed</TableHead>
                <TableHead>Missing PTP events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => {
                const missing = missingFor(s);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.institution_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate" title={s.url ?? s.webhook_url ?? ""}>
                      {s.url ?? s.webhook_url ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(s.events ?? []).filter((e) => e.startsWith("ptp.")).map((e) => (
                          <Badge key={e} variant="outline" className="text-[10px] font-mono">{e}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {missing.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {missing.map((e) => (
                            <Badge key={e} variant="outline" className="text-[10px] font-mono border-amber-400 text-amber-700">
                              <AlertTriangle className="h-3 w-3 mr-1" /> {e}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && subs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                  No active subscribers for PTP events.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">PTP Webhook Delivery Log</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Most recent 50 deliveries. Use the Request ID (trace) when troubleshooting with the institution.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => {
                const sub = subs.find((s) => s.id === d.webhook_id);
                const ok = d.http_status && d.http_status >= 200 && d.http_status < 300;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-[11px]" title={d.trace_id ?? d.id}>
                      {(d.trace_id ?? d.id).slice(0, 18)}…
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.event_type}</TableCell>
                    <TableCell className="font-mono text-xs">{sub?.institution_id?.slice(0, 8) ?? "—"}</TableCell>
                    <TableCell className={`text-xs font-semibold ${ok ? "text-emerald-600" : d.http_status ? "text-destructive" : "text-muted-foreground"}`}>
                      {d.http_status ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{d.attempt_count}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        d.status === "delivered" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        d.status === "failed" ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }>{d.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(d.created_at), "MMM d HH:mm")}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && deliveries.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                  No PTP webhook deliveries recorded yet.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
