import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, RefreshCw, AlertCircle, ChevronRight } from "lucide-react";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PageGuide } from '@/components/business-app/PageGuide';

export default function BusinessRefunds() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
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
      const { data, error } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: charges, isLoading } = useQuery({
    queryKey: ["successful-charges", merchant?.id, searchRef],
    queryFn: async () => {
      if (!merchant?.id) return [];
      let query = supabase.from("gateway_charges").select("*").eq("merchant_id", merchant.id).eq("status", "successful").order("created_at", { ascending: false }).limit(50);
      if (searchRef) query = query.or(`tx_ref.ilike.%${searchRef}%,customer_phone.ilike.%${searchRef}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!merchant?.id,
  });

  const createRefund = useMutation({
    mutationFn: async () => {
      if (!selectedCharge || !pinCode) throw new Error("Missing required fields");
      const amount = refundAmount ? Number(refundAmount) : selectedCharge.amount;
      const { data, error } = await supabase.functions.invoke("gateway-create-refund", {
        body: { charge_id: selectedCharge.id, amount, reason: refundReason || "Customer request" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data: any) => {
      queryClient.invalidateQueries({ queryKey: ["successful-charges"] });
      setRefundDialogOpen(false); setSelectedCharge(null);
      setRefundAmount(""); setRefundReason(""); setPinCode("");
      toast.success(`Refund of ${Number(refundAmount || selectedCharge?.amount).toLocaleString()} XAF initiated. Customer will be credited within 1–3 business days.`);
    },
    onError: (error: any) => toast.error(extractEdgeFunctionError(error, "Refund could not be processed. Please verify the charge and try again.")),
  });

  const openRefundDialog = (charge: any) => {
    setSelectedCharge(charge);
    setRefundAmount(String(charge.amount));
    setRefundDialogOpen(true);
  };

  const formatXAF = (n: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <PageGuide
        title="Refunds"
        summary="Issue full or partial refunds to customers and keep a record of every reversal."
        steps={[
          { title: 'Find the original charge', description: 'Search by reference number to locate the successful payment you want to refund.' },
          { title: 'Enter amount and reason', description: 'Refund the full amount or a partial value, and add an internal reason for audit.' },
          { title: 'Confirm with PIN', description: 'Refunds require your secure PIN; the customer is paid back through the original method.' },
        ]}
        learnMoreHref="/developer/gateway/refunds"
      />
      {/* Header */}
      <header className="pt-4 md:pt-0 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Refunds</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Process customer refunds</p>
          </div>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ["successful-charges"] })} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors">
            <RefreshCw className="h-4 w-4 text-foreground" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={2} />
        <Input placeholder="Search by ref or phone..." value={searchRef} onChange={(e) => setSearchRef(e.target.value)} className="pl-9 h-10 rounded-xl border-border/50 bg-muted/40 text-sm" />
      </div>

      {/* Charge List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !charges?.length ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
            <RefreshCw className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No successful charges found</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {charges.map((charge: any, i: number) => (
              <motion.div
                key={charge.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
                className="rounded-2xl border border-border/40 bg-card p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-bold text-foreground">{formatXAF(Number(charge.amount))}</p>
                      <Badge variant="default" className="text-[10px]">Successful</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {charge.customer_email || charge.customer_phone}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{charge.tx_ref}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(charge.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl h-9 text-xs font-semibold border-border/50 gap-1.5"
                    onClick={() => { setSelectedCharge(charge); setDetailsOpen(true); }}>
                    <Search className="h-3 w-3" /> Details
                  </Button>
                  <Button size="sm" className="flex-1 rounded-xl h-9 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                    onClick={() => openRefundDialog(charge)}>
                    <RefreshCw className="h-3 w-3" /> Refund
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Refund Sheet */}
      <Sheet open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn(
          isMobile ? 'max-h-[85vh] rounded-t-[2rem] border-t-0' : 'w-[420px]',
          'overflow-y-auto px-5 pb-10',
        )}>
          <SheetHeader className="pb-2">
            {isMobile && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />}
            <SheetTitle className="text-left">Process Refund</SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground mb-4">Refund for charge {selectedCharge?.tx_ref}</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Refund Amount (XAF)</label>
              <Input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Enter amount" className="rounded-xl h-11" />
              <p className="text-[11px] text-muted-foreground mt-1">Original: {formatXAF(Number(selectedCharge?.amount || 0))}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reason (optional)</label>
              <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Customer request" className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">PIN (required)</label>
              <Input type="password" maxLength={6} value={pinCode} onChange={(e) => setPinCode(e.target.value)} placeholder="Enter your 6-digit PIN" className="rounded-xl" />
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">This action will deduct the refund amount from your available balance.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setRefundDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1 rounded-xl h-11 bg-foreground text-background hover:bg-foreground/90" onClick={() => createRefund.mutate()} disabled={!pinCode || !refundAmount || createRefund.isPending}>
                {createRefund.isPending ? "Processing..." : "Confirm Refund"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TransactionDetailSheet open={detailsOpen} onOpenChange={setDetailsOpen} transaction={selectedCharge} />
    </div>
  );
}
