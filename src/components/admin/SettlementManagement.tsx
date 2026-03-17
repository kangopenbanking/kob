import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, DollarSign, CheckCircle2, Clock, Activity } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// ─── Skeletons ───
const StatSkeleton = () => (
  <Card>
    <CardHeader className="flex flex-row items-center gap-3 pb-2">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <Skeleton className="h-4 w-24" />
    </CardHeader>
    <CardContent className="space-y-2">
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </CardContent>
  </Card>
);

const TableSkeleton = () => (
  <Table>
    <TableHeader>
      <TableRow>
        {Array.from({ length: 6 }).map((_, i) => (
          <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {Array.from({ length: 4 }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: 6 }).map((_, c) => (
            <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export function SettlementManagement() {
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<any | null>(null);

  const { data: institutions = [], isLoading: instLoading } = useQuery({
    queryKey: ["settlement-institutions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("institutions")
        .select("id, institution_name, use_kob_flutterwave, settlement_frequency, minimum_settlement_amount, settlement_bank_account")
        .eq("use_kob_flutterwave", true)
        .eq("status", "approved");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: settlements = [], isLoading: setLoading, refetch: refetchSettlements } = useQuery({
    queryKey: ["settlement-transactions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("settlement_transactions")
        .select("*, institutions(institution_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const isLoading = instLoading || setLoading;

  const processSettlement = async (institutionId: string) => {
    setProcessing(institutionId);
    try {
      const periodEnd = new Date().toISOString();
      const periodStart = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString();

      const { error } = await supabase.functions.invoke("settlement-process", {
        body: { institution_id: institutionId, period_start: periodStart, period_end: periodEnd },
      });
      if (error) throw error;

      toast.success("Settlement processed successfully");
      refetchSettlements();
    } catch (error: any) {
      toast.error(error.message || "Failed to process settlement");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      pending: { className: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Pending" },
      processing: { className: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Processing" },
      completed: { className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Completed" },
      failed: { className: "bg-destructive/10 text-destructive border-destructive/20", label: "Failed" },
    };
    const c = config[status] || config.pending;
    return <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold border ${c.className}`}>{c.label}</Badge>;
  };

  const pendingCount = settlements.filter((s: any) => s.settlement_status === "pending").length;
  const thisMonthCount = settlements.filter((s: any) => {
    const d = new Date(s.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const stats = [
    { label: "Active Institutions", value: institutions.length, sub: "Using KOB facilitation", icon: TrendingUp, iconBg: "bg-primary/10 text-primary" },
    { label: "Pending Settlements", value: pendingCount, sub: "Awaiting processing", icon: DollarSign, iconBg: "bg-amber-500/10 text-amber-600" },
    { label: "This Month", value: thisMonthCount, sub: "Settlements processed", icon: CheckCircle2, iconBg: "bg-emerald-500/10 text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardHeader className="flex flex-row items-center gap-3 pb-2">
                    <div className={`rounded-xl p-2.5 ${s.iconBg}`}><s.icon className="h-4 w-4" /></div>
                    <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{s.value}</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      {/* Institutions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Institutions — Settlement Actions</CardTitle>
          <CardDescription>Process settlements for facilitated institutions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Institution</TableHead>
                  <TableHead className="text-xs">Frequency</TableHead>
                  <TableHead className="text-xs">Min. Amount</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {institutions.map((inst: any, i: number) => (
                    <motion.tr
                      key={inst.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">{inst.institution_name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{inst.settlement_frequency}</Badge></TableCell>
                      <TableCell className="text-sm">{inst.minimum_settlement_amount?.toLocaleString()} XAF</TableCell>
                      <TableCell className="text-xs">
                        {inst.settlement_bank_account?.type === "bank_transfer" ? "Bank Transfer" : "Mobile Money"}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" className="h-8 text-xs" onClick={() => processSettlement(inst.id)} disabled={processing === inst.id}>
                          {processing === inst.id ? (
                            <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Processing</>
                          ) : (
                            "Process Settlement"
                          )}
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {institutions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No institutions with facilitation enabled</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Settlements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Settlements</CardTitle>
          <CardDescription>Settlement transaction history</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Settlement Ref</TableHead>
                  <TableHead className="text-xs">Institution</TableHead>
                  <TableHead className="text-xs">Period</TableHead>
                  <TableHead className="text-xs">Net Amount</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {settlements.map((s: any, i: number) => (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedSettlement(s)}
                    >
                      <TableCell className="font-mono text-[11px] text-muted-foreground">{s.settlement_ref}</TableCell>
                      <TableCell className="font-medium text-sm">{s.institutions?.institution_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(s.period_start), "MMM dd")} – {format(new Date(s.period_end), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="font-semibold text-sm">{s.net_settlement_amount?.toLocaleString()} XAF</TableCell>
                      <TableCell>{getStatusBadge(s.settlement_status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(s.created_at), "MMM dd, yyyy HH:mm")}</TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {settlements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <DollarSign className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No settlements found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Settlement Detail Dialog */}
      <Dialog open={!!selectedSettlement} onOpenChange={(open) => { if (!open) setSelectedSettlement(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />Settlement Detail
            </DialogTitle>
            <DialogDescription>Full settlement breakdown</DialogDescription>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedSettlement.settlement_status)}
                <span className="text-xs font-mono text-muted-foreground">{selectedSettlement.settlement_ref}</span>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Institution", value: selectedSettlement.institutions?.institution_name },
                  { label: "Net Amount", value: `${selectedSettlement.net_settlement_amount?.toLocaleString()} XAF` },
                  { label: "Total Inflows", value: `${selectedSettlement.total_inflows?.toLocaleString() || "—"} XAF` },
                  { label: "Total Fees", value: `${selectedSettlement.total_kob_fees?.toLocaleString() || "—"} XAF` },
                  { label: "Period Start", value: format(new Date(selectedSettlement.period_start), "MMM dd, yyyy") },
                  { label: "Period End", value: format(new Date(selectedSettlement.period_end), "MMM dd, yyyy") },
                  { label: "Tx Count", value: selectedSettlement.transaction_count || "—" },
                  { label: "Processed", value: format(new Date(selectedSettlement.created_at), "MMM dd, yyyy HH:mm") },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{item.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
