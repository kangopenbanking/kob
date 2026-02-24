import { useEffect, useState } from "react";
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
import { Loader2, AlertTriangle, Shield, Clock, CheckCircle, XCircle, Upload, Eye, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  open: { variant: "outline", icon: AlertTriangle },
  under_review: { variant: "secondary", icon: Clock },
  won: { variant: "default", icon: CheckCircle },
  lost: { variant: "destructive", icon: XCircle },
  closed: { variant: "secondary", icon: Shield },
};

export default function MerchantDisputes() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceType, setEvidenceType] = useState("general");
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchant(m);
      const { data } = await supabase.from("gateway_disputes").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setDisputes(data || []);
    }
    setLoading(false);
  };

  const handleSubmitEvidence = async () => {
    if (!selectedDispute || !evidenceText.trim()) {
      toast.error("Please provide evidence details");
      return;
    }
    setSubmittingEvidence(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
      setDetailOpen(false);
      setSelectedDispute(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const filtered = disputes.filter(d => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (searchTerm && !(d.dispute_ref?.toLowerCase().includes(searchTerm.toLowerCase()) || d.reason?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
    return true;
  });

  const stats = {
    total: disputes.length,
    open: disputes.filter(d => d.status === "open").length,
    under_review: disputes.filter(d => d.status === "under_review").length,
    won: disputes.filter(d => d.status === "won").length,
    lost: disputes.filter(d => d.status === "lost").length,
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Disputes & Chargebacks</h1>
        <p className="text-muted-foreground">Manage disputes, submit evidence, and track outcomes</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">{stats.open}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Under Review</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{stats.under_review}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Won</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{stats.won}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Lost</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{stats.lost}</div></CardContent></Card>
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
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No disputes found</p>
              <p className="text-sm">Disputes from chargebacks will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Evidence Due</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(d => {
                  const cfg = statusConfig[d.status] || statusConfig.open;
                  const Icon = cfg.icon;
                  const isActionable = d.status === "open";
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.dispute_ref || d.id.slice(0, 8)}</TableCell>
                      <TableCell className="font-semibold">{Number(d.amount).toLocaleString()} {d.currency}</TableCell>
                      <TableCell><Badge variant={cfg.variant}><Icon className="h-3 w-3 mr-1" />{d.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate">{d.reason || "—"}</TableCell>
                      <TableCell>{d.evidence_due_by ? (
                        <span className={new Date(d.evidence_due_by) < new Date() ? "text-destructive font-medium" : ""}>
                          {format(new Date(d.evidence_due_by), "MMM d, yyyy")}
                        </span>
                      ) : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedDispute(d); setDetailOpen(true); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {isActionable && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelectedDispute(d)}>
                                  <Upload className="h-3.5 w-3.5" /> Respond
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader><DialogTitle>Submit Evidence for {d.dispute_ref || d.id.slice(0, 8)}</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                                    <p><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{Number(d.amount).toLocaleString()} {d.currency}</span></p>
                                    <p><span className="text-muted-foreground">Reason:</span> {d.reason}</p>
                                    {d.evidence_due_by && <p><span className="text-muted-foreground">Due:</span> <span className={new Date(d.evidence_due_by) < new Date() ? "text-destructive" : ""}>{format(new Date(d.evidence_due_by), "MMM d, yyyy HH:mm")}</span></p>}
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
                                  <Button onClick={handleSubmitEvidence} disabled={submittingEvidence} className="w-full gap-2">
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

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          {selectedDispute && (
            <>
              <DialogHeader><DialogTitle>Dispute Details</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Reference</span><p className="font-mono font-medium">{selectedDispute.dispute_ref || selectedDispute.id.slice(0, 8)}</p></div>
                  <div><span className="text-muted-foreground">Status</span><p><Badge variant={statusConfig[selectedDispute.status]?.variant || "outline"}>{selectedDispute.status.replace(/_/g, " ")}</Badge></p></div>
                  <div><span className="text-muted-foreground">Amount</span><p className="font-semibold">{Number(selectedDispute.amount).toLocaleString()} {selectedDispute.currency}</p></div>
                  <div><span className="text-muted-foreground">Provider</span><p>{selectedDispute.provider}</p></div>
                  <div><span className="text-muted-foreground">Reason</span><p>{selectedDispute.reason || "—"}</p></div>
                  <div><span className="text-muted-foreground">Evidence Submitted</span><p>{selectedDispute.evidence_submitted ? "Yes" : "No"}</p></div>
                  <div><span className="text-muted-foreground">Created</span><p>{format(new Date(selectedDispute.created_at), "MMM d, yyyy HH:mm")}</p></div>
                  <div><span className="text-muted-foreground">Evidence Due</span><p>{selectedDispute.evidence_due_by ? format(new Date(selectedDispute.evidence_due_by), "MMM d, yyyy HH:mm") : "—"}</p></div>
                </div>
                {selectedDispute.evidence_data && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Evidence Data</Label>
                    <pre className="mt-1 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-40">{JSON.stringify(selectedDispute.evidence_data, null, 2)}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
