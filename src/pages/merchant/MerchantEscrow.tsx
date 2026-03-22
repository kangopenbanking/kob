import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Loader2, RefreshCw, Wallet, PlusCircle, ArrowDownCircle, History, ShieldCheck, Lock } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { useMerchantContext } from "@/hooks/useMerchantContext";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function MerchantEscrow() {
  const { merchantId, isLoading: ctxLoading } = useMerchantContext();
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEscrow, setSelectedEscrow] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEscrow, setNewEscrow] = useState({ escrow_label: "", parent_wallet_id: "", currency: "XAF" });

  // Fund dialog
  const [fundOpen, setFundOpen] = useState(false);
  const [funding, setFunding] = useState(false);
  const [fundData, setFundData] = useState({ amount: "", reference: "", description: "" });

  useEffect(() => { if (merchantId) loadEscrows(); }, [merchantId]);

  const loadEscrows = async () => {
    if (!merchantId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gateway-escrow-wallets", { method: "GET" });
    if (data?.escrows) setEscrows(data.escrows);
    else if (Array.isArray(data)) setEscrows(data);
    else setEscrows([]);
    setLoading(false);
  };

  const loadTransactions = async (escrowId: string) => {
    setTxLoading(true);
    const { data } = await supabase.functions.invoke("gateway-escrow-wallets", {
      method: "GET",
      body: { action: "transactions", escrow_id: escrowId },
    });
    setTransactions(data?.transactions || []);
    setTxLoading(false);
  };

  const openDetail = (escrow: any) => {
    setSelectedEscrow(escrow);
    loadTransactions(escrow.id);
  };

  const handleCreate = async () => {
    if (!merchantId || !newEscrow.escrow_label || !newEscrow.parent_wallet_id) {
      toast({ title: "Missing fields", description: "Label and parent wallet ID are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("gateway-escrow-wallets", {
        body: { merchant_id: merchantId, ...newEscrow },
      });
      if (error) throw error;
      if (data?.type) throw new Error(data.detail || data.title);
      toast({ title: "Escrow created", description: `"${newEscrow.escrow_label}" escrow wallet created.` });
      setCreateOpen(false);
      setNewEscrow({ escrow_label: "", parent_wallet_id: "", currency: "XAF" });
      await loadEscrows();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleFund = async () => {
    if (!selectedEscrow || !fundData.amount) return;
    setFunding(true);
    try {
      const { data, error } = await supabase.functions.invoke("gateway-escrow-wallets", {
        body: { action: "fund", escrow_id: selectedEscrow.id, amount: Number(fundData.amount), reference: fundData.reference, description: fundData.description },
      });
      if (error) throw error;
      if (data?.type) throw new Error(data.detail || data.title);
      toast({ title: "Escrow funded", description: `${Number(fundData.amount).toLocaleString()} ${selectedEscrow.currency} added to escrow.` });
      setFundOpen(false);
      setFundData({ amount: "", reference: "", description: "" });
      await loadEscrows();
      loadTransactions(selectedEscrow.id);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setFunding(false);
    }
  };

  const totalHeld = escrows.reduce((sum, e) => sum + (e.held_amount || 0), 0);
  const totalReleased = escrows.reduce((sum, e) => sum + (e.released_amount || 0), 0);
  const activeCount = escrows.filter(e => e.status === "active").length;
  const frozenCount = escrows.filter(e => e.status === "frozen").length;

  if (ctxLoading || loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Escrow Wallets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Hold, release, and manage escrowed funds for secure transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />New Escrow
          </Button>
          <Button variant="outline" size="sm" onClick={loadEscrows} className="gap-2">
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Escrows" value={escrows.length.toLocaleString()} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Total Held" value={`${totalHeld.toLocaleString()} XAF`} icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard title="Total Released" value={`${totalReleased.toLocaleString()} XAF`} icon={<ArrowDownCircle className="h-5 w-5" />} />
        <StatCard title="Active / Frozen" value={`${activeCount} / ${frozenCount}`} icon={<Lock className="h-5 w-5" />} />
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        {escrows.length === 0 ? (
          <Card><CardContent className="py-12">
            <EmptyState icon={<Wallet className="h-6 w-6 text-muted-foreground" />} title="No escrow wallets" description="Create an escrow wallet to securely hold funds for marketplace or service transactions." action={{ label: "Create Escrow Wallet", onClick: () => setCreateOpen(true) }} />
          </CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {escrows.map(e => {
              const available = (e.held_amount || 0) - (e.released_amount || 0) - (e.refunded_amount || 0);
              return (
                <Card key={e.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => openDetail(e)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{e.escrow_label || "Untitled"}</CardTitle>
                      <Badge variant={e.status === "active" ? "default" : e.status === "frozen" ? "destructive" : "secondary"}>{e.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Held</span>
                      <span className="font-semibold">{(e.held_amount || 0).toLocaleString()} {e.currency}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Available</span>
                      <span className="font-semibold">{available.toLocaleString()} {e.currency}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Released</span>
                      <span>{(e.released_amount || 0).toLocaleString()} {e.currency}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">{e.created_at ? format(new Date(e.created_at), "MMM d, yyyy") : ""}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Escrow Detail Sheet */}
      <Sheet open={!!selectedEscrow} onOpenChange={o => !o && setSelectedEscrow(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selectedEscrow && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  {selectedEscrow.escrow_label}
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">{selectedEscrow.id}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {((selectedEscrow.held_amount || 0) - (selectedEscrow.released_amount || 0) - (selectedEscrow.refunded_amount || 0)).toLocaleString()} {selectedEscrow.currency}
                  </span>
                  <Badge variant={selectedEscrow.status === "active" ? "default" : "destructive"}>{selectedEscrow.status}</Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  {[
                    ["Total Held", `${(selectedEscrow.held_amount || 0).toLocaleString()} ${selectedEscrow.currency}`],
                    ["Released", `${(selectedEscrow.released_amount || 0).toLocaleString()} ${selectedEscrow.currency}`],
                    ["Refunded", `${(selectedEscrow.refunded_amount || 0).toLocaleString()} ${selectedEscrow.currency}`],
                    ["Parent Wallet", selectedEscrow.parent_wallet_id?.slice(0, 12) + "..."],
                    ["Created", selectedEscrow.created_at ? format(new Date(selectedEscrow.created_at), "MMM d, yyyy HH:mm") : null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex justify-between py-1.5">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium">{value}</span>
                    </div>
                  ))}
                </div>
                {selectedEscrow.status === "active" && (
                  <>
                    <Separator />
                    <Button size="sm" className="w-full gap-2" onClick={() => setFundOpen(true)}>
                      <ArrowDownCircle className="h-4 w-4" /> Fund Escrow
                    </Button>
                  </>
                )}
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><History className="h-4 w-4" /> Transaction History</h3>
                  {txLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between border rounded-lg p-3">
                          <div>
                            <Badge variant={tx.transaction_type === "fund" ? "default" : tx.transaction_type === "release" ? "secondary" : "outline"} className="text-xs mb-1">
                              {tx.transaction_type}
                            </Badge>
                            <p className="text-xs text-muted-foreground">{tx.created_at ? format(new Date(tx.created_at), "MMM d, HH:mm") : ""}</p>
                          </div>
                          <span className="font-semibold text-sm">
                            {tx.transaction_type === "fund" ? "+" : "-"}{(tx.amount || 0).toLocaleString()} {tx.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Escrow Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Escrow Wallet</DialogTitle>
            <DialogDescription>Set up a secure escrow wallet to hold funds for a transaction or agreement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Escrow Label *</Label>
              <Input placeholder="e.g. Order #1234 Escrow" value={newEscrow.escrow_label} onChange={e => setNewEscrow(s => ({ ...s, escrow_label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Parent Wallet ID *</Label>
              <Input placeholder="Account/wallet UUID to fund from" value={newEscrow.parent_wallet_id} onChange={e => setNewEscrow(s => ({ ...s, parent_wallet_id: e.target.value }))} />
              <p className="text-xs text-muted-foreground">The wallet that will fund this escrow.</p>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value={newEscrow.currency} onChange={e => setNewEscrow(s => ({ ...s, currency: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}Create Escrow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fund Escrow Dialog */}
      <Dialog open={fundOpen} onOpenChange={setFundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fund Escrow</DialogTitle>
            <DialogDescription>Transfer funds from the parent wallet into this escrow.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount ({selectedEscrow?.currency || "XAF"}) *</Label>
              <Input type="number" min="1" placeholder="0" value={fundData.amount} onChange={e => setFundData(s => ({ ...s, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input placeholder="Payment or order reference" value={fundData.reference} onChange={e => setFundData(s => ({ ...s, reference: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="What is this escrow funding for?" value={fundData.description} onChange={e => setFundData(s => ({ ...s, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundOpen(false)}>Cancel</Button>
            <Button onClick={handleFund} disabled={funding} className="gap-2">
              {funding && <Loader2 className="h-4 w-4 animate-spin" />}Fund Escrow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
