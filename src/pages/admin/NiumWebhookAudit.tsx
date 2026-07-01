import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Shield, CheckCircle2, XCircle, Copy } from "lucide-react";
import { format } from "date-fns";

type Row = {
  id: string;
  event_id: string | null;
  event_type: string | null;
  outcome: "accepted" | "rejected" | "duplicate";
  reason: string | null;
  status_code: number | null;
  client_ip: string | null;
  user_agent: string | null;
  had_signature_key: boolean;
  had_hmac_signature: boolean;
  body_bytes: number | null;
  created_at: string;
};

export default function NiumWebhookAudit() {
  const [outcome, setOutcome] = useState<string>("all");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["nium-webhook-audit", outcome],
    queryFn: async () => {
      let q = supabase
        .from("nium_webhook_audit" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (outcome !== "all") q = q.eq("outcome", outcome);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Row[]) ?? [];
    },
    refetchInterval: 15_000,
  });

  const counts = (data ?? []).reduce(
    (a, r) => {
      a[r.outcome] = (a[r.outcome] ?? 0) + 1;
      return a;
    },
    {} as Record<string, number>,
  );

  const badge = (o: Row["outcome"]) =>
    o === "accepted" ? "default" : o === "duplicate" ? "secondary" : "destructive";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Nium Webhook Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verification outcomes for every inbound Nium webhook — accepted, duplicate, or rejected.
            The webhook secret value is never displayed on this page.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Accepted</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold">{counts.accepted ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Duplicate (replay-blocked)</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold">{counts.duplicate ?? 0}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rejected</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold">{counts.rejected ?? 0}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent events (last 200)</CardTitle>
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="duplicate">Duplicate</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-md" />)}</div>
          ) : !data?.length ? (
            <p className="text-center text-sm text-muted-foreground py-8">No webhook events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Outcome</th>
                    <th className="py-2 pr-3">Reason</th>
                    <th className="py-2 pr-3">Event</th>
                    <th className="py-2 pr-3">Event ID</th>
                    <th className="py-2 pr-3">IP</th>
                    <th className="py-2 pr-3">Headers</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(r => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-3 whitespace-nowrap">{format(new Date(r.created_at), "MMM d, HH:mm:ss")}</td>
                      <td className="py-2 pr-3"><Badge variant={badge(r.outcome) as any} className="text-xs capitalize">{r.outcome}</Badge></td>
                      <td className="py-2 pr-3 text-xs">{r.reason ?? "—"}</td>
                      <td className="py-2 pr-3 text-xs">{r.event_type ?? "—"}</td>
                      <td className="py-2 pr-3 text-xs font-mono">
                        {r.event_id ? (
                          <button
                            className="hover:underline inline-flex items-center gap-1"
                            onClick={() => navigator.clipboard.writeText(r.event_id!)}
                          >
                            {r.event_id.slice(0, 16)}… <Copy className="h-3 w-3" />
                          </button>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs">{r.client_ip ?? "—"}</td>
                      <td className="py-2 pr-3 text-xs">
                        {r.had_signature_key && <Badge variant="outline" className="mr-1 text-[10px]">key</Badge>}
                        {r.had_hmac_signature && <Badge variant="outline" className="text-[10px]">hmac</Badge>}
                        {!r.had_signature_key && !r.had_hmac_signature && <span className="text-muted-foreground">none</span>}
                      </td>
                      <td className="py-2 pr-3 text-xs">{r.status_code ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
