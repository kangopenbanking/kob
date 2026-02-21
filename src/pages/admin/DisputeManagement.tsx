import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Scale, Search, AlertTriangle, CheckCircle, Clock, XCircle, Plus } from "lucide-react";
import { format } from "date-fns";

export default function DisputeManagement() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [resolution, setResolution] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);

  const { data: disputes, isLoading } = useQuery({
    queryKey: ["admin-disputes", statusFilter],
    queryFn: async () => {
      let query = supabase.from("disputes").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, status, resolution }: { id: string; status: string; resolution: string }) => {
      const { error } = await supabase
        .from("disputes")
        .update({ status, resolution, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      toast.success("Dispute updated successfully");
      setSelectedDispute(null);
      setResolution("");
    },
    onError: () => toast.error("Failed to update dispute"),
  });

  const filteredDisputes = disputes?.filter((d) =>
    !searchTerm || d.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.transaction_ref?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: disputes?.length || 0,
    open: disputes?.filter((d) => d.status === "open").length || 0,
    investigating: disputes?.filter((d) => d.status === "investigating").length || 0,
    resolved: disputes?.filter((d) => d.status === "resolved").length || 0,
    rejected: disputes?.filter((d) => d.status === "rejected").length || 0,
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      open: { variant: "outline", icon: Clock },
      investigating: { variant: "secondary", icon: Search },
      resolved: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
    };
    const config = variants[status] || variants.open;
    const Icon = config.icon;
    return <Badge variant={config.variant}><Icon className="h-3 w-3 mr-1" />{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dispute & Chargeback Management</h1>
        <p className="text-muted-foreground mt-2">Manage payment disputes, refunds, and chargebacks across the platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Disputes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Open</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats.open}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Investigating</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{stats.investigating}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Resolved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{stats.resolved}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Disputes</CardTitle>
              <CardDescription>Review and resolve payment disputes</CardDescription>
            </div>
          </div>
          <div className="flex gap-4 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by reason or reference..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading disputes...</p>
          ) : filteredDisputes?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No disputes found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDisputes?.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell className="font-mono text-xs">{format(new Date(dispute.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell><Badge variant="outline">{dispute.dispute_type}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{dispute.reason}</TableCell>
                    <TableCell className="font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: dispute.currency }).format(dispute.amount)}</TableCell>
                    <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                    <TableCell className="font-mono text-xs">{dispute.transaction_ref || "N/A"}</TableCell>
                    <TableCell>
                      {dispute.status === "open" || dispute.status === "investigating" ? (
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="outline">Resolve</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Resolve Dispute</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                              <div><Label>Resolution Notes</Label><Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Enter resolution details..." /></div>
                              <div className="flex gap-2">
                                <Button onClick={() => resolveMutation.mutate({ id: dispute.id, status: "resolved", resolution })} className="flex-1">Approve Refund</Button>
                                <Button variant="destructive" onClick={() => resolveMutation.mutate({ id: dispute.id, status: "rejected", resolution })} className="flex-1">Reject</Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <span className="text-xs text-muted-foreground">{dispute.resolution || "—"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
