import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Eye,
  ArrowLeftRight,
  Banknote,
  FileText,
  Clock,
  Building2,
} from "lucide-react";

const SETTLEMENT_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "outline" },
  reconciled: { label: "Reconciled", variant: "default" },
  mismatch: { label: "Mismatch", variant: "destructive" },
  closed: { label: "Closed", variant: "secondary" },
};

const RECON_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "destructive" },
  investigating: { label: "Investigating", variant: "secondary" },
  resolved: { label: "Resolved", variant: "default" },
};

export default function RemittanceSettlement() {
  const queryClient = useQueryClient();
  const [reconFilter, setReconFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [resolveDialog, setResolveDialog] = useState<any>(null);
  const [resolveNote, setResolveNote] = useState("");

  // Fetch settlements
  const { data: settlements, isLoading: loadingSettlements } = useQuery({
    queryKey: ["remittance-settlements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remittance_settlements")
        .select("*, remittance_partners(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch reconciliation items
  const { data: reconItems, isLoading: loadingRecon } = useQuery({
    queryKey: ["remittance-recon", reconFilter],
    queryFn: async () => {
      let query = supabase
        .from("remittance_reconciliation_items")
        .select("*, remittance_settlements(*, remittance_partners(name))")
        .order("created_at", { ascending: false });

      if (reconFilter !== "all") {
        query = query.eq("status", reconFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from("remittance_reconciliation_items")
        .update({ status: "resolved", mismatch_reason: note })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remittance-recon"] });
      toast({ title: "Item resolved", description: "Reconciliation item marked as resolved." });
      setResolveDialog(null);
      setResolveNote("");
    },
    onError: (err: any) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  // Stats
  const settlementStats = {
    total: settlements?.length || 0,
    grossIn: settlements?.reduce((s, r) => s + Number(r.gross_in || 0), 0) || 0,
    netSettlement: settlements?.reduce((s, r) => s + Number(r.net_settlement || 0), 0) || 0,
    mismatches: reconItems?.filter((r) => r.status === "open").length || 0,
  };

  const filteredRecon = reconItems?.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.partner_reference?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={ArrowLeftRight}
        title="Remittance Settlements"
        description="Partner settlement statements, reconciliation queue, and mismatch resolution"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Statements", value: settlementStats.total, icon: FileText, color: "text-primary" },
          { label: "Gross Inflows (XAF)", value: settlementStats.grossIn.toLocaleString(), icon: Banknote, color: "text-emerald-600" },
          { label: "Net Settlement (XAF)", value: settlementStats.netSettlement.toLocaleString(), icon: CheckCircle2, color: "text-blue-600" },
          { label: "Open Mismatches", value: settlementStats.mismatches, icon: AlertTriangle, color: "text-destructive" },
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

      <Tabs defaultValue="settlements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settlements">Settlement Statements</TabsTrigger>
          <TabsTrigger value="reconciliation">
            Reconciliation Queue
            {settlementStats.mismatches > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1.5">
                {settlementStats.mismatches}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Settlements ── */}
        <TabsContent value="settlements">
          {loadingSettlements ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Gross In</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Net Settlement</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {settlements?.map((s, i) => {
                        const sc = SETTLEMENT_STATUS[s.status] || { label: s.status, variant: "outline" as const };
                        return (
                          <motion.tr
                            key={s.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className="border-b hover:bg-muted/50"
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                {(s as any).remittance_partners?.name || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {s.period_start ? new Date(s.period_start).toLocaleDateString() : "—"} –{" "}
                              {s.period_end ? new Date(s.period_end).toLocaleDateString() : "—"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {Number(s.gross_in || 0).toLocaleString()} {s.currency}
                            </TableCell>
                            <TableCell className="text-sm">
                              {Number(s.fees || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-bold">
                              {Number(s.net_settlement || 0).toLocaleString()} {s.currency}
                            </TableCell>
                            <TableCell>
                              <Badge variant={sc.variant}>{sc.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(s.created_at).toLocaleDateString()}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {(!settlements || settlements.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          No settlement statements found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        {/* ── Reconciliation Queue ── */}
        <TabsContent value="reconciliation" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by partner reference…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={reconFilter} onValueChange={setReconFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(RECON_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingRecon ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner Ref</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Actual</TableHead>
                      <TableHead>Diff</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {filteredRecon?.map((r, i) => {
                        const sc = RECON_STATUS[r.status] || { label: r.status, variant: "outline" as const };
                        const diff = Number(r.expected_amount || 0) - Number(r.actual_amount || 0);
                        return (
                          <motion.tr
                            key={r.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className="border-b hover:bg-muted/50"
                          >
                            <TableCell className="font-mono text-xs">{r.partner_reference || "—"}</TableCell>
                            <TableCell className="text-sm">
                              {(r as any).remittance_settlements?.remittance_partners?.name || "—"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {Number(r.expected_amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">
                              {Number(r.actual_amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className={`font-bold ${diff !== 0 ? "text-destructive" : ""}`}>
                              {diff !== 0 ? (diff > 0 ? "+" : "") + diff.toLocaleString() : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                              {r.mismatch_reason || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={sc.variant}>{sc.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {r.status !== "resolved" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setResolveDialog(r)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                                </Button>
                              )}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {(!filteredRecon || filteredRecon.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          No reconciliation items found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={() => { setResolveDialog(null); setResolveNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Mismatch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Partner Ref: </span>
              <span className="font-mono">{resolveDialog?.partner_reference}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Expected</span>
                <p className="font-bold">{Number(resolveDialog?.expected_amount || 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Actual</span>
                <p className="font-bold">{Number(resolveDialog?.actual_amount || 0).toLocaleString()}</p>
              </div>
            </div>
            <Textarea
              placeholder="Resolution note (required)…"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResolveDialog(null); setResolveNote(""); }}>
              Cancel
            </Button>
            <Button
              disabled={!resolveNote.trim() || resolveMutation.isPending}
              onClick={() => resolveMutation.mutate({ id: resolveDialog.id, note: resolveNote })}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
