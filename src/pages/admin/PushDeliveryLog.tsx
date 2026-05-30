import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface DeliveryRow {
  id: string;
  user_id: string;
  notification_id: string | null;
  triggered_by: string | null;
  title: string;
  message: string;
  type: string | null;
  status: string;
  http_status: number | null;
  error_code: string | null;
  error_body: unknown;
  onesignal_id: string | null;
  recipients: number | null;
  attempts: number;
  elapsed_ms: number | null;
  test_mode: boolean;
  created_at: string;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "sent") return "default";
  if (status === "partial") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

export default function PushDeliveryLog() {
  const [userFilter, setUserFilter] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["push-delivery-log", userFilter],
    queryFn: async (): Promise<DeliveryRow[]> => {
      let q = supabase
        .from("push_delivery_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (userFilter.trim()) {
        q = q.eq("user_id", userFilter.trim());
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as DeliveryRow[];
    },
  });

  const rows = data ?? [];
  const total = rows.length;
  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const partial = rows.filter((r) => r.status === "partial").length;
  const successRate = total > 0 ? Math.round(((sent + partial) / total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Push Delivery Log</h1>
          <p className="text-sm text-muted-foreground">
            OneSignal send attempts with response codes, retries, and per-user status.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total (last 200)</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{total}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Sent</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-green-600">{sent}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-destructive">{failed}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Success rate</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{successRate}%</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Filter by user_id (UUID)"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent attempts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No delivery records.</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={r.title}>{r.title}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    {r.test_mode && <Badge variant="outline" className="ml-1">test</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.http_status ?? "—"}</TableCell>
                  <TableCell>{r.recipients ?? "—"}</TableCell>
                  <TableCell>{r.attempts}</TableCell>
                  <TableCell>{r.elapsed_ms != null ? `${r.elapsed_ms}ms` : "—"}</TableCell>
                  <TableCell className="max-w-[280px] text-xs">
                    {r.error_code ? (
                      <div>
                        <div className="font-medium text-destructive">{r.error_code}</div>
                        {r.error_body != null && (
                          <div className="text-muted-foreground truncate" title={JSON.stringify(r.error_body)}>
                            {JSON.stringify(r.error_body)}
                          </div>
                        )}
                      </div>
                    ) : "—"}
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
