import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { CheckCircle2, XCircle, Pause, Eye, Building2, Calendar, DollarSign, CheckCircle} from "lucide-react";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function SettlementApproval() {
  const queryClient = useQueryClient();
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: settlements, isLoading } = useQuery({
    queryKey: ["settlement-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settlement_transactions")
        .select(`
          *,
          institutions (institution_name)
        `)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const approveSettlement = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-approve-settlement", {
        body: { settlement_id: id, action: "approved", notes },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlement-approvals"] });
      toast({ title: "Settlement approved", description: "Bank transfer will be initiated shortly." });
    },
    onError: (error: any) => {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    },
  });

  const rejectSettlement = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-approve-settlement", {
        body: { settlement_id: id, action: "rejected", notes },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlement-approvals"] });
      toast({ title: "Settlement rejected", description: "Institution will be notified." });
    },
    onError: (error: any) => {
      toast({ title: "Rejection failed", description: error.message, variant: "destructive" });
    },
  });

  const holdSettlement = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-approve-settlement", {
        body: { settlement_id: id, action: "on_hold", notes },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlement-approvals"] });
      toast({ title: "Settlement on hold", description: "Settlement flagged for review." });
    },
    onError: (error: any) => {
      toast({ title: "Hold failed", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
      <AdminPageHeader icon={CheckCircle} title="Settlement Approval" description="Review and approve pending institutional settlements" />

        <div className="grid gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settlement Approval</h1>
        <p className="text-muted-foreground">Review and approve pending institutional settlements</p>
      </div>

      <div className="grid gap-4">
        {settlements?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No pending settlements require approval
            </CardContent>
          </Card>
        )}

        {settlements?.map((settlement) => (
          <Card key={settlement.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {settlement.institutions?.institution_name || "Unknown Institution"}
                  </CardTitle>
                  <CardDescription>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(settlement.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {Number(settlement.net_settlement_amount || 0).toLocaleString()} XAF
                      </span>
                    </div>
                  </CardDescription>
                </div>
                <Badge variant="secondary">Pending Approval</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Inflows</span>
                  <span className="font-medium">{Number(settlement.total_inflows || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Outflows</span>
                  <span className="font-medium">{Number(settlement.total_outflows || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">KOB Fees</span>
                  <span className="font-medium">{Number(settlement.kob_fees_charged || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span>Net Settlement</span>
                  <span>{Number(settlement.net_settlement_amount || 0).toLocaleString()} XAF</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedSettlement(settlement);
                    setDetailsOpen(true);
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Details
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => approveSettlement.mutate({ id: settlement.id })}
                  disabled={approveSettlement.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const reason = prompt("Reason for holding settlement:");
                    if (reason) holdSettlement.mutate({ id: settlement.id, notes: reason });
                  }}
                  disabled={holdSettlement.isPending}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Hold
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    const reason = prompt("Reason for rejection:");
                    if (reason) rejectSettlement.mutate({ id: settlement.id, notes: reason });
                  }}
                  disabled={rejectSettlement.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <TransactionDetailSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        transaction={selectedSettlement}
      />
    </div>
  );
}
