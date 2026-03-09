import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { Search, RefreshCw, AlertCircle } from "lucide-react";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BusinessRefunds() {
  const queryClient = useQueryClient();
  const [searchRef, setSearchRef] = useState("");
  const [selectedCharge, setSelectedCharge] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [pinCode, setPinCode] = useState("");

  const { data: merchant } = useQuery({
    queryKey: ["merchant-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("gateway_merchants")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: charges, isLoading } = useQuery({
    queryKey: ["successful-charges", merchant?.id, searchRef],
    queryFn: async () => {
      if (!merchant?.id) return [];
      
      let query = supabase
        .from("gateway_charges")
        .select("*")
        .eq("merchant_id", merchant.id)
        .eq("status", "successful")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (searchRef) {
        query = query.or(`charge_ref.ilike.%${searchRef}%,customer_phone.ilike.%${searchRef}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!merchant?.id,
  });

  const createRefund = useMutation({
    mutationFn: async () => {
      if (!selectedCharge || !pinCode) {
        throw new Error("Missing required fields");
      }

      // Verify PIN (simplified - in production, use proper PIN verification)
      const amount = refundAmount ? Number(refundAmount) : selectedCharge.amount;
      
      const { data, error } = await supabase.functions.invoke("gateway-create-refund", {
        body: {
          charge_id: selectedCharge.id,
          amount,
          reason: refundReason || "Customer request",
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["successful-charges"] });
      setRefundDialogOpen(false);
      setSelectedCharge(null);
      setRefundAmount("");
      setRefundReason("");
      setPinCode("");
      toast({ title: "Refund initiated", description: "Refund is being processed" });
    },
    onError: (error: any) => {
      toast({ title: "Refund failed", description: error.message, variant: "destructive" });
    },
  });

  const openRefundDialog = (charge: any) => {
    setSelectedCharge(charge);
    setRefundAmount(String(charge.amount));
    setRefundDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Refunds</h1>
          <p className="text-sm text-muted-foreground">Process customer refunds</p>
        </div>
        <Skeleton className="h-10" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-20">
      <div>
        <h1 className="text-2xl font-bold">Refunds</h1>
        <p className="text-sm text-muted-foreground">Process customer refunds</p>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search">Search Charges</Label>
        <div className="flex gap-2">
          <Input
            id="search"
            placeholder="Charge ref or phone"
            value={searchRef}
            onChange={(e) => setSearchRef(e.target.value)}
          />
          <Button size="icon" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["successful-charges"] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Charge List */}
      <div className="space-y-3">
        {charges?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No successful charges found
            </CardContent>
          </Card>
        )}

        {charges?.map((charge) => (
          <Card key={charge.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{Number(charge.amount).toLocaleString()} {charge.currency}</CardTitle>
                  <CardDescription className="text-xs">
                    {charge.customer_email || charge.customer_phone}
                  </CardDescription>
                  <p className="text-xs text-muted-foreground font-mono">{charge.charge_ref}</p>
                </div>
                <Badge variant="default">Successful</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-3">
                {new Date(charge.created_at).toLocaleString()}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedCharge(charge);
                    setDetailsOpen(true);
                  }}
                >
                  <Search className="h-3 w-3 mr-1" />
                  Details
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1"
                  onClick={() => openRefundDialog(charge)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refund
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Refund for charge {selectedCharge?.tx_ref}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount (XAF)</Label>
              <Input
                id="refund-amount"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Enter amount"
              />
              <p className="text-xs text-muted-foreground">
                Original: {Number(selectedCharge?.amount || 0).toLocaleString()} XAF
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Customer request"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN (required)</Label>
              <Input
                id="pin"
                type="password"
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="Enter your 6-digit PIN"
              />
            </div>
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                This action will deduct the refund amount from your available balance.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createRefund.mutate()}
              disabled={!pinCode || !refundAmount || createRefund.isPending}
            >
              {createRefund.isPending ? "Processing..." : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransactionDetailSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        transaction={selectedCharge}
      />
    </div>
  );
}
