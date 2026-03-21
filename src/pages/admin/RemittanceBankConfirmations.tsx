import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle, Search, Banknote, Activity,
} from "lucide-react";

export default function RemittanceBankConfirmations() {
  const queryClient = useQueryClient();
  const [confirmDialog, setConfirmDialog] = useState<any>(null);
  const [bankRef, setBankRef] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [dialogMode, setDialogMode] = useState<"confirm" | "reject">("confirm");

  // Pending bank confirmations
  const { data: pending, isLoading: loadingPending, refetch } = useQuery({
    queryKey: ["remittance-bank-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remittances")
        .select("id, partner_reference, receiver_name, destination_ref, amount_out, currency_out, status, credited_at, bank_confirm_status, remittance_partners(name)")
        .eq("destination_type", "bank_account")
        .in("status", ["credited", "settled"])
        .order("credited_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Recon runs
  const { data: reconRuns, isLoading: loadingRuns } = useQuery({
    queryKey: ["remittance-recon-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remittance_recon_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ id, mode, ref, reason }: { id: string; mode: string; ref?: string; reason?: string }) => {
      const action = mode === "confirm" ? "confirm_credit" : "reject_credit";
      const res = await supabase.functions.invoke("remittance-bank-confirm", {
        body: { action, remittance_id: id, bank_reference: ref, rejection_reason: reason },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remittance-bank-pending"] });
      toast({ title: dialogMode === "confirm" ? "Bank credit confirmed" : "Bank credit rejected" });
      setConfirmDialog(null);
      setBankRef("");
      setRejectReason("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const runReconMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("remittance-recon-cron", {
        body: { action: "run_recon", run_type: "manual" },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["remittance-recon-runs"] });
      toast({ title: "Reconciliation completed", description: `Checked ${data.total_checked}, ${data.mismatched} mismatches, ${data.stale_flagged} stale` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const pendingConfirm = pending?.filter(r => !r.bank_confirm_status && r.status === "credited") || [];
  const confirmed = pending?.filter(r => r.bank_confirm_status === "confirmed" || r.status === "settled") || [];

  const stats = {
    pendingCount: pendingConfirm.length,
    confirmedCount: confirmed.length,
    totalVolume: pendingConfirm.reduce((s, r) => s + Number(r.amount_out || 0), 0),
    lastRun: reconRuns?.[0],
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Building2}
        title="Bank Credit Confirmations"
        description="Track and confirm bank account credits from remittance routing, run reconciliation"
      >
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => runReconMutation.mutate()} disabled={runReconMutation.isPending}>
            <Activity className="h-4 w-4 mr-1" /> Run Recon
          </Button>
        </div>
      </AdminPageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Pending Confirmation", value: stats.pendingCount, icon: Clock, color: "text-amber-600" },
          { label: "Confirmed", value: stats.confirmedCount, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Pending Volume (XAF)", value: stats.totalVolume.toLocaleString(), icon: Banknote, color: "text-primary" },
          { label: "Last Recon Run", value: stats.lastRun ? new Date(stats.lastRun.created_at).toLocaleDateString() : "Never", icon: Activity, color: "text-blue-600" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Confirmations
            {pendingConfirm.length > 0 && <Badge variant="destructive" className="ml-2 text-[10px] px-1.5">{pendingConfirm.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">Confirmed / Settled</TabsTrigger>
          <TabsTrigger value="recon">Recon Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {loadingPending ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead>Receiver</TableHead>
                      <TableHead>Bank Account</TableHead>
                      <TableHead>Amount (XAF)</TableHead>
                      <TableHead>Credited At</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {pendingConfirm.map((r, i) => {
                        const ageHours = r.credited_at ? Math.round((Date.now() - new Date(r.credited_at).getTime()) / 3600000) : 0;
                        return (
                          <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b hover:bg-muted/50">
                            <TableCell className="font-medium">{(r as any).remittance_partners?.name || "—"}</TableCell>
                            <TableCell className="font-mono text-xs truncate max-w-[120px]">{r.partner_reference}</TableCell>
                            <TableCell className="text-sm">{r.receiver_name || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{r.destination_ref || "—"}</TableCell>
                            <TableCell className="font-bold">{Number(r.amount_out || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.credited_at ? new Date(r.credited_at).toLocaleString() : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={ageHours > 48 ? "destructive" : ageHours > 24 ? "secondary" : "outline"}>
                                {ageHours}h
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" onClick={() => { setConfirmDialog(r); setDialogMode("confirm"); }}>
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => { setConfirmDialog(r); setDialogMode("reject"); }}>
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {pendingConfirm.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No pending bank confirmations</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Receiver</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confirmed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {confirmed.map((r, i) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b">
                      <TableCell>{(r as any).remittance_partners?.name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.partner_reference}</TableCell>
                      <TableCell>{r.receiver_name || "—"}</TableCell>
                      <TableCell className="font-bold">{Number(r.amount_out || 0).toLocaleString()} XAF</TableCell>
                      <TableCell><Badge variant="default">Settled</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.bank_confirm_status ? "Confirmed" : "Auto"}</TableCell>
                    </motion.tr>
                  ))}
                  {confirmed.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No confirmed bank credits yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="recon">
          {loadingRuns ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Checked</TableHead>
                      <TableHead>Matched</TableHead>
                      <TableHead>Mismatched</TableHead>
                      <TableHead>Stale</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconRuns?.map((r, i) => (
                      <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b">
                        <TableCell className="text-sm">{new Date(r.created_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{r.run_type}</Badge></TableCell>
                        <TableCell className="text-xs">{r.period_start} — {r.period_end}</TableCell>
                        <TableCell className="font-medium">{r.total_checked}</TableCell>
                        <TableCell className="text-emerald-600 font-medium">{r.matched}</TableCell>
                        <TableCell className={`font-medium ${(r.mismatched || 0) > 0 ? "text-destructive" : ""}`}>{r.mismatched}</TableCell>
                        <TableCell className={`font-medium ${(r.stale_flagged || 0) > 0 ? "text-amber-600" : ""}`}>{r.stale_flagged}</TableCell>
                        <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                      </motion.tr>
                    ))}
                    {(!reconRuns || reconRuns.length === 0) && (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No reconciliation runs yet</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm / Reject Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => { setConfirmDialog(null); setBankRef(""); setRejectReason(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === "confirm" ? "Confirm Bank Credit" : "Reject Bank Credit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Receiver</span><p className="font-medium">{confirmDialog?.receiver_name}</p></div>
              <div><span className="text-muted-foreground">Amount</span><p className="font-bold">{Number(confirmDialog?.amount_out || 0).toLocaleString()} XAF</p></div>
              <div><span className="text-muted-foreground">Bank Account</span><p className="font-mono text-xs">{confirmDialog?.destination_ref}</p></div>
              <div><span className="text-muted-foreground">Partner Ref</span><p className="font-mono text-xs">{confirmDialog?.partner_reference}</p></div>
            </div>
            {dialogMode === "confirm" ? (
              <div>
                <label className="text-sm text-muted-foreground">Bank Reference (optional)</label>
                <Input value={bankRef} onChange={e => setBankRef(e.target.value)} placeholder="Bank transaction ref…" />
              </div>
            ) : (
              <div>
                <label className="text-sm text-muted-foreground">Rejection Reason</label>
                <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection…" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialog(null); setBankRef(""); setRejectReason(""); }}>Cancel</Button>
            <Button
              variant={dialogMode === "confirm" ? "default" : "destructive"}
              disabled={confirmMutation.isPending || (dialogMode === "reject" && !rejectReason.trim())}
              onClick={() => confirmMutation.mutate({
                id: confirmDialog.id,
                mode: dialogMode,
                ref: bankRef,
                reason: rejectReason,
              })}
            >
              {dialogMode === "confirm" ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Confirm</> : <><XCircle className="h-4 w-4 mr-1" /> Reject</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
