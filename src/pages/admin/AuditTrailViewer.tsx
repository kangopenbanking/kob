import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Filter, Search, Calendar, Eye} from "lucide-react";
import { format } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type ActionType = "all" | "create" | "update" | "delete" | "login" | "logout" | "payment" | "consent";

export default function AuditTrailViewer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionType>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { toast } = useToast();

  const { data: auditLogs, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", actionFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(500);

      if (actionFilter !== "all") {
        query = query.eq("action_type", actionFilter);
      }

      if (startDate) {
        query = query.gte("created_at", new Date(startDate).toISOString());
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        query = query.lte("created_at", end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredLogs = auditLogs?.filter((log) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      log.action_type.toLowerCase().includes(searchLower) ||
      log.entity_type.toLowerCase().includes(searchLower) ||
      (log.profiles as any)?.email?.toLowerCase().includes(searchLower)
    );
  });

  const exportToCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const headers = ["Timestamp", "User", "Action", "Entity Type", "Entity ID", "IP Address"];
    const rows = filteredLogs.map((log) => [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      (log.profiles as any)?.email || "System",
      log.action_type,
      log.entity_type,
      log.entity_id,
      log.ip_address || "N/A",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Audit trail exported successfully" });
  };

  const exportToJSON = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }

    const jsonContent = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Audit trail exported successfully" });
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("delete") || action.includes("revoke")) return "destructive";
    if (action.includes("create") || action.includes("approve")) return "default";
    if (action.includes("update") || action.includes("modify")) return "secondary";
    return "outline";
  };

  const stats = {
    total: filteredLogs?.length || 0,
    creates: filteredLogs?.filter((l) => l.action_type.includes("create")).length || 0,
    updates: filteredLogs?.filter((l) => l.action_type.includes("update")).length || 0,
    deletes: filteredLogs?.filter((l) => l.action_type.includes("delete")).length || 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminPageHeader icon={Eye} title="Audit Trail Viewer" description="Detailed audit event viewer with advanced filtering" />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={exportToJSON} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Events</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">{stats.creates}</div>
          <div className="text-sm text-muted-foreground">Creates</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.updates}</div>
          <div className="text-sm text-muted-foreground">Updates</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-600">{stats.deletes}</div>
          <div className="text-sm text-muted-foreground">Deletes</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ActionType)}>
            <SelectTrigger>
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="consent">Consent</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              placeholder="Start date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <Input
            type="date"
            placeholder="End date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </Card>

      {/* Timeline View */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Timeline</h2>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4 pl-12">
            {isLoading ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : filteredLogs?.length === 0 ? (
              <p className="text-center text-muted-foreground">No audit logs found</p>
            ) : (
              filteredLogs?.slice(0, 50).map((log) => (
                <div key={log.id} className="relative">
                  <div className="absolute -left-10 mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                  <div className="border rounded-lg p-4 hover:bg-accent transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getActionBadgeVariant(log.action_type)}>
                            {log.action_type}
                          </Badge>
                          <span className="text-sm font-medium">{log.entity_type}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          by {(log.profiles as any)?.email || "System"}
                        </p>
                        {log.details && (
                          <p className="text-xs text-muted-foreground font-mono mt-2">
                            {JSON.stringify(log.details).substring(0, 100)}...
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {format(new Date(log.created_at), "MMM d, yyyy")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Detailed Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs?.slice(0, 100).map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-xs">
                  {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                </TableCell>
                <TableCell>{(log.profiles as any)?.email || "System"}</TableCell>
                <TableCell>
                  <Badge variant={getActionBadgeVariant(log.action_type)}>
                    {log.action_type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{log.entity_type}</TableCell>
                <TableCell className="font-mono text-xs">{log.ip_address || "N/A"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
