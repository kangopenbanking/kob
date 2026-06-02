import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, AlertTriangle, Shield, Clock, CheckCircle, XCircle,
  Upload, Eye, Search, MessageSquare, ArrowUpCircle, FileText, Activity
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; color: string }> = {
  open: { variant: "outline", icon: AlertTriangle, color: "text-amber-600" },
  investigating: { variant: "secondary", icon: Search, color: "text-blue-500" },
  under_review: { variant: "secondary", icon: Clock, color: "text-blue-600" },
  escalated: { variant: "destructive", icon: ArrowUpCircle, color: "text-orange-600" },
  won: { variant: "default", icon: CheckCircle, color: "text-green-600" },
  lost: { variant: "destructive", icon: XCircle, color: "text-destructive" },
  closed: { variant: "secondary", icon: Shield, color: "text-muted-foreground" },
};

export default function MerchantDisputes() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceType, setEvidenceType] = useState("general");
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Fetch merchant
  const { data: merchant } = useQuery({
    queryKey: ["merchant-self"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  // Fetch disputes
  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["merchant-disputes", merchant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_disputes" as any)
        .select("*")
        .eq("merchant_id", merchant!.id)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!merchant?.id,
  });

  // Fetch activity timeline for selected dispute
  const { data: activities = [] } = useQuery({
    queryKey: ["dispute-activities", selectedDispute?.id],
    queryFn: async () => {
      if (!selectedDispute) return [];
      const { data } = await supabase
        .from("dispute_activities" as any)
        .select("*")
        .eq("dispute_id", selectedDispute.id)
        .order("created_at", { ascending: true });
      return (data as any[]) || [];
    },
    enabled: !!selectedDispute?.id && detailOpen,
  });

  const handleSubmitEvidence = async () => {
    if (!selectedDispute || !evidenceText.trim()) {
      toast.error("Please provide evidence details");
      return;
    }
    setSubmittingEvidence(true);
    try {
      const res = await supabase.functions.invoke("gateway-submit-dispute-evidence", {
        body: {
          dispute_id: selectedDispute.id,
          evidence: {
            uncategorized_text: evidenceText,
            evidence_type: evidenceType,
          },
        },
      });
      if (res.error) throw new Error(res.error.message || "Failed to submit evidence");
      toast.success("Evidence submitted successfully");
      setEvidenceText("");
      setEvidenceType("general");
      queryClient.invalidateQueries({ queryKey: ["merchant-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["dispute-activities", selectedDispute.id] });
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err));
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedDispute || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await supabase.functions.invoke("dispute-lifecycle", {
        body: {
          dispute_id: selectedDispute.id,
          dispute_source: "gateway",
          action: "add_note",
          note: noteText,
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success("Note added");
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["dispute-activities", selectedDispute.id] });
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err));
    } finally {
      setAddingNote(false);
    }
  };

  const filtered = disputes.filter((d: any) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return d.dispute_ref?.toLowerCase().includes(q) || d.reason?.toLowerCase().includes(q) || d.id?.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: disputes.length,
    open: disputes.filter((d: any) => d.status === "open").length,
    investigating: disputes.filter((d: any) => d.status === "investigating").length,
    under_review: disputes.filter((d: any) => d.status === "under_review").length,
    escalated: disputes.filter((d: any) => d.status === "escalated").length,
    won: disputes.filter((d: any) => d.status === "won").length,
    lost: disputes.filter((d: any) => d.status === "lost").length,
  };

  const activeCount = stats.open + stats.investigating + stats.under_review + stats.escalated;

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Disputes & Chargebacks</h1>
        <p className="text-muted-foreground">Manage disputes, submit evidence, track activity timelines and outcomes</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Active</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-amber-600">{activeCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Open</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-amber-500">{stats.open}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Investigating</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-blue-500">{stats.investigating}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Under Review</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-blue-600">{stats.under_review}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-green-600">Won</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{stats.won}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-destructive">Lost</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-destructive">{stats.lost}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by reference or reason..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Shield className="h-6 w-6 text-muted-foreground" />}
              title="No disputes found"
              description="Disputes from chargebacks will appear here"
            />
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
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d: any) => {
                  const cfg = statusConfig[d.status] || statusConfig.open;
                  const Icon = cfg.icon;
                  const isActionable = !["won", "lost", "closed"].includes(d.status);
                  const isOverdue = d.evidence_due_by && new Date(d.evidence_due_by) < new Date() && isActionable;
                  return (
                    <TableRow key={d.id} className={isOverdue ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-xs">{d.dispute_ref || d.id.slice(0, 8)}</TableCell>
                      <TableCell className="font-semibold">{Number(d.amount).toLocaleString()} {d.currency}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="gap-1">
                          <Icon className="h-3 w-3" />{d.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.priority === "high" ? "destructive" : d.priority === "medium" ? "secondary" : "outline"} className="text-xs">
                          {d.priority || "normal"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{d.reason || "—"}</TableCell>
                      <TableCell>
                        {d.evidence_due_by ? (
                          <span className={isOverdue ? "text-destructive font-medium" : ""}>
                            {format(new Date(d.evidence_due_by), "MMM d, yyyy")}
                            {isOverdue && <span className="text-xs ml-1">(overdue)</span>}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedDispute(d); setDetailOpen(true); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {isActionable && !d.evidence_submitted && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelectedDispute(d)}>
                                  <Upload className="h-3.5 w-3.5" /> Respond
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader><DialogTitle>Submit Evidence — {d.dispute_ref || d.id.slice(0, 8)}</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                                    <p><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{Number(d.amount).toLocaleString()} {d.currency}</span></p>
                                    <p><span className="text-muted-foreground">Reason:</span> {d.reason}</p>
                                    {d.evidence_due_by && (
                                      <p><span className="text-muted-foreground">Due:</span>{" "}
                                        <span className={new Date(d.evidence_due_by) < new Date() ? "text-destructive font-medium" : ""}>
                                          {format(new Date(d.evidence_due_by), "MMM d, yyyy HH:mm")}
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Evidence Type</Label>
                                    <Select value={evidenceType} onValueChange={setEvidenceType}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="general">General</SelectItem>
                                        <SelectItem value="receipt">Receipt / Proof of Purchase</SelectItem>
                                        <SelectItem value="tracking">Shipping / Tracking</SelectItem>
                                        <SelectItem value="refund_policy">Refund Policy</SelectItem>
                                        <SelectItem value="customer_communication">Customer Communication</SelectItem>
                                        <SelectItem value="duplicate">Duplicate Charge Proof</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Evidence Details</Label>
                                    <Textarea value={evidenceText} onChange={e => setEvidenceText(e.target.value)} rows={5} placeholder="Describe your evidence in detail. Include dates, customer interactions, delivery confirmations, etc." />
                                  </div>
                                  <Button onClick={handleSubmitEvidence} disabled={submittingEvidence || !evidenceText.trim()} className="w-full gap-2">
                                    {submittingEvidence ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    Submit Evidence
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
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

      {/* Detail + Timeline Dialog */}
      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setSelectedDispute(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Dispute {selectedDispute.dispute_ref || selectedDispute.id.slice(0, 8)}
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-5">
                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Reference</span><p className="font-mono font-medium">{selectedDispute.dispute_ref || selectedDispute.id.slice(0, 8)}</p></div>
                    <div><span className="text-muted-foreground">Status</span><p><Badge variant={statusConfig[selectedDispute.status]?.variant || "outline"}>{selectedDispute.status.replace(/_/g, " ")}</Badge></p></div>
                    <div><span className="text-muted-foreground">Amount</span><p className="font-semibold">{Number(selectedDispute.amount).toLocaleString()} {selectedDispute.currency}</p></div>
                    <div><span className="text-muted-foreground">Provider</span><p>{selectedDispute.provider || "—"}</p></div>
                    <div><span className="text-muted-foreground">Reason</span><p>{selectedDispute.reason || "—"}</p></div>
                    <div><span className="text-muted-foreground">Priority</span><p><Badge variant={selectedDispute.priority === "high" ? "destructive" : "outline"}>{selectedDispute.priority || "normal"}</Badge></p></div>
                    <div><span className="text-muted-foreground">Evidence Submitted</span><p>{selectedDispute.evidence_submitted ? "✅ Yes" : "❌ No"}</p></div>
                    <div><span className="text-muted-foreground">Created</span><p>{format(new Date(selectedDispute.created_at), "MMM d, yyyy HH:mm")}</p></div>
                    {selectedDispute.evidence_due_by && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Evidence Due</span>
                        <p className={new Date(selectedDispute.evidence_due_by) < new Date() ? "text-destructive font-medium" : ""}>
                          {format(new Date(selectedDispute.evidence_due_by), "MMM d, yyyy HH:mm")}
                          {new Date(selectedDispute.evidence_due_by) < new Date() && " (OVERDUE)"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Evidence Data */}
                  {selectedDispute.evidence_data && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Evidence Data</Label>
                      <pre className="mt-1 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-32">{JSON.stringify(selectedDispute.evidence_data, null, 2)}</pre>
                    </div>
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

                  {/* Add Note */}
                  {!["won", "lost", "closed"].includes(selectedDispute.status) && (
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Add a Note</Label>
                      <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Add a note or update for this dispute..." />
                      <Button size="sm" variant="outline" onClick={handleAddNote} disabled={addingNote || !noteText.trim()} className="gap-1">
                        {addingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                        Add Note
                      </Button>
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
