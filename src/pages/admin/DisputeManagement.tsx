import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, CheckCircle, Clock, XCircle, AlertTriangle, Eye, Shield, Scale, ArrowRight, User, MessageSquare, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { motion, AnimatePresence } from "framer-motion";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

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

export default function DisputeManagement() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [resolution, setResolution] = useState("");

  // Gateway disputes
  const { data: gatewayDisputes = [], isLoading: gwLoading } = useQuery({
    queryKey: ["admin-gw-disputes"],
    queryFn: async () => {
      const { data } = await supabase.from("gateway_disputes").select("*, gateway_merchants(business_name, business_email, user_id)").order("created_at", { ascending: false });
      return (data || []).map((d: any) => ({ ...d, _source: 'gateway' }));
    },
  });

  // Legacy disputes
  const { data: legacyDisputes = [], isLoading: legLoading } = useQuery({
    queryKey: ["admin-leg-disputes"],
    queryFn: async () => {
      const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false });
      return (data || []).map((d: any) => ({ ...d, _source: 'legacy' }));
    },
  });

  // Activities for selected dispute
  const { data: activities = [] } = useQuery({
    queryKey: ["dispute-activities", selectedDispute?.id],
    queryFn: async () => {
      if (!selectedDispute) return [];
      const { data } = await supabase.from("dispute_activities" as any).select("*").eq("dispute_id", selectedDispute.id).order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!selectedDispute,
  });

  // Admins for assignment
  const { data: adminUsers = [] } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (!roles?.length) return [];
      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return profiles || [];
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: async (params: any) => {
      const { error, data } = await supabase.functions.invoke("dispute-lifecycle", { body: params });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gw-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-leg-disputes"] });
      queryClient.invalidateQueries({ queryKey: ["dispute-activities"] });
      toast.success("Dispute updated");
    },
    onError: (e: any) => toast.error(extractEdgeFunctionError(e, "Failed to update dispute")),
  });

  const allDisputes = [...gatewayDisputes, ...legacyDisputes].filter(d => {
    if (sourceFilter !== 'all' && d._source !== sourceFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const name = d._source === 'gateway' ? (d.gateway_merchants as any)?.business_name || '' : '';
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
      dispute_source: dispute._source,
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
      dispute_source: selectedDispute._source,
      action: 'add_note',
      note: noteText,
    });
    setNoteText("");
  };

  const handleAssign = (dispute: any, assigneeId: string) => {
    lifecycleMutation.mutate({
      dispute_id: dispute.id,
      dispute_source: dispute._source,
      action: 'assign',
      assignee_id: assigneeId,
    });
  };

  const handleEscalate = (dispute: any) => {
    lifecycleMutation.mutate({
      dispute_id: dispute.id,
      dispute_source: dispute._source,
      action: 'escalate',
      note: 'Escalated for senior review',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: 'outline', investigating: 'secondary', under_review: 'secondary',
      escalated: 'destructive', won: 'default', resolved: 'default',
      lost: 'destructive', closed: 'secondary', rejected: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.replace(/_/g, ' ')}</Badge>;
  };

  const DisputeCard = ({ dispute }: { dispute: any }) => {
    const merchant = dispute._source === 'gateway' ? dispute.gateway_merchants as any : null;
    const daysOpen = formatDistanceToNow(new Date(dispute.created_at), { addSuffix: false });
    const ref = dispute.dispute_ref || dispute.id.slice(0, 8);

    return (
      <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className="p-3 bg-card border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-2"
        onClick={() => { setSelectedDispute(dispute); setDetailOpen(true); }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{ref}</span>
          <Badge variant={(PRIORITY_COLORS[dispute.priority || 'normal'] || 'outline') as any} className="text-[10px] px-1.5 py-0">
            {dispute.priority || 'normal'}
          </Badge>
        </div>
        <p className="text-sm font-semibold">{dispute.currency} {Number(dispute.amount).toLocaleString()}</p>
        <p className="text-xs text-muted-foreground truncate">{dispute.reason || dispute.dispute_type || 'Chargeback'}</p>
        {merchant && <p className="text-xs truncate"><User className="inline h-3 w-3 mr-1" />{merchant.business_name}</p>}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{daysOpen} ago</span>
          <Badge variant="outline" className="text-[10px] px-1">{dispute._source}</Badge>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Scale} title="Dispute & Chargeback Management" description="Kanban board — drag disputes through resolution stages" />

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
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="gateway">Gateway</SelectItem>
            <SelectItem value="legacy">Platform</SelectItem>
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
                  <tr key={d.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedDispute(d); setDetailOpen(true); }}>
                    <td className="p-3 font-mono text-xs">{d.dispute_ref || d.id.slice(0, 8)}</td>
                    <td className="p-3"><Badge variant="outline" className="text-xs">{d._source}</Badge></td>
                    <td className="p-3 font-semibold">{d.currency} {Number(d.amount).toLocaleString()}</td>
                    <td className="p-3 max-w-[200px] truncate">{d.reason || d.dispute_type || '—'}</td>
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
                    <div><Label className="text-muted-foreground text-xs">Amount</Label><p className="font-semibold">{selectedDispute.currency} {Number(selectedDispute.amount).toLocaleString()}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Source</Label><p><Badge variant="outline">{selectedDispute._source}</Badge></p></div>
                    <div><Label className="text-muted-foreground text-xs">Reason</Label><p>{selectedDispute.reason || selectedDispute.dispute_type || '—'}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Priority</Label><p><Badge variant={(PRIORITY_COLORS[selectedDispute.priority || 'normal'] || 'outline') as any}>{selectedDispute.priority || 'normal'}</Badge></p></div>
                    {selectedDispute._source === 'gateway' && (
                      <>
                        <div><Label className="text-muted-foreground text-xs">Merchant</Label><p>{(selectedDispute.gateway_merchants as any)?.business_name || '—'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Provider</Label><p>{selectedDispute.provider || '—'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Evidence Submitted</Label><p>{selectedDispute.evidence_submitted ? '✅ Yes' : '❌ No'}</p></div>
                        <div><Label className="text-muted-foreground text-xs">Evidence Due</Label><p>{selectedDispute.evidence_due_by ? format(new Date(selectedDispute.evidence_due_by), "MMM d, yyyy") : '—'}</p></div>
                      </>
                    )}
                    <div><Label className="text-muted-foreground text-xs">Filed</Label><p>{format(new Date(selectedDispute.created_at), "MMM d, yyyy HH:mm")}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Category</Label><p>{selectedDispute.category || selectedDispute.dispute_type || 'chargeback'}</p></div>
                  </div>
                  {selectedDispute.evidence_data && (
                    <div className="mt-4 p-1">
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
                    {!['won', 'lost', 'closed', 'resolved', 'rejected'].includes(selectedDispute.status) && (
                      <div className="space-y-2">
                        <Label>Move to Status</Label>
                        <div className="flex flex-wrap gap-2">
                          {KANBAN_COLUMNS.filter(c => c.key !== selectedDispute.status && !['open'].includes(c.key)).map(col => (
                            <Button key={col.key} size="sm" variant="outline" className="gap-1"
                              onClick={() => handleStatusChange(selectedDispute, col.key)}>
                              <div className={`w-2 h-2 rounded-full ${col.color}`} />
                              {col.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Escalate */}
                    {!['escalated', 'won', 'lost', 'closed'].includes(selectedDispute.status) && (
                      <Button variant="destructive" size="sm" className="w-full" onClick={() => handleEscalate(selectedDispute)}>
                        🔥 Escalate for Senior Review
                      </Button>
                    )}

                    {/* Assign */}
                    <div className="space-y-2">
                      <Label>Assign To</Label>
                      <Select onValueChange={v => handleAssign(selectedDispute, v)}>
                        <SelectTrigger><SelectValue placeholder="Select admin..." /></SelectTrigger>
                        <SelectContent>
                          {adminUsers.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Add Note */}
                    <div className="space-y-2">
                      <Label>Internal Note</Label>
                      <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add internal note..." rows={3} />
                      <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()} className="gap-1">
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
    </div>
  );
}
