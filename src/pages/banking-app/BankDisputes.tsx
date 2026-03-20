import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert, Plus, Clock, CheckCircle, XCircle, AlertTriangle, ChevronRight, Filter } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function BankDisputes() {
  const navigate = useNavigate();
  const { institutionId } = useParams();
  const [fileOpen, setFileOpen] = useState(false);
  const [detailDispute, setDetailDispute] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ reason: '', description: '', dispute_type: 'unauthorized', amount: '', transaction_ref: '' });
  const [submitting, setSubmitting] = useState(false);

  // Fetch institution name
  const { data: institution } = useQuery({
    queryKey: ["bank-institution", institutionId],
    queryFn: async () => {
      if (!institutionId) return null;
      const { data } = await supabase.from("institutions").select("institution_name").eq("id", institutionId).single();
      return data;
    },
    enabled: !!institutionId,
  });

  const { data: disputes, isLoading, refetch } = useQuery({
    queryKey: ["bank-disputes", institutionId, statusFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let query = supabase.from("disputes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (institutionId) query = query.eq("institution_id", institutionId);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data } = await query;
      return data || [];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["bank-dispute-activities", detailDispute?.id],
    queryFn: async () => {
      if (!detailDispute) return [];
      const { data } = await supabase.from("dispute_activities" as any).select("*").eq("dispute_id", detailDispute.id).order("created_at", { ascending: true });
      return (data as any[]) || [];
    },
    enabled: !!detailDispute,
  });

  const handleFileDispute = async () => {
    if (!form.reason.trim() || !form.amount) {
      toast({ title: "Missing information", description: "Please provide a reason and amount", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("gateway-file-dispute", {
        body: {
          reason: form.reason,
          description: form.description,
          dispute_type: form.dispute_type,
          amount: parseFloat(form.amount),
          currency: 'XAF',
          transaction_ref: form.transaction_ref || undefined,
          institution_id: institutionId || undefined,
        },
      });
      if (error) throw error;
      toast({ title: "Dispute filed", description: "Your dispute has been submitted. You'll receive updates via notifications and email." });
      setFileOpen(false);
      setForm({ reason: '', description: '', dispute_type: 'unauthorized', amount: '', transaction_ref: '' });
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not file dispute", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (['won', 'resolved'].includes(s)) return "default";
    if (['lost', 'rejected'].includes(s)) return "destructive";
    if (['investigating', 'under_review', 'escalated'].includes(s)) return "secondary";
    return "outline";
  };

  const statusIcon = (s: string) => {
    if (['won', 'resolved'].includes(s)) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (['lost', 'rejected'].includes(s)) return <XCircle className="h-4 w-4 text-destructive" />;
    if (s === 'escalated') return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const stats = {
    total: disputes?.length || 0,
    open: disputes?.filter(d => d.status === 'open').length || 0,
    active: disputes?.filter(d => ['investigating', 'under_review', 'escalated'].includes(d.status)).length || 0,
    resolved: disputes?.filter(d => ['resolved', 'won', 'closed'].includes(d.status)).length || 0,
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-xl font-bold">Disputes</h1>
            <p className="text-sm text-muted-foreground">
              {institution?.institution_name ? `${institution.institution_name} · ` : ''}File & track banking disputes
            </p>
          </div>
        </div>
        <Dialog open={fileOpen} onOpenChange={setFileOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> File Dispute</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>File a Dispute</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {institution?.institution_name && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <span className="text-muted-foreground">Filing against:</span>
                  <span className="font-medium ml-1">{institution.institution_name}</span>
                </div>
              )}
              <div><Label>Type</Label>
                <Select value={form.dispute_type} onValueChange={v => setForm(p => ({ ...p, dispute_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unauthorized">Unauthorized Transaction</SelectItem>
                    <SelectItem value="duplicate">Duplicate Charge</SelectItem>
                    <SelectItem value="not_received">Service Not Received</SelectItem>
                    <SelectItem value="wrong_amount">Wrong Amount</SelectItem>
                    <SelectItem value="defective">Defective Service</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Amount (XAF)</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" /></div>
              <div><Label>Transaction Ref (optional)</Label><Input value={form.transaction_ref} onChange={e => setForm(p => ({ ...p, transaction_ref: e.target.value }))} /></div>
              <div><Label>Reason</Label><Input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Brief reason for your dispute" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Provide additional details..." /></div>
              <Button className="w-full" onClick={handleFileDispute} disabled={submitting}>{submitting ? "Submitting..." : "Submit Dispute"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total</p><p className="text-lg font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Open</p><p className="text-lg font-bold text-amber-600">{stats.open}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Active</p><p className="text-lg font-bold text-blue-600">{stats.active}</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Resolved</p><p className="text-lg font-bold text-green-600">{stats.resolved}</p></CardContent></Card>
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2"><Filter className="h-3.5 w-3.5" /><SelectValue placeholder="Filter by status" /></div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="investigating">Investigating</SelectItem>
          <SelectItem value="under_review">Under Review</SelectItem>
          <SelectItem value="escalated">Escalated</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="won">Won</SelectItem>
          <SelectItem value="lost">Lost</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : !disputes?.length ? (
        <Card><CardContent className="py-12 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No disputes</p>
          <p className="text-sm text-muted-foreground mt-1">File a dispute for any banking transaction issue.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {disputes.map((d: any) => (
            <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailDispute(d)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {statusIcon(d.status)}
                      <p className="font-medium text-sm truncate">{d.reason}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      XAF {Number(d.amount).toLocaleString()} · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {d.dispute_type?.replace(/_/g, ' ')} · Ref: {d.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant={statusColor(d.status)}>{d.status.replace(/_/g, ' ')}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail */}
      <Dialog open={!!detailDispute} onOpenChange={open => !open && setDetailDispute(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          {detailDispute && (
            <>
              <DialogHeader><DialogTitle>Dispute #{detailDispute.id.slice(0, 8).toUpperCase()}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs text-muted-foreground">Status</Label><p><Badge variant={statusColor(detailDispute.status)}>{detailDispute.status.replace(/_/g, ' ')}</Badge></p></div>
                <div><Label className="text-xs text-muted-foreground">Amount</Label><p className="font-semibold">XAF {Number(detailDispute.amount).toLocaleString()}</p></div>
                <div><Label className="text-xs text-muted-foreground">Type</Label><p>{detailDispute.dispute_type?.replace(/_/g, ' ')}</p></div>
                <div><Label className="text-xs text-muted-foreground">Filed</Label><p>{format(new Date(detailDispute.created_at), "MMM d, yyyy")}</p></div>
              </div>
              {detailDispute.description && <div className="text-sm mt-2"><Label className="text-xs text-muted-foreground">Description</Label><p>{detailDispute.description}</p></div>}
              {detailDispute.resolution && <div className="text-sm mt-2"><Label className="text-xs text-muted-foreground">Resolution</Label><p>{detailDispute.resolution}</p></div>}
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Timeline</Label>
                <ScrollArea className="h-[180px] mt-1">
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No activity yet</p>
                  ) : activities.map((a: any) => (
                    <div key={a.id} className="flex gap-2 text-xs mb-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        a.action === 'status_change' ? 'bg-blue-500' :
                        a.action === 'escalated' ? 'bg-red-500' :
                        a.action === 'note_added' ? 'bg-amber-500' : 'bg-primary'
                      }`} />
                      <div>
                        <span className="font-medium capitalize">{a.action.replace(/_/g, ' ')}</span>
                        {a.from_status && a.to_status && (
                          <span className="text-muted-foreground"> ({a.from_status} → {a.to_status})</span>
                        )}
                        {a.note && <span className="text-muted-foreground"> — {a.note}</span>}
                        <p className="text-muted-foreground">{format(new Date(a.created_at), "MMM d, HH:mm")} · {a.actor_type}</p>
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
