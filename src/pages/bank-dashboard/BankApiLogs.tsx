import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Clock } from "lucide-react";

export default function BankApiLogs() {
  const { data: logs } = useQuery({
    queryKey: ["banking-api-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("banking_api_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API Logs</h1>
        <p className="text-muted-foreground">Real-time request and response audit trail for the Banking API</p>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Requests
            <Badge variant="outline" className="ml-2 text-xs">{logs?.length || 0} entries</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/5">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Endpoint</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Response Time</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Client</th>
                </tr>
              </thead>
              <tbody>
                {!logs?.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No API logs yet. Make requests to the Banking API to see logs here.
                    </td>
                  </tr>
                ) : (
                  logs.map((log: any) => (
                    <tr key={log.id} className="border-b border-border/20 hover:bg-muted/5">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs font-mono">{log.method}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate">{log.endpoint}</td>
                      <td className="px-4 py-3">
                        <Badge variant={log.status_code < 400 ? "default" : "destructive"} className="text-xs">
                          {log.status_code}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{log.response_time_ms}ms</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[120px]">{log.client_id?.slice(0, 12)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
