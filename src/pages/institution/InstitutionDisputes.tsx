import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Search, ShieldAlert, Eye, AlertTriangle, Clock, CheckCircle, XCircle,
  MessageSquare, ArrowUpCircle, Loader2, Activity, FileText, Upload
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  open: { variant: "outline", icon: AlertTriangle },
  investigating: { variant: "secondary", icon: Search },
  under_review: { variant: "secondary", icon: Clock },
  escalated: { variant: "destructive", icon: ArrowUpCircle },
  won: { variant: "default", icon: CheckCircle },
  lost: { variant: "destructive", icon: XCircle },
  closed: { variant: "secondary", icon: ShieldAlert },
  resolved: { variant: "default", icon: CheckCircle },
  rejected: { variant: "destructive", icon: XCircle },
};

export default function InstitutionDisputes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [disputeSource, setDisputeSource] = useState<"legacy" | "gateway">("legacy");
  const [noteText, setNoteText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [activeTab, setActiveTab] = useState("customer");
  const [evidenceText, setEvidenceText] = useState("");

  // Fetch institution
  const { data: institution } = useQuery({
    queryKey: ["fi-self"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("institutions").select("id, institution_name").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  // Fetch customer (legacy) disputes
  const { data: customerDisputes = [], isLoading: loadingCustomer } = useQuery({
    queryKey: ["fi-customer-disputes", institution?.id, statusFilter],
    queryFn: async () => {
      let query = supabase.from("disputes").select("*").eq("institution_id", institution!.id).order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data } = await query;
      return data || [];
    },
    enabled: !!institution?.id,
  });

  // Fetch gateway disputes (from merchants linked to this institution)
  const { data: gatewayDisputes = [], isLoading: loadingGateway } = useQuery({
    queryKey: ["fi-gateway-disputes", institution?.id],
    queryFn: async () => {
      // Get merchants linked to this institution
      const { data: merchants } = await supabase
        .from("gateway_merchants")
        .select("id")
        .eq("institution_id", institution!.id);
      if (!merchants?.length) return [];
      const merchantIds = merchants.map(m => m.id);
      const { data } = await supabase
        .from("gateway_disputes" as any)
        .select("*")
        .in("merchant_id", merchantIds)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!institution?.id,
  });

  // Fetch activity timeline
  const { data: activities = [] } = useQuery({
    queryKey: ["fi-dispute-activities", selectedDispute?.id],
    queryFn: async () => {
      if (!selectedDispute) return [];
      const { data } = await supabase
        .from("dispute_activities" as any)
        .select("*")
        .eq("dispute_id", selectedDispute.id)
        .order("created_at", { ascending: true });
      return (data as any[]) || [];
    },
    enabled: !!selectedDispute?.id,
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDispute || !noteText.trim()) return;
      const { error } = await supabase.functions.invoke("dispute-lifecycle", {
        body: { dispute_id: selectedDispute.id, dispute_source: disputeSource, action: "add_note", note: noteText },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fi-dispute-activities"] });
      toast.success("Note added");
      setNoteText("");
    },
    onError: () => toast.error("Failed to add note"),
  });

  const changeStatusMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDispute || !newStatus) return;
      const { error } = await supabase.functions.invoke("dispute-lifecycle", {
        body: {
          dispute_id: selectedDispute.id,
          dispute_source: disputeSource,
          action: "change_status",
          new_status: newStatus,
          note: noteText || undefined,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fi-customer-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["fi-gateway-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["fi-dispute-activities"] });
      toast.success(`Status changed to ${newStatus.replace(/_/g, " ")}`);
      setNewStatus("");
      setNoteText("");
    },
    onError: () => toast.error("Failed to change status"),
  });

  const escalateMutation = useMutation({
    mutationFn: async (disputeId: string) => {
      const { error } = await supabase.functions.invoke("dispute-lifecycle", {
        body: { dispute_id: disputeId, dispute_source: disputeSource, action: "escalate", note: "Escalated by institution" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fi-customer-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["fi-gateway-disputes"] });
      toast.success("Dispute escalated to admin");
    },
    onError: () => toast.error("Failed to escalate"),
  });

  const submitEvidenceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDispute || !evidenceText.trim()) return;
      const { error } = await supabase.functions.invoke("gateway-submit-dispute-evidence", {
        body: {
          dispute_id: selectedDispute.id,
          evidence: { uncategorized_text: evidenceText, submitted_by: "institution" },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fi-gateway-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["fi-dispute-activities"] });
      toast.success("Evidence submitted");
      setEvidenceText("");
    },
    onError: () => toast.error("Failed to submit evidence"),
  });

  const statusColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (["won", "resolved"].includes(s)) return "default";
    if (["lost", "rejected"].includes(s)) return "destructive";
    if (["investigating", "under_review", "escalated"].includes(s)) return "secondary";
    return "outline";
  };

  const allDisputes = activeTab === "customer" ? customerDisputes : gatewayDisputes;
  const filtered = allDisputes.filter((d: any) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return d.reason?.toLowerCase().includes(q) || d.transaction_ref?.toLowerCase().includes(q) || d.dispute_ref?.toLowerCase().includes(q) || d.id?.toLowerCase().includes(q);
  });

  const customerStats = {
    total: customerDisputes.length,
    open: customerDisputes.filter((d: any) => d.status === "open").length,
    active: customerDisputes.filter((d: any) => ["investigating", "under_review", "escalated"].includes(d.status)).length,
    resolved: customerDisputes.filter((d: any) => ["resolved", "won", "closed"].includes(d.status)).length,
  };

  const gatewayStats = {
    total: gatewayDisputes.length,
    open: gatewayDisputes.filter((d: any) => d.status === "open").length,
    active: gatewayDisputes.filter((d: any) => ["investigating", "under_review", "escalated"].includes(d.status)).length,
    resolved: gatewayDisputes.filter((d: any) => ["won", "closed"].includes(d.status)).length,
  };

  const stats = activeTab === "customer" ? customerStats : gatewayStats;
  const isTerminal = (s: string) => ["won", "lost", "closed", "resolved", "rejected"].includes(s);

  const openDetail = (d: any, source: "legacy" | "gateway") => {
    setSelectedDispute(d);
    setDisputeSource(source);
    setNewStatus("");
    setNoteText("");
    setEvidenceText("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dispute Management</h1>
        <p className="text-muted-foreground">Handle customer disputes and gateway chargebacks for your institution</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Open</p><p className="text-2xl font-bold text-amber-600">{stats.open}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Active</p><p className="text-2xl font-bold text-blue-600">{stats.active}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Resolved</p><p className="text-2xl font-bold text-green-600">{stats.resolved}</p></CardContent></Card>
      </div>

      {/* Tabs for Customer vs Gateway Disputes */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="customer" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Customer Disputes
            {customerStats.open > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{customerStats.open}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="gateway" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Gateway Chargebacks
            {gatewayStats.open > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{gatewayStats.open}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <div className="flex gap-3 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search disputes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Customer Disputes Tab */}
        <TabsContent value="customer">
          <Card>
            <CardContent className="p-0">
              {loadingCustomer ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-30" />
                  <p className="font-medium">No customer disputes</p>
                  <p className="text-sm text-muted-foreground">Disputes filed by your customers will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs font-mono">{format(new Date(d.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell><Badge variant="outline">{d.dispute_type?.replace(/_/g, " ") || "—"}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{d.reason}</TableCell>
                        <TableCell className="font-semibold">{d.currency} {Number(d.amount).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={statusColor(d.status)}>{d.status.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openDetail(d, "legacy")}><Eye className="h-3.5 w-3.5" /></Button>
                            {!isTerminal(d.status) && (
                              <Button size="sm" variant="outline" onClick={() => escalateMutation.mutate(d.id)} disabled={d.status === "escalated"}>
                                <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Escalate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gateway Chargebacks Tab */}
        <TabsContent value="gateway">
          <Card>
            <CardContent className="p-0">
              {loadingGateway ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-30" />
                  <p className="font-medium">No gateway chargebacks</p>
                  <p className="text-sm text-muted-foreground">Chargebacks from payment providers will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Evidence Due</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d: any) => {
                      const isOverdue = d.evidence_due_by && new Date(d.evidence_due_by) < new Date() && !isTerminal(d.status);
                      return (
                        <TableRow key={d.id} className={isOverdue ? "bg-destructive/5" : ""}>
                          <TableCell className="font-mono text-xs">{d.dispute_ref || d.id.slice(0, 8)}</TableCell>
                          <TableCell className="font-semibold">{Number(d.amount).toLocaleString()} {d.currency}</TableCell>
                          <TableCell><Badge variant={statusColor(d.status)}>{d.status.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={d.priority === "high" ? "destructive" : "outline"} className="text-xs">{d.priority || "normal"}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate">{d.reason || "—"}</TableCell>
                          <TableCell>
                            {d.evidence_due_by ? (
                              <span className={isOverdue ? "text-destructive font-medium text-xs" : "text-xs"}>
                                {format(new Date(d.evidence_due_by), "MMM d, yyyy")}
                                {isOverdue && " (overdue)"}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openDetail(d, "gateway")}><Eye className="h-3.5 w-3.5" /></Button>
                              {!isTerminal(d.status) && !d.evidence_submitted && (
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => openDetail(d, "gateway")}>
                                  <Upload className="h-3.5 w-3.5" /> Respond
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail + Timeline Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={open => { if (!open) setSelectedDispute(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Dispute {selectedDispute.dispute_ref || selectedDispute.id.slice(0, 8)}
                  <Badge variant="outline" className="ml-2 text-[10px]">{disputeSource === "gateway" ? "Chargeback" : "Customer"}</Badge>
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-5">
                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground text-xs">Status</span><p><Badge variant={statusColor(selectedDispute.status)}>{selectedDispute.status.replace(/_/g, " ")}</Badge></p></div>
                    <div><span className="text-muted-foreground text-xs">Amount</span><p className="font-semibold">{selectedDispute.currency} {Number(selectedDispute.amount).toLocaleString()}</p></div>
                    <div><span className="text-muted-foreground text-xs">Type</span><p>{selectedDispute.dispute_type?.replace(/_/g, " ") || selectedDispute.reason || "—"}</p></div>
                    <div><span className="text-muted-foreground text-xs">Reference</span><p className="font-mono text-xs">{selectedDispute.transaction_ref || selectedDispute.charge_id?.slice(0, 12) || "—"}</p></div>
                    {selectedDispute.priority && <div><span className="text-muted-foreground text-xs">Priority</span><p><Badge variant={selectedDispute.priority === "high" ? "destructive" : "outline"}>{selectedDispute.priority}</Badge></p></div>}
                    {selectedDispute.evidence_submitted !== undefined && <div><span className="text-muted-foreground text-xs">Evidence</span><p>{selectedDispute.evidence_submitted ? "✅ Submitted" : "❌ Not yet"}</p></div>}
                    <div><span className="text-muted-foreground text-xs">Created</span><p className="text-xs">{format(new Date(selectedDispute.created_at), "MMM d, yyyy HH:mm")}</p></div>
                    {selectedDispute.evidence_due_by && (
                      <div>
                        <span className="text-muted-foreground text-xs">Evidence Due</span>
                        <p className={`text-xs ${new Date(selectedDispute.evidence_due_by) < new Date() ? "text-destructive font-medium" : ""}`}>
                          {format(new Date(selectedDispute.evidence_due_by), "MMM d, yyyy")}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedDispute.description && (
                    <div><Label className="text-xs text-muted-foreground">Description</Label><p className="text-sm">{selectedDispute.description}</p></div>
                  )}

                  {selectedDispute.evidence_data && (
                    <div><Label className="text-xs text-muted-foreground">Evidence Data</Label><pre className="mt-1 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-28">{JSON.stringify(selectedDispute.evidence_data, null, 2)}</pre></div>
                  )}

                  <Separator />

                  {/* Activity Timeline */}
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                      <Activity className="h-4 w-4" /> Activity Timeline
                    </h3>
                    {activities.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No activity recorded yet</p>
                    ) : (
                      <div className="space-y-3">
                        {activities.map((a: any) => (
                          <div key={a.id} className="flex gap-3 text-sm">
                            <div className="flex flex-col items-center">
                              <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${
                                a.action === "status_change" ? "bg-primary" :
                                a.action === "evidence_submitted" ? "bg-green-500" :
                                a.action === "escalated" ? "bg-orange-500" :
                                a.action === "note_added" ? "bg-blue-500" : "bg-muted-foreground"
                              }`} />
                              <div className="w-px flex-1 bg-border mt-1" />
                            </div>
                            <div className="flex-1 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium capitalize">{a.action.replace(/_/g, " ")}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              {a.from_status && a.to_status && (
                                <div className="flex items-center gap-1 text-xs mt-0.5">
                                  <Badge variant="outline" className="text-[10px] py-0">{a.from_status}</Badge>
                                  <span>→</span>
                                  <Badge variant="secondary" className="text-[10px] py-0">{a.to_status}</Badge>
                                </div>
                              )}
                              {a.note && <p className="text-muted-foreground mt-0.5">{a.note}</p>}
                              <p className="text-xs text-muted-foreground mt-0.5">by {a.actor_type || "system"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Actions for non-terminal disputes */}
                  {!isTerminal(selectedDispute.status) && (
                    <div className="space-y-4">
                      {/* Change Status */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Change Status</Label>
                        <div className="flex gap-2">
                          <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger className="flex-1"><SelectValue placeholder="Select new status" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="investigating">Investigating</SelectItem>
                              <SelectItem value="under_review">Under Review</SelectItem>
                              <SelectItem value="resolved">Resolved (Customer Favor)</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => changeStatusMutation.mutate()}
                            disabled={!newStatus || changeStatusMutation.isPending}
                          >
                            {changeStatusMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update"}
                          </Button>
                        </div>
                      </div>

                      {/* Submit Evidence (gateway only) */}
                      {disputeSource === "gateway" && !selectedDispute.evidence_submitted && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> Submit Evidence</Label>
                          <Textarea value={evidenceText} onChange={e => setEvidenceText(e.target.value)} placeholder="Describe evidence: delivery proof, communication records, order details..." rows={3} />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => submitEvidenceMutation.mutate()}
                            disabled={!evidenceText.trim() || submitEvidenceMutation.isPending}
                            className="gap-1"
                          >
                            {submitEvidenceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Submit Evidence
                          </Button>
                        </div>
                      )}

                      {/* Add Note */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Internal Note</Label>
                        <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add an internal note..." rows={2} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addNoteMutation.mutate()}
                          disabled={!noteText.trim() || addNoteMutation.isPending}
                          className="gap-1"
                        >
                          {addNoteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                          Add Note
                        </Button>
                      </div>

                      {/* Escalate */}
                      {selectedDispute.status !== "escalated" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => escalateMutation.mutate(selectedDispute.id)}
                          disabled={escalateMutation.isPending}
                          className="gap-1"
                        >
                          <ArrowUpCircle className="h-3.5 w-3.5" /> Escalate to Admin
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
