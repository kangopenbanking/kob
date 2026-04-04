import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Users, ArrowUpDown, Server, FileText, Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function BankDashboardHome() {
  const { data: banks } = useQuery({
    queryKey: ["banking-banks"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("banking-api-router", {
        body: { action: "list_banks" },
      });
      return data?.data || [];
    },
  });

  const { data: apiLogs } = useQuery({
    queryKey: ["banking-api-logs-summary"],
    queryFn: async () => {
      const { data } = await supabase
        .from("banking_api_logs")
        .select("id, status_code, response_time_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const totalRequests = apiLogs?.length || 0;
  const avgResponseTime = apiLogs?.length
    ? Math.round(apiLogs.reduce((s, l) => s + (l.response_time_ms || 0), 0) / apiLogs.length)
    : 0;
  const successRate = apiLogs?.length
    ? Math.round((apiLogs.filter(l => l.status_code < 400).length / apiLogs.length) * 100)
    : 100;

  const metrics = [
    { title: "Connected Banks", value: banks?.length || 0, icon: Server, color: "text-primary" },
    { title: "API Requests (Recent)", value: totalRequests, icon: Activity, color: "text-primary" },
    { title: "Avg Response Time", value: `${avgResponseTime}ms`, icon: ArrowUpDown, color: "text-primary" },
    { title: "Success Rate", value: `${successRate}%`, icon: Shield, color: "text-primary" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Bank Dashboard</h1>
        <p className="text-muted-foreground">Unified Banking API overview for connected institutions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.title} className="border border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.title}</CardTitle>
              <m.icon className={`h-4 w-4 ${m.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Connected Banks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!banks?.length ? (
              <p className="text-sm text-muted-foreground">No banks connected yet. Use the Connector Setup to onboard a bank.</p>
            ) : (
              <div className="space-y-3">
                {banks.map((bank: any) => (
                  <div key={bank.id} className="flex items-center justify-between rounded-lg border border-border/30 p-3">
                    <div>
                      <p className="font-medium text-sm">{bank.name}</p>
                      <p className="text-xs text-muted-foreground">{bank.country_code} -- {bank.swift_bic || "N/A"}</p>
                    </div>
                    <Badge variant={bank.is_active ? "default" : "secondary"}>
                      {bank.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Recent API Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!apiLogs?.length ? (
              <p className="text-sm text-muted-foreground">No API activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {apiLogs.slice(0, 8).map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">{log.endpoint || "N/A"}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={log.status_code < 400 ? "default" : "destructive"} className="text-xs">
                        {log.status_code}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{log.response_time_ms}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
