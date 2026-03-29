import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Search, ShieldAlert, Eye, AlertTriangle, Clock, CheckCircle, XCircle,
  MessageSquare, ArrowUpCircle, Loader2, Activity, FileText, Upload, User, ArrowRight, Scale
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const KANBAN_COLUMNS = [
  { key: 'open', label: 'Open', color: 'bg-amber-500' },
  { key: 'investigating', label: 'Investigating', color: 'bg-blue-500' },
  { key: 'under_review', label: 'Under Review', color: 'bg-purple-500' },
  { key: 'escalated', label: 'Escalated', color: 'bg-red-500' },
  { key: 'won', label: 'Won', color: 'bg-green-500' },
  { key: 'lost', label: 'Lost', color: 'bg-destructive' },
  { key: 'closed', label: 'Closed', color: 'bg-muted-foreground' },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'destructive',
  normal: 'secondary',
  low: 'outline',
};

export default function InstitutionDisputes() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [disputeSource, setDisputeSource] = useState<"legacy" | "gateway">("legacy");
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateDispute, setEscalateDispute] = useState<any>(null);
  const [evidenceText, setEvidenceText] = useState("");
  const [resolution, setResolution] = useState("");

  // Fetch institution
  const { data: institution } = useQuery({
    queryKey: ["fi-self"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      // Owner path
      const { data } = await supabase.from("institutions").select("id, institution_name").eq("user_id", user.id).maybeSingle();
      if (data) return data;
      // Staff path
      const { data: staffInstId } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
      if (staffInstId) {
        const { data: staffInst } = await supabase.from("institutions").select("id, institution_name").eq("id", staffInstId).maybeSingle();
        return staffInst;
      }
      return null;
    },
  });

  // Fetch institution staff for assignment
  const { data: staffMembers = [] } = useQuery({
    queryKey: ["fi-staff-members", institution?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !institution) return [];
      // Get the institution owner + any staff
      const profiles = [{ id: user.id, full_name: 'Me (Owner)', email: user.email }];
      // Try to get merchant staff if any merchants are linked
      const { data: merchants } = await supabase.from("gateway_merchants").select("id").eq("institution_id", institution.id);
      if (merchants?.length) {
        const { data: staff } = await supabase.from("merchant_staff_roles" as any).select("user_id, profiles(full_name, email)").in("merchant_id", merchants.map(m => m.id));
        if (staff) {
          (staff as any[]).forEach(s => {
            if (s.user_id !== user.id) {
              profiles.push({ id: s.user_id, full_name: (s.profiles as any)?.full_name || 'Staff', email: (s.profiles as any)?.email || '' });
            }
          });
        }
      }
      return profiles;
    },
    enabled: !!institution?.id,
  });

  // Fetch customer (legacy) disputes
  const { data: customerDisputes = [], isLoading: loadingCustomer } = useQuery({
    queryKey: ["fi-customer-disputes", institution?.id],
    queryFn: async () => {
      const { data } = await supabase.from("disputes").select("*").eq("institution_id", institution!.id).order("created_at", { ascending: false });
      return (data || []).map((d: any) => ({ ...d, _source: 'legacy' as const }));
    },
    enabled: !!institution?.id,
  });

  // Fetch gateway disputes (from merchants linked to this institution)
  const { data: gatewayDisputes = [], isLoading: loadingGateway } = useQuery({
    queryKey: ["fi-gateway-disputes", institution?.id],
    queryFn: async () => {
      const { data: merchants } = await supabase.from("gateway_merchants").select("id, business_name").eq("institution_id", institution!.id);
      if (!merchants?.length) return [];
      const merchantIds = merchants.map(m => m.id);
      const { data } = await supabase.from("gateway_disputes").select("*").in("merchant_id", merchantIds).order("created_at", { ascending: false });
      const merchantMap = Object.fromEntries(merchants.map(m => [m.id, m.business_name]));
      return (data || []).map((d: any) => ({ ...d, _source: 'gateway' as const, _merchant_name: merchantMap[d.merchant_id] || 'Unknown' }));
    },
    enabled: !!institution?.id,
  });

  // Activities for selected dispute
  const { data: activities = [] } = useQuery({
    queryKey: ["fi-dispute-activities", selectedDispute?.id],
    queryFn: async () => {
      if (!selectedDispute) return [];
      const { data } = await supabase.from("dispute_activities" as any).select("*").eq("dispute_id", selectedDispute.id).order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!selectedDispute,
  });

  const lifecycleMutation = useMutation({
    mutationFn: async (params: any) => {
      const { error, data } = await supabase.functions.invoke("dispute-lifecycle", { body: params });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fi-customer-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["fi-gateway-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["fi-dispute-activities"] });
      toast.success("Dispute updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update dispute"),
  });

  const submitEvidenceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDispute || !evidenceText.trim()) return;
      const { error } = await supabase.functions.invoke("gateway-submit-dispute-evidence", {
        body: { dispute_id: selectedDispute.id, evidence: { uncategorized_text: evidenceText, submitted_by: "institution" } },
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

  // Combine all disputes
  const allDisputes = [...customerDisputes, ...gatewayDisputes].filter(d => {
    if (sourceFilter === 'customer' && d._source !== 'legacy') return false;
    if (sourceFilter === 'gateway' && d._source !== 'gateway') return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const name = d._source === 'gateway' ? (d as any)._merchant_name || '' : '';
      return (d.dispute_ref || d.id)?.toLowerCase().includes(s) || d.reason?.toLowerCase().includes(s) || name.toLowerCase().includes(s);
    }
    return true;
  });

  const getByStatus = (status: string) => allDisputes.filter(d => {
    if (status === 'open') return d.status === 'open';
    if (status === 'closed') return ['closed', 'rejected'].includes(d.status);
    if (status === 'won') return ['won', 'resolved'].includes(d.status);
    return d.status === status;
  });

  const stats = {
    total: allDisputes.length,
    open: getByStatus('open').length,
    investigating: getByStatus('investigating').length,
    under_review: getByStatus('under_review').length,
    escalated: getByStatus('escalated').length,
    won: getByStatus('won').length,
    lost: getByStatus('lost').length,
  };

  const handleStatusChange = (dispute: any, newStatus: string) => {
    lifecycleMutation.mutate({
      dispute_id: dispute.id,
      dispute_source: dispute._source === 'gateway' ? 'gateway' : 'legacy',
      action: 'change_status',
      new_status: newStatus,
      note: resolution || undefined,
    });
    setResolution("");
  };

  const handleAddNote = () => {
    if (!selectedDispute || !noteText.trim()) return;
    lifecycleMutation.mutate({
      dispute_id: selectedDispute.id,
      dispute_source: selectedDispute._source === 'gateway' ? 'gateway' : 'legacy',
      action: 'add_note',
      note: noteText,
    });
    setNoteText("");
  };

  const handleAssign = (dispute: any, assigneeId: string) => {
    lifecycleMutation.mutate({
      dispute_id: dispute.id,
      dispute_source: dispute._source === 'gateway' ? 'gateway' : 'legacy',
      action: 'assign',
      assignee_id: assigneeId,
    });
  };

  const handleEscalateConfirm = () => {
    if (!escalateDispute) return;
    lifecycleMutation.mutate({
      dispute_id: escalateDispute.id,
      dispute_source: escalateDispute._source === 'gateway' ? 'gateway' : 'legacy',
      action: 'escalate',
      note: escalateNote || 'Escalated to KOB Admin by institution',
    });
    setEscalateOpen(false);
    setEscalateNote("");
    setEscalateDispute(null);
  };

  const openDetail = (d: any) => {
    setSelectedDispute(d);
    setDisputeSource(d._source === 'gateway' ? 'gateway' : 'legacy');
    setDetailOpen(true);
    setNoteText("");
    setEvidenceText("");
    setResolution("");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: 'outline', investigating: 'secondary', under_review: 'secondary',
      escalated: 'destructive', won: 'default', resolved: 'default',
      lost: 'destructive', closed: 'secondary', rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.replace(/_/g, ' ')}</Badge>;
  };

  const isTerminal = (s: string) => ['won', 'lost', 'closed', 'resolved', 'rejected'].includes(s);

  const DisputeCard = ({ dispute }: { dispute: any }) => {
    const daysOpen = formatDistanceToNow(new Date(dispute.created_at), { addSuffix: false });
    const ref = dispute.dispute_ref || dispute.id.slice(0, 8);
    const isOverdue = dispute.evidence_due_by && new Date(dispute.evidence_due_by) < new Date() && !isTerminal(dispute.status);

    return (
      <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className={`p-3 bg-card border rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-2 ${isOverdue ? 'border-destructive/50 bg-destructive/5' : 'border-border/50'}`}
        onClick={() => openDetail(dispute)}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{ref}</span>
          <Badge variant={(PRIORITY_COLORS[dispute.priority || 'normal'] || 'outline') as any} className="text-[10px] px-1.5 py-0">
            {dispute.priority || 'normal'}
          </Badge>
        </div>
        <p className="text-sm font-semibold">{dispute.currency || 'XAF'} {Number(dispute.amount).toLocaleString()}</p>
        <p className="text-xs text-muted-foreground truncate">{dispute.reason || dispute.dispute_type?.replace(/_/g, ' ') || 'Chargeback'}</p>
        {dispute._source === 'gateway' && dispute._merchant_name && (
          <p className="text-xs truncate"><User className="inline h-3 w-3 mr-1" />{dispute._merchant_name}</p>
        )}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{daysOpen} ago</span>
          <Badge variant="outline" className="text-[10px] px-1">{dispute._source === 'gateway' ? 'chargeback' : 'customer'}</Badge>
        </div>
        {isOverdue && <p className="text-[10px] text-destructive font-medium">⚠ Evidence overdue</p>}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary rounded-xl p-6 text-primary-foreground">
        <div className="flex items-center gap-3">
          <Scale className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-bold">Dispute Management</h1>
            <p className="text-primary-foreground/80 text-sm">Kanban board — manage customer disputes and gateway chargebacks</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-7">
        {[
          { label: 'Total', value: stats.total, color: '' },
          { label: 'Open', value: stats.open, color: 'text-amber-600' },
          { label: 'Investigating', value: stats.investigating, color: 'text-blue-600' },
          { label: 'Under Review', value: stats.under_review, color: 'text-purple-600' },
          { label: 'Escalated', value: stats.escalated, color: 'text-red-600' },
          { label: 'Won', value: stats.won, color: 'text-green-600' },
          { label: 'Lost', value: stats.lost, color: 'text-destructive' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search disputes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="customer">Customer Disputes</SelectItem>
            <SelectItem value="gateway">Gateway Chargebacks</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-lg overflow-hidden">
          <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')}>Kanban</Button>
          <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')}>Table</Button>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === 'kanban' ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1200px]">
            {KANBAN_COLUMNS.map(col => {
              const items = getByStatus(col.key);
              return (
                <div key={col.key} className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                    <h3 className="text-sm font-semibold">{col.label}</h3>
                    <Badge variant="outline" className="text-xs ml-auto">{items.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-xl p-2">
                    <AnimatePresence>
                      {items.map(d => <DisputeCard key={d.id} dispute={d} />)}
                    </AnimatePresence>
                    {items.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">No disputes</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Table View */
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-muted-foreground">Ref</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Source</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Reason</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allDisputes.map(d => (
                  <tr key={d.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(d)}>
                    <td className="p-3 font-mono text-xs">{d.dispute_ref || d.id.slice(0, 8)}</td>
                    <td className="p-3"><Badge variant="outline" className="text-xs">{d._source === 'gateway' ? 'chargeback' : 'customer'}</Badge></td>
                    <td className="p-3 font-semibold">{d.currency || 'XAF'} {Number(d.amount).toLocaleString()}</td>
                    <td className="p-3 max-w-[200px] truncate">{d.reason || d.dispute_type?.replace(/_/g, ' ') || '—'}</td>
                    <td className="p-3">{getStatusBadge(d.status)}</td>
                    <td className="p-3"><Badge variant={(PRIORITY_COLORS[d.priority || 'normal'] || 'outline') as any}>{d.priority || 'normal'}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground">{format(new Date(d.created_at), "MMM d, yyyy")}</td>
                    <td className="p-3"><Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allDisputes.length === 0 && <p className="text-center py-12 text-muted-foreground">No disputes found</p>}
          </CardContent>
        </Card>
      )}

      {/* Detail / Timeline Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>Dispute {selectedDispute.dispute_ref || selectedDispute.id.slice(0, 8)}</span>
                  {getStatusBadge(selectedDispute.status)}
                  <Badge variant="outline" className="text-[10px]">{selectedDispute._source === 'gateway' ? 'Chargeback' : 'Customer'}</Badge>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="shrink-0">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline ({activities.length})</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-1 overflow-auto">
                  <div className="grid grid-cols-2 gap-4 text-sm p-1">
                    <div><Label className="text-muted-foreground text-xs">Amount</Label><p className="font-semibold">{selectedDispute.currency || 'XAF'} {Number(selectedDispute.amount).toLocaleString()}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Source</Label><p><Badge variant="outline">{selectedDispute._source === 'gateway' ? 'Chargeback' : 'Customer'}</Badge></p></div>
                    <div><Label className="text-muted-foreground text-xs">Reason</Label><p>{selectedDispute.reason || selectedDispute.dispute_type?.replace(/_/g, ' ') || '—'}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Priority</Label><p><Badge variant={(PRIORITY_COLORS[selectedDispute.priority || 'normal'] || 'outline') as any}>{selectedDispute.priority || 'normal'}</Badge></p></div>
                    {selectedDispute._source === 'gateway' && selectedDispute._merchant_name && (
                      <div><Label className="text-muted-foreground text-xs">Merchant</Label><p>{selectedDispute._merchant_name}</p></div>
                    )}
                    {selectedDispute.evidence_submitted !== undefined && (
                      <div><Label className="text-muted-foreground text-xs">Evidence</Label><p>{selectedDispute.evidence_submitted ? '✅ Submitted' : '❌ Not yet'}</p></div>
                    )}
                    {selectedDispute.evidence_due_by && (
                      <div><Label className="text-muted-foreground text-xs">Evidence Due</Label>
                        <p className={new Date(selectedDispute.evidence_due_by) < new Date() ? 'text-destructive font-medium text-xs' : 'text-xs'}>
                          {format(new Date(selectedDispute.evidence_due_by), "MMM d, yyyy")}
                        </p>
                      </div>
                    )}
                    <div><Label className="text-muted-foreground text-xs">Filed</Label><p>{format(new Date(selectedDispute.created_at), "MMM d, yyyy HH:mm")}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Category</Label><p>{selectedDispute.category || selectedDispute.dispute_type?.replace(/_/g, ' ') || 'general'}</p></div>
                  </div>
                  {selectedDispute.description && (
                    <div className="mt-3 p-1"><Label className="text-muted-foreground text-xs">Description</Label><p className="text-sm">{selectedDispute.description}</p></div>
                  )}
                  {selectedDispute.evidence_data && (
                    <div className="mt-3 p-1">
                      <Label className="text-muted-foreground text-xs">Evidence Data</Label>
                      <pre className="mt-1 p-3 rounded-lg bg-muted text-xs overflow-auto max-h-32">{JSON.stringify(selectedDispute.evidence_data, null, 2)}</pre>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 p-1">
                      {activities.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">No activity recorded yet</p>
                      ) : activities.map((a: any) => (
                        <div key={a.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                              a.action === 'status_change' ? 'bg-blue-500' :
                              a.action === 'escalated' ? 'bg-red-500' :
                              a.action === 'note_added' ? 'bg-amber-500' :
                              a.action === 'evidence_submitted' ? 'bg-green-500' :
                              a.action === 'assigned' ? 'bg-purple-500' :
                              'bg-muted-foreground'
                            }`} />
                            <div className="w-px flex-1 bg-border" />
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium capitalize">{a.action.replace(/_/g, ' ')}</span>
                              {a.from_status && a.to_status && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Badge variant="outline" className="text-[10px]">{a.from_status}</Badge>
                                  <ArrowRight className="h-3 w-3" />
                                  <Badge variant="outline" className="text-[10px]">{a.to_status}</Badge>
                                </span>
                              )}
                            </div>
                            {a.note && <p className="text-xs text-muted-foreground mt-0.5">{a.note}</p>}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {a.actor_type} · {format(new Date(a.created_at), "MMM d, yyyy HH:mm")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="actions" className="flex-1 overflow-auto">
                  <div className="space-y-4 p-1">
                    {/* Move Status */}
                    {!isTerminal(selectedDispute.status) && (
                      <div className="space-y-2">
                        <Label>Move to Status</Label>
                        <div className="flex flex-wrap gap-2">
                          {KANBAN_COLUMNS.filter(c => c.key !== selectedDispute.status && c.key !== 'open').map(col => (
                            <Button key={col.key} size="sm" variant="outline" className="gap-1"
                              onClick={() => handleStatusChange(selectedDispute, col.key)}
                              disabled={lifecycleMutation.isPending}>
                              <div className={`w-2 h-2 rounded-full ${col.color}`} />
                              {col.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Escalate to Admin with reason */}
                    {!isTerminal(selectedDispute.status) && selectedDispute.status !== 'escalated' && (
                      <Button variant="destructive" size="sm" className="w-full gap-1"
                        onClick={() => { setEscalateDispute(selectedDispute); setEscalateOpen(true); }}>
                        <ArrowUpCircle className="h-3.5 w-3.5" /> Escalate to KOB Admin
                      </Button>
                    )}

                    {/* Submit Evidence (gateway only) */}
                    {selectedDispute._source === 'gateway' && !selectedDispute.evidence_submitted && !isTerminal(selectedDispute.status) && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> Submit Evidence</Label>
                        <Textarea value={evidenceText} onChange={e => setEvidenceText(e.target.value)} placeholder="Describe evidence..." rows={3} />
                        <Button size="sm" variant="outline" onClick={() => submitEvidenceMutation.mutate()} disabled={!evidenceText.trim() || submitEvidenceMutation.isPending} className="gap-1">
                          {submitEvidenceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Submit Evidence
                        </Button>
                      </div>
                    )}

                    {/* Assign to staff */}
                    <div className="space-y-2">
                      <Label>Assign To Staff</Label>
                      <Select onValueChange={v => handleAssign(selectedDispute, v)}>
                        <SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger>
                        <SelectContent>
                          {staffMembers.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Add Note */}
                    <div className="space-y-2">
                      <Label>Internal Note</Label>
                      <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add internal note..." rows={3} />
                      <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim() || lifecycleMutation.isPending} className="gap-1">
                        <MessageSquare className="h-3.5 w-3.5" /> Add Note
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Escalate Confirmation Dialog */}
      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-destructive" />
              Escalate to KOB Admin
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will escalate the dispute to the KOB platform administrators for final review and decision.
              {escalateDispute && (
                <span className="font-medium block mt-1">
                  Dispute: {escalateDispute.dispute_ref || escalateDispute.id?.slice(0, 8)} — {escalateDispute.currency || 'XAF'} {Number(escalateDispute.amount).toLocaleString()}
                </span>
              )}
            </p>
            <div>
              <Label>Reason for Escalation</Label>
              <Textarea value={escalateNote} onChange={e => setEscalateNote(e.target.value)}
                placeholder="Explain why this dispute needs admin review..." rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEscalateOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleEscalateConfirm} disabled={lifecycleMutation.isPending}>
                {lifecycleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Confirm Escalation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
