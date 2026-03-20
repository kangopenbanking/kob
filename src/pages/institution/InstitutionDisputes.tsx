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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, ShieldAlert, Eye, AlertTriangle, Clock, CheckCircle, XCircle, MessageSquare, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionDisputes() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [noteText, setNoteText] = useState("");

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["institution-disputes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      // Get institution
      const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!inst) return [];
      let query = supabase.from("disputes").select("*").eq("institution_id", inst.id).order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["inst-dispute-activities", selectedDispute?.id],
    queryFn: async () => {
      if (!selectedDispute) return [];
      const { data } = await supabase.from("dispute_activities" as any).select("*").eq("dispute_id", selectedDispute.id).order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!selectedDispute,
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDispute || !noteText.trim()) return;
      const { error } = await supabase.functions.invoke("dispute-lifecycle", {
        body: { dispute_id: selectedDispute.id, dispute_source: 'legacy', action: 'add_note', note: noteText },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inst-dispute-activities"] });
      toast.success("Note added");
      setNoteText("");
    },
    onError: () => toast.error("Failed to add note"),
  });

  const escalateMutation = useMutation({
    mutationFn: async (disputeId: string) => {
      const { error } = await supabase.functions.invoke("dispute-lifecycle", {
        body: { dispute_id: disputeId, dispute_source: 'legacy', action: 'escalate', note: 'Escalated by institution' },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institution-disputes"] });
      toast.success("Dispute escalated to admin");
    },
    onError: () => toast.error("Failed to escalate"),
  });

  const statusColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (['won', 'resolved'].includes(s)) return "default";
    if (['lost', 'rejected'].includes(s)) return "destructive";
    if (['investigating', 'under_review', 'escalated'].includes(s)) return "secondary";
    return "outline";
  };

  const filtered = disputes.filter(d => !searchTerm || d.reason?.toLowerCase().includes(searchTerm.toLowerCase()) || d.transaction_ref?.toLowerCase().includes(searchTerm.toLowerCase()));

  const stats = {
    total: disputes.length,
    open: disputes.filter(d => d.status === 'open').length,
    reviewing: disputes.filter(d => ['investigating', 'under_review'].includes(d.status)).length,
    resolved: disputes.filter(d => ['resolved', 'won', 'closed'].includes(d.status)).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customer Disputes</h1>
        <p className="text-muted-foreground">Manage disputes filed by your institution's customers</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Open</p><p className="text-2xl font-bold text-amber-600">{stats.open}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Reviewing</p><p className="text-2xl font-bold text-blue-600">{stats.reviewing}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Resolved</p><p className="text-2xl font-bold text-green-600">{stats.resolved}</p></CardContent></Card>
      </div>

      <div className="flex gap-3">
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
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <p className="text-center py-12 text-muted-foreground">Loading...</p> :
          filtered.length === 0 ? (
            <div className="text-center py-12">
              <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-30" />
              <p className="font-medium">No disputes</p>
              <p className="text-sm text-muted-foreground">Customer disputes will appear here</p>
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
                    <TableCell><Badge variant="outline">{d.dispute_type?.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate">{d.reason}</TableCell>
                    <TableCell className="font-semibold">{d.currency} {Number(d.amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={statusColor(d.status)}>{d.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedDispute(d)}><Eye className="h-3.5 w-3.5" /></Button>
                        {!['escalated', 'resolved', 'won', 'lost', 'closed', 'rejected'].includes(d.status) && (
                          <Button size="sm" variant="outline" onClick={() => escalateMutation.mutate(d.id)}>Escalate</Button>
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedDispute} onOpenChange={open => !open && setSelectedDispute(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          {selectedDispute && (
            <>
              <DialogHeader><DialogTitle>Dispute #{selectedDispute.id.slice(0, 8)}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs text-muted-foreground">Status</Label><p><Badge variant={statusColor(selectedDispute.status)}>{selectedDispute.status.replace(/_/g, ' ')}</Badge></p></div>
                <div><Label className="text-xs text-muted-foreground">Amount</Label><p className="font-semibold">{selectedDispute.currency} {Number(selectedDispute.amount).toLocaleString()}</p></div>
                <div><Label className="text-xs text-muted-foreground">Type</Label><p>{selectedDispute.dispute_type?.replace(/_/g, ' ')}</p></div>
                <div><Label className="text-xs text-muted-foreground">Reference</Label><p className="font-mono text-xs">{selectedDispute.transaction_ref || '—'}</p></div>
              </div>
              <div className="text-sm"><Label className="text-xs text-muted-foreground">Reason</Label><p>{selectedDispute.reason}</p></div>

              {/* Timeline */}
              <Label className="text-xs text-muted-foreground mt-2">Activity</Label>
              <ScrollArea className="h-[180px]">
                {activities.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">No activity</p> :
                  activities.map((a: any) => (
                    <div key={a.id} className="flex gap-2 text-xs mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium capitalize">{a.action.replace(/_/g, ' ')}</span>
                        {a.note && <span className="text-muted-foreground"> — {a.note}</span>}
                        <p className="text-muted-foreground">{format(new Date(a.created_at), "MMM d, HH:mm")}</p>
                      </div>
                    </div>
                  ))
                }
              </ScrollArea>

              {/* Add Note */}
              <div className="space-y-2 mt-2">
                <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." rows={2} />
                <Button size="sm" onClick={() => addNoteMutation.mutate()} disabled={!noteText.trim()} className="gap-1">
                  <MessageSquare className="h-3.5 w-3.5" /> Add Note
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
