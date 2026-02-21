import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Bell, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function InstitutionAlerts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data } = await supabase.from("system_alerts").select("*").order("created_at", { ascending: false }).limit(200);
      setAlerts(data || []);
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("system_alerts").update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id,
      }).eq("id", id);
      if (error) throw error;
      toast({ title: "Alert acknowledged" });
      loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
  };

  const severityColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "critical" || s === "error") return "destructive";
    if (s === "warning") return "outline";
    return "secondary";
  };

  const active = alerts.filter(a => a.status === "active").length;
  const critical = alerts.filter(a => a.severity === "critical").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><Bell className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">System Alerts</h1>
            <p className="text-xs text-muted-foreground">Monitor and acknowledge system notifications</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Alerts", value: alerts.length, icon: Bell },
          { label: "Active", value: active, icon: AlertTriangle },
          { label: "Critical", value: critical, icon: AlertTriangle },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted"><s.icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-sm font-semibold">Alerts</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Bell className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No system alerts</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Message</TableHead><TableHead className="text-xs">Severity</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{alerts.map(a => (
                <TableRow key={a.id}>
                  <TableCell><Badge variant="outline" className="text-[10px]">{a.alert_type}</Badge></TableCell>
                  <TableCell className="text-sm max-w-[250px] truncate">{a.message}</TableCell>
                  <TableCell><Badge variant={severityColor(a.severity)} className="text-[10px]">{a.severity}</Badge></TableCell>
                  <TableCell><Badge variant={a.status === "active" ? "outline" : a.status === "acknowledged" ? "secondary" : "default"} className="text-[10px]">{a.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'PP')}</TableCell>
                  <TableCell>
                    {a.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={() => handleAcknowledge(a.id)} className="h-7 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />Ack
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
