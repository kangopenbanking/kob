import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Webhook, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { PageGuide } from "@/components/business-app/PageGuide";

export default function BusinessWebhookLogs() {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["biz-webhook-logs", merchantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("webhook_delivery_log" as any)
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
    enabled: !!merchantId,
  });

  return (
    <div className="min-h-screen bg-background p-4 pb-24 space-y-4">
      <PageGuide
        title="Webhook Logs"
        summary="See every webhook delivery to your endpoints, with status codes, timestamps, and retries."
        steps={[
          { title: 'Find a delivery', description: 'Browse the most recent attempts; failed deliveries appear at the top.' },
          { title: 'Inspect the payload', description: 'Open a row to view the request body, response, and HTTP status.' },
          { title: 'Fix and replay', description: 'Update your endpoint, then trigger a retry to confirm successful delivery.' },
        ]}
        learnMoreHref="/developer/webhooks"
      />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Webhook Logs</h1>
          <p className="text-sm text-muted-foreground">Recent delivery attempts</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : !logs?.length ? (
        <Card><CardContent className="py-12 text-center">
          <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No webhook deliveries yet</p>
          <p className="text-sm text-muted-foreground mt-1">Configure webhooks in Settings to start receiving event notifications</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/biz/webhooks")}>Configure Webhooks</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log: any) => (
            <Card key={log.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{log.event_type || "webhook.event"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{log.endpoint_url || log.url}</p>
                    <p className="text-xs text-muted-foreground mt-1">{log.created_at ? format(new Date(log.created_at), "MMM d, HH:mm:ss") : ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={log.success ? "default" : "destructive"} className="text-xs">
                      {log.success ? "Delivered" : `Failed${log.status_code ? ` (${log.status_code})` : ""}`}
                    </Badge>
                    {log.latency_ms && <span className="text-xs text-muted-foreground">{log.latency_ms}ms</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
