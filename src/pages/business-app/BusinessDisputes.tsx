import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantContext } from "@/hooks/useMerchantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert, Upload, Search, MessageSquarePlus, Clock, CheckCircle, XCircle, AlertTriangle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageGuide } from "@/components/business-app/PageGuide";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Investigating", value: "investigating" },
  { label: "Under Review", value: "under_review" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
];

const EVIDENCE_TYPES = [
  { value: "uncategorized_text", label: "General Evidence" },
  { value: "receipt", label: "Receipt / Proof of Purchase" },
  { value: "shipping", label: "Shipping / Delivery Proof" },
  { value: "communication", label: "Customer Communication" },
  { value: "refund_policy", label: "Refund Policy" },
];

export default function BusinessDisputes() {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [evidence, setEvidence] = useState("");
  const [evidenceType, setEvidenceType] = useState("uncategorized_text");
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const { data: disputes, isLoading, refetch } = useQuery({
    queryKey: ["biz-disputes", merchantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_disputes" as any)
        .select("*")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data as any[]) || [];
    },
    enabled: !!merchantId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["biz-dispute-activities", selectedDispute?.id],
    queryFn: async () => {
      if (!selectedDispute) return [];
      const { data } = await supabase
        .from("dispute_activities" as any)
        .select("*")
        .eq("dispute_id", selectedDispute.id)
        .order("created_at", { ascending: true });
      return (data as any[]) || [];
    },
    enabled: !!selectedDispute,
  });

  const filteredDisputes = useMemo(() => {
    if (!disputes) return [];
    let result = disputes;
    if (statusFilter !== "all") result = result.filter((d: any) => d.status === statusFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((d: any) =>
        (d.reason || '').toLowerCase().includes(q) ||
        (d.charge_id || '').toLowerCase().includes(q) ||
        (d.dispute_ref || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [disputes, statusFilter, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    if (!disputes) return { total: 0, open: 0, investigating: 0, under_review: 0, won: 0, lost: 0 };
    return {
      total: disputes.length,
      open: disputes.filter((d: any) => d.status === 'open').length,
      investigating: disputes.filter((d: any) => d.status === 'investigating').length,
      under_review: disputes.filter((d: any) => ['under_review', 'evidence_submitted'].includes(d.status)).length,
      won: disputes.filter((d: any) => d.status === 'won').length,
      lost: disputes.filter((d: any) => d.status === 'lost').length,
    };
  }, [disputes]);

  const submitEvidence = async () => {
    if (!selectedDispute || !evidence.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("gateway-submit-dispute-evidence", {
        body: { dispute_id: selectedDispute.id, evidence: { [evidenceType]: evidence } },
      });
      if (error) throw error;
      toast({ title: "Evidence submitted", description: "Your response has been recorded." });
      setEvidence("");
      setEvidenceType("uncategorized_text");
      refetch();
    } catch (err: any) {
      toast({ title: "Could not submit evidence", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const addNote = async () => {
    if (!selectedDispute || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const { error } = await supabase.functions.invoke("dispute-lifecycle", {
        body: { dispute_id: selectedDispute.id, action: "add_note", note: noteText, dispute_source: "gateway" },
      });
      if (error) throw error;
      toast({ title: "Note added" });
      setNoteText("");
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  };

  const statusIcon = (s: string) => {
    if (s === 'won') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (s === 'lost') return <XCircle className="h-4 w-4 text-destructive" />;
    if (['investigating', 'under_review', 'evidence_submitted'].includes(s)) return <Clock className="h-4 w-4 text-blue-600" />;
    return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  };

  const statusColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "won") return "default";
    if (s === "lost") return "destructive";
    if (["under_review", "evidence_submitted", "investigating"].includes(s)) return "secondary";
    return "outline";
  };

  const isOverdue = (d: any) => {
    if (!d.evidence_due_by || ['won', 'lost'].includes(d.status)) return false;
    return differenceInDays(new Date(d.evidence_due_by), new Date()) < 0;
  };

  const isDueSoon = (d: any) => {
    if (!d.evidence_due_by || ['won', 'lost'].includes(d.status)) return false;
    const days = differenceInDays(new Date(d.evidence_due_by), new Date());
    return days >= 0 && days <= 3;
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24 space-y-4">
      <PageGuide
        title="Disputes"
        summary="Respond to chargebacks with evidence and track every case from open to resolution."
        steps={[
          { title: 'Open a disputed charge', description: 'Pick a case to see the customer claim, deadlines, and current status.' },
          { title: 'Upload evidence', description: 'Attach receipts, shipping proof, communications, or your refund policy.' },
          { title: 'Submit and monitor', description: 'Send your response and watch the status move through Investigating to Won or Lost.' },
        ]}
        learnMoreHref="/developer/gateway/disputes"
      />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-bold">Disputes</h1>
          <p className="text-sm text-muted-foreground">Manage chargebacks & respond with evidence</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Open", value: stats.open, color: "text-amber-600" },
          { label: "Won", value: stats.won, color: "text-green-600" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search disputes..."
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Dispute List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : !filteredDisputes.length ? (
        <Card><CardContent className="py-12 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No disputes</p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== "all" ? "No disputes with this status." : "You're in good shape — no chargebacks on file."}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredDisputes.map((d: any) => (
            <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedDispute(d)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {statusIcon(d.status)}
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{d.reason || "Chargeback"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.currency || "XAF"} {Number(d.amount || 0).toLocaleString()} · {d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : ""}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">Charge: {d.charge_id?.slice(0, 8) || "—"}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={statusColor(d.status)}>{(d.status || "open").replace(/_/g, " ")}</Badge>
                    {isOverdue(d) && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                    {isDueSoon(d) && !isOverdue(d) && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">Due Soon</Badge>}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={open => { if (!open) setSelectedDispute(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {statusIcon(selectedDispute.status)}
                  Dispute #{(selectedDispute.dispute_ref || selectedDispute.id).slice(0, 8)}
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-1 overflow-auto">
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs text-muted-foreground">Status</Label><p><Badge variant={statusColor(selectedDispute.status)}>{selectedDispute.status?.replace(/_/g, ' ')}</Badge></p></div>
                      <div><Label className="text-xs text-muted-foreground">Amount</Label><p className="font-semibold">{selectedDispute.currency || 'XAF'} {Number(selectedDispute.amount).toLocaleString()}</p></div>
                      <div><Label className="text-xs text-muted-foreground">Reason</Label><p>{selectedDispute.reason || 'Chargeback'}</p></div>
                      <div><Label className="text-xs text-muted-foreground">Filed</Label><p>{selectedDispute.created_at ? format(new Date(selectedDispute.created_at), "MMM d, yyyy") : "—"}</p></div>
                      {selectedDispute.evidence_due_by && (
                        <div className="col-span-2">
                          <Label className="text-xs text-muted-foreground">Evidence Due</Label>
                          <p className={isOverdue(selectedDispute) ? 'text-destructive font-semibold' : isDueSoon(selectedDispute) ? 'text-amber-600 font-semibold' : ''}>
                            {format(new Date(selectedDispute.evidence_due_by), "MMM d, yyyy")}
                            {isOverdue(selectedDispute) && " (OVERDUE)"}
                          </p>
                        </div>
                      )}
                    </div>
                    <div><Label className="text-xs text-muted-foreground">Charge ID</Label><p className="font-mono text-xs">{selectedDispute.charge_id || '—'}</p></div>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[300px]">
                    {activities.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-8 text-center">No activity yet</p>
                    ) : (
                      <div className="space-y-3">
                        {activities.map((a: any) => (
                          <div key={a.id} className="flex gap-2 text-xs">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            <div>
                              <span className="font-medium capitalize">{a.action?.replace(/_/g, ' ')}</span>
                              {a.from_status && a.to_status && (
                                <span className="text-muted-foreground"> {a.from_status} → {a.to_status}</span>
                              )}
                              {a.note && <p className="text-muted-foreground mt-0.5">{a.note}</p>}
                              <p className="text-muted-foreground">{format(new Date(a.created_at), "MMM d, HH:mm")} · {a.actor_type}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="actions" className="flex-1 overflow-auto">
                  <div className="space-y-4">
                    {/* Evidence Submission */}
                    {selectedDispute.status !== 'won' && selectedDispute.status !== 'lost' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> Submit Evidence</Label>
                        <Select value={evidenceType} onValueChange={setEvidenceType}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EVIDENCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Textarea value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Describe your evidence..." rows={3} />
                        <Button size="sm" className="w-full" onClick={submitEvidence} disabled={submitting || !evidence.trim()}>
                          {submitting ? "Submitting..." : "Submit Evidence"}
                        </Button>
                      </div>
                    )}

                    {/* Add Note */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-1"><MessageSquarePlus className="h-3.5 w-3.5" /> Add Note</Label>
                      <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add an internal note..." rows={2} />
                      <Button size="sm" variant="outline" className="w-full" onClick={addNote} disabled={addingNote || !noteText.trim()}>
                        {addingNote ? "Adding..." : "Add Note"}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
