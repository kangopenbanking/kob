import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Banknote, Clock, CheckCircle, XCircle, RefreshCw, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

export default function PayoutManagement() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["admin-payouts", statusFilter],
    queryFn: async () => {
      let query = supabase.from("payouts").select("*, institutions(institution_name)").order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updatePayout = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "completed") updates.completed_at = new Date().toISOString();
      if (status === "processing") updates.processed_at = new Date().toISOString();
      const { error } = await supabase.from("payouts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
      toast.success("Payout updated");
    },
    onError: () => toast.error("Failed to update payout"),
  });

  const stats = {
    total: payouts?.length || 0,
    pending: payouts?.filter((p) => p.status === "pending").length || 0,
    processing: payouts?.filter((p) => p.status === "processing").length || 0,
    completed: payouts?.filter((p) => p.status === "completed").length || 0,
    totalAmount: payouts?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
  };

  const formatCurrency = (amount: number, currency: string = "XAF") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      processing: { variant: "secondary", icon: RefreshCw },
      completed: { variant: "default", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle },
    };
    const cfg = map[status] || map.pending;
    const Icon = cfg.icon;
    return <Badge variant={cfg.variant}><Icon className="h-3 w-3 mr-1" />{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payout Management</h1>
        <p className="text-muted-foreground mt-2">Manage scheduled payouts and settlements to institutions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Payouts</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Completed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{stats.completed}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Volume</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle>Payouts</CardTitle><CardDescription>Process and track institution payouts</CardDescription></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading payouts...</p>
          ) : payouts?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No payouts found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts?.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-xs">{format(new Date(payout.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{(payout.institutions as any)?.institution_name || "Unknown"}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(payout.amount, payout.currency)}</TableCell>
                    <TableCell><Badge variant="outline">{payout.payout_method}</Badge></TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell className="font-mono text-xs">{payout.reference || "—"}</TableCell>
                    <TableCell>
                      {payout.status === "pending" && (
                        <Button size="sm" onClick={() => updatePayout.mutate({ id: payout.id, status: "processing" })}>
                          <ArrowUpRight className="h-3 w-3 mr-1" />Process
                        </Button>
                      )}
                      {payout.status === "processing" && (
                        <Button size="sm" variant="default" onClick={() => updatePayout.mutate({ id: payout.id, status: "completed" })}>
                          <CheckCircle className="h-3 w-3 mr-1" />Complete
                        </Button>
                      )}
                      {payout.status === "failed" && (
                        <Button size="sm" variant="outline" onClick={() => updatePayout.mutate({ id: payout.id, status: "pending" })}>
                          <RefreshCw className="h-3 w-3 mr-1" />Retry
                        </Button>
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
