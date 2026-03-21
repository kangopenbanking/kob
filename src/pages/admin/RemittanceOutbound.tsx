import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, Globe, Shield, Search, Eye, CheckCircle2, XCircle, AlertTriangle,
  Clock, Banknote, TrendingUp, Send, RefreshCw,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  created: { label: "Created", variant: "outline" },
  pending: { label: "Pending", variant: "secondary" },
  received: { label: "Processing", variant: "default" },
  credited: { label: "Delivered", variant: "default" },
  settled: { label: "Settled", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  reversed: { label: "Reversed", variant: "destructive" },
};

export default function RemittanceOutbound() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRemittance, setSelectedRemittance] = useState<any>(null);
  const [complianceDialog, setComplianceDialog] = useState<any>(null);
  const [complianceNote, setComplianceNote] = useState("");

  // Outbound remittances
  const { data: remittances, isLoading } = useQuery({
    queryKey: ["admin-outbound-remittances", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("remittances")
        .select("*, remittance_partners(name)")
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data } = await query;
      return data || [];
    },
  });

  // Compliance queue
  const { data: complianceQueue, isLoading: loadingCompliance } = useQuery({
    queryKey: ["admin-outbound-compliance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("remittance_compliance_checks")
        .select("*, remittances(id, partner_reference, sender_name, receiver_name, amount_in, currency_in, amount_out, currency_out, receiver_country, delivery_method, status)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // Detail query
  const { data: detail } = useQuery({
    queryKey: ["admin-outbound-detail", selectedRemittance?.id],
    queryFn: async () => {
      if (!selectedRemittance) return null;
      const [eventsRes, compRes] = await Promise.all([
        supabase.from("remittance_events").select("*").eq("remittance_id", selectedRemittance.id).order("created_at", { ascending: true }),
        supabase.from("remittance_compliance_checks").select("*").eq("remittance_id", selectedRemittance.id),
      ]);
      return { events: eventsRes.data || [], compliance: compRes.data || [] };
    },
    enabled: !!selectedRemittance,
  });

  // Compliance decision mutation
  const complianceMutation = useMutation({
    mutationFn: async ({ checkId, decision, remittanceId }: { checkId: string; decision: "approved" | "rejected"; remittanceId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("remittance-outbound", {
        body: {
          action: "compliance_decision",
          check_id: checkId,
          decision,
          note: complianceNote,
          remittance_id: remittanceId,
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-outbound-compliance"] });
      queryClient.invalidateQueries({ queryKey: ["admin-outbound-remittances"] });
      toast({ title: "Compliance decision recorded" });
      setComplianceDialog(null);
      setComplianceNote("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = remittances?.filter((r: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.partner_reference || "").toLowerCase().includes(s) ||
      (r.sender_name || "").toLowerCase().includes(s) ||
      (r.receiver_name || "").toLowerCase().includes(s);
  }) || [];

  // Stats
  const total = remittances?.length || 0;
  const totalVolume = remittances?.reduce((s: number, r: any) => s + (r.amount_in || 0), 0) || 0;
  const pendingCount = remittances?.filter((r: any) => ["created", "pending"].includes(r.status)).length || 0;
  const deliveredCount = remittances?.filter((r: any) => ["credited", "settled"].includes(r.status)).length || 0;
  const failedCount = remittances?.filter((r: any) => r.status === "failed").length || 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={ArrowUpRight} title="Outbound Remittances" description="Monitor and manage outbound international transfers" />

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Total Transfers", value: total, icon: Send, color: "text-primary" },
          { label: "Volume (XAF)", value: totalVolume.toLocaleString(), icon: Banknote, color: "text-blue-600" },
          { label: "Pending", value: pendingCount, icon: Clock, color: "text-amber-500" },
          { label: "Delivered", value: deliveredCount, icon: CheckCircle2, color: "text-green-600" },
          { label: "Failed", value: failedCount, icon: XCircle, color: "text-destructive" },
        ].map((kpi) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <kpi.icon className={`h-7 w-7 ${kpi.color}`} />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-lg font-bold">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="transfers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transfers">All Transfers</TabsTrigger>
          <TabsTrigger value="compliance">
            Compliance Queue
            {(complianceQueue?.length || 0) > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{complianceQueue?.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Transfers Tab ─────────────────────────────── */}
        <TabsContent value="transfers" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by ref, sender, receiver..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Sender</TableHead>
                        <TableHead>Receiver</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead className="text-right">Amount Out</TableHead>
                        <TableHead className="text-right">Fee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Compliance</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filtered.map((r: any) => (
                          <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b hover:bg-muted/30">
                            <TableCell className="font-mono text-xs">{(r.partner_reference || "").slice(0, 16)}</TableCell>
                            <TableCell>{r.sender_name || "—"}</TableCell>
                            <TableCell>
                              <div>{r.receiver_name}</div>
                              <div className="text-xs text-muted-foreground">{r.receiver_country || r.remittance_corridors?.to_country}</div>
                            </TableCell>
                            <TableCell className="capitalize text-xs">{(r.delivery_method || "bank_transfer").replace(/_/g, " ")}</TableCell>
                            <TableCell className="text-right font-medium">{(r.amount_out || 0).toLocaleString()} {r.currency_out}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{(r.fee_total || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={STATUS_CONFIG[r.status]?.variant || "outline"}>
                                {STATUS_CONFIG[r.status]?.label || r.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.compliance_status === "cleared" ? "default" : r.compliance_status === "rejected" ? "destructive" : "secondary"}>
                                {r.compliance_status || "n/a"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedRemittance(r)}><Eye className="h-4 w-4" /></Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Compliance Queue Tab ──────────────────────── */}
        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" /> Pending Compliance Reviews
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCompliance ? (
                <div className="p-8 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : complianceQueue && complianceQueue.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Sender → Receiver</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {complianceQueue.map((c: any) => {
                        const rem = c.remittances;
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{(rem?.partner_reference || "").slice(0, 16)}</TableCell>
                            <TableCell>
                              <span className="font-medium">{rem?.sender_name}</span>
                              <span className="text-muted-foreground"> → </span>
                              <span>{rem?.receiver_name}</span>
                              <div className="text-xs text-muted-foreground">{rem?.receiver_country} · {(rem?.delivery_method || "").replace(/_/g, " ")}</div>
                            </TableCell>
                            <TableCell className="text-right font-medium">{(rem?.amount_in || 0).toLocaleString()} {rem?.currency_in}</TableCell>
                            <TableCell>
                              <Badge variant={c.risk_score >= 50 ? "destructive" : c.risk_score >= 25 ? "secondary" : "outline"}>
                                {c.risk_score >= 50 ? "High" : c.risk_score >= 25 ? "Medium" : "Low"} ({c.risk_score})
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{new Date(c.created_at).toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="default" onClick={() => setComplianceDialog({ ...c, decision: "approved" })}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => setComplianceDialog({ ...c, decision: "rejected" })}>
                                  <XCircle className="h-3 w-3 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No pending compliance reviews</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Detail Dialog ───────────────────────────────── */}
      <Dialog open={!!selectedRemittance} onOpenChange={() => setSelectedRemittance(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5" /> Outbound Transfer Detail
            </DialogTitle>
          </DialogHeader>
          {selectedRemittance && (
            <ScrollArea className="max-h-[65vh]">
              <Tabs defaultValue="details">
                <TabsList className="mb-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline ({detail?.events?.length || 0})</TabsTrigger>
                  <TabsTrigger value="compliance">Compliance ({detail?.compliance?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Reference", selectedRemittance.partner_reference],
                      ["Status", selectedRemittance.status],
                      ["Direction", "Outbound"],
                      ["Sender", selectedRemittance.sender_name],
                      ["Receiver", selectedRemittance.receiver_name],
                      ["Destination", selectedRemittance.receiver_country],
                      ["Delivery", (selectedRemittance.delivery_method || "").replace(/_/g, " ")],
                      ["Amount In", `${(selectedRemittance.amount_in || 0).toLocaleString()} ${selectedRemittance.currency_in}`],
                      ["Amount Out", `${(selectedRemittance.amount_out || 0).toLocaleString()} ${selectedRemittance.currency_out}`],
                      ["Fee", `${(selectedRemittance.fee_total || 0).toLocaleString()} ${selectedRemittance.currency_in}`],
                      ["FX Rate", selectedRemittance.fx_rate],
                      ["Compliance", selectedRemittance.compliance_status],
                      ["Bank Name", selectedRemittance.receiver_bank_name || "—"],
                      ["Account #", selectedRemittance.receiver_account_number || "—"],
                      ["Created", new Date(selectedRemittance.created_at).toLocaleString()],
                    ].map(([label, val]) => (
                      <div key={label as string}>
                        <p className="text-muted-foreground text-xs">{label}</p>
                        <p className="font-medium">{String(val || "—")}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-3">
                  {detail?.events?.map((ev: any, i: number) => (
                    <motion.div key={ev.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="flex gap-3 items-start border-l-2 border-primary/20 pl-4 py-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm capitalize">{(ev.event_type || "").replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                      </div>
                    </motion.div>
                  ))}
                  {(!detail?.events || detail.events.length === 0) && (
                    <p className="text-muted-foreground text-sm text-center py-6">No events recorded</p>
                  )}
                </TabsContent>

                <TabsContent value="compliance" className="space-y-3">
                  {detail?.compliance?.map((c: any) => (
                    <Card key={c.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"}>
                            {c.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm">Risk Score: <strong>{c.risk_score}</strong></p>
                        {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Compliance Decision Dialog ──────────────────── */}
      <Dialog open={!!complianceDialog} onOpenChange={() => { setComplianceDialog(null); setComplianceNote(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{complianceDialog?.decision === "approved" ? "Approve" : "Reject"} Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><strong>Sender:</strong> {complianceDialog?.remittances?.sender_name}</p>
              <p><strong>Receiver:</strong> {complianceDialog?.remittances?.receiver_name} ({complianceDialog?.remittances?.receiver_country})</p>
              <p><strong>Amount:</strong> {(complianceDialog?.remittances?.amount_in || 0).toLocaleString()} {complianceDialog?.remittances?.currency_in}</p>
              <p><strong>Risk Score:</strong> {complianceDialog?.risk_score}</p>
            </div>
            <Textarea placeholder="Compliance notes (required for rejection)..." value={complianceNote} onChange={(e) => setComplianceNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setComplianceDialog(null); setComplianceNote(""); }}>Cancel</Button>
            <Button
              variant={complianceDialog?.decision === "approved" ? "default" : "destructive"}
              disabled={complianceDialog?.decision === "rejected" && !complianceNote}
              onClick={() => {
                if (!complianceDialog) return;
                complianceMutation.mutate({
                  checkId: complianceDialog.id,
                  decision: complianceDialog.decision,
                  remittanceId: complianceDialog.remittances?.id,
                });
              }}
            >
              {complianceDialog?.decision === "approved" ? "Approve & Release" : "Reject & Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
