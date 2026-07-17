import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, XCircle, Clock, RefreshCw, Bell} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Severity = "info" | "warning" | "error" | "critical";
type Status = "active" | "acknowledged" | "resolved";

export default function SystemAlerts() {
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: ["system-alerts", severityFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("system_alerts")
        .select("*")
        .order("created_at", { ascending: false });

      if (severityFilter !== "all") {
        query = query.eq("severity", severityFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  });

  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("system_alerts")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id
        })
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-alerts"] });
      toast({ title: "Alert acknowledged" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to acknowledge alert",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resolveAlert = useMutation({
    mutationFn: async ({ alertId, resolution }: { alertId: string; resolution: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("system_alerts")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_notes: resolution
        } as any)
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-alerts"] });
      toast({ title: "Alert resolved" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resolve alert",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const getSeverityIcon = (severity: Severity) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: Severity) => {
    const variants: Record<Severity, any> = {
      critical: "destructive",
      error: "destructive",
      warning: "default",
      info: "secondary"
    };
    return <Badge variant={variants[severity]}>{severity.toUpperCase()}</Badge>;
  };

  const getStatusBadge = (status: Status) => {
    const colors: Record<Status, string> = {
      active: "bg-red-500",
      acknowledged: "bg-yellow-500",
      resolved: "bg-green-500"
    };
    return (
      <Badge className={colors[status]}>
        {status === "active" && <Clock className="mr-1 h-3 w-3" />}
        {status === "acknowledged" && <AlertCircle className="mr-1 h-3 w-3" />}
        {status === "resolved" && <CheckCircle2 className="mr-1 h-3 w-3" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const stats = {
    total: alerts?.length || 0,
    active: alerts?.filter(a => a.status === "active").length || 0,
    acknowledged: alerts?.filter(a => a.status === "acknowledged").length || 0,
    resolved: alerts?.filter(a => a.status === "resolved").length || 0,
    critical: alerts?.filter(a => a.severity === "critical").length || 0
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminPageHeader icon={Bell} title="System Alerts" description="Monitor and manage system alerts in real-time" />

      <div className="flex items-center justify-between">
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Alerts</div>
        </Card>
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="text-2xl font-bold text-red-600">{stats.active}</div>
          <div className="text-sm text-red-700">Active</div>
        </Card>
        <Card className="p-4 border-yellow-200 bg-yellow-50">
          <div className="text-2xl font-bold text-yellow-600">{stats.acknowledged}</div>
          <div className="text-sm text-yellow-700">Acknowledged</div>
        </Card>
        <Card className="p-4 border-green-200 bg-green-50">
          <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          <div className="text-sm text-green-700">Resolved</div>
        </Card>
        <Card className="p-4 border-red-300 bg-red-100">
          <div className="text-2xl font-bold text-red-700">{stats.critical}</div>
          <div className="text-sm text-red-800">Critical</div>
        </Card>
      </div>

      <div className="flex gap-4">
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Alert Type</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">Loading alerts...</TableCell>
              </TableRow>
            ) : alerts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <p className="text-muted-foreground">No alerts found</p>
                </TableCell>
              </TableRow>
            ) : (
              alerts?.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>{getSeverityIcon(alert.severity as Severity)}</TableCell>
                  <TableCell className="font-medium">{alert.alert_type}</TableCell>
                  <TableCell className="max-w-md truncate">{alert.message}</TableCell>
                  <TableCell>{getSeverityBadge(alert.severity as Severity)}</TableCell>
                  <TableCell>{getStatusBadge(alert.status as Status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(alert.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {alert.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => acknowledgeAlert.mutate(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {alert.status !== "resolved" && (
                        <Button
                          size="sm"
                          onClick={() => resolveAlert.mutate({ 
                            alertId: alert.id, 
                            resolution: "Resolved by admin" 
                          })}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
