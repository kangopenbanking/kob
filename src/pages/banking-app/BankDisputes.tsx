import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert, Plus, Clock, CheckCircle, XCircle, AlertTriangle, ChevronRight } from "lucide-react";
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
  const [form, setForm] = useState({ reason: '', description: '', dispute_type: 'unauthorized', amount: '', transaction_ref: '' });
  const [submitting, setSubmitting] = useState(false);

  const { data: disputes, isLoading, refetch } = useQuery({
    queryKey: ["bank-disputes", institutionId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let query = supabase.from("disputes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (institutionId) query = query.eq("institution_id", institutionId);
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
      toast({ title: "Dispute filed", description: "Your dispute has been submitted successfully." });
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

  return (
    <div className="min-h-screen bg-background p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-xl font-bold">Disputes</h1>
            <p className="text-sm text-muted-foreground">File & track banking disputes</p>
          </div>
        </div>
        <Dialog open={fileOpen} onOpenChange={setFileOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> File Dispute</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>File a Dispute</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Type</Label>
                <Select value={form.dispute_type} onValueChange={v => setForm(p => ({ ...p, dispute_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unauthorized">Unauthorized Transaction</SelectItem>
                    <SelectItem value="duplicate">Duplicate Charge</SelectItem>
                    <SelectItem value="not_received">Service Not Received</SelectItem>
                    <SelectItem value="wrong_amount">Wrong Amount</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Amount (XAF)</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" /></div>
              <div><Label>Transaction Ref (optional)</Label><Input value={form.transaction_ref} onChange={e => setForm(p => ({ ...p, transaction_ref: e.target.value }))} /></div>
              <div><Label>Reason</Label><Input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Brief reason" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
              <Button className="w-full" onClick={handleFileDispute} disabled={submitting}>{submitting ? "Submitting..." : "Submit Dispute"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{d.reason}</p>
                    <p className="text-xs text-muted-foreground">XAF {Number(d.amount).toLocaleString()} · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</p>
                  </div>
                  <div className="flex items-center gap-2">
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
              <DialogHeader><DialogTitle>Dispute #{detailDispute.id.slice(0, 8)}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs text-muted-foreground">Status</Label><p><Badge variant={statusColor(detailDispute.status)}>{detailDispute.status.replace(/_/g, ' ')}</Badge></p></div>
                <div><Label className="text-xs text-muted-foreground">Amount</Label><p className="font-semibold">XAF {Number(detailDispute.amount).toLocaleString()}</p></div>
                <div><Label className="text-xs text-muted-foreground">Type</Label><p>{detailDispute.dispute_type?.replace(/_/g, ' ')}</p></div>
                <div><Label className="text-xs text-muted-foreground">Filed</Label><p>{format(new Date(detailDispute.created_at), "MMM d, yyyy")}</p></div>
              </div>
              {detailDispute.resolution && <div className="text-sm mt-2"><Label className="text-xs text-muted-foreground">Resolution</Label><p>{detailDispute.resolution}</p></div>}
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Timeline</Label>
                <ScrollArea className="h-[180px] mt-1">
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No activity yet</p>
                  ) : activities.map((a: any) => (
                    <div key={a.id} className="flex gap-2 text-xs mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium capitalize">{a.action.replace(/_/g, ' ')}</span>
                        {a.note && <span className="text-muted-foreground"> — {a.note}</span>}
                        <p className="text-muted-foreground">{format(new Date(a.created_at), "MMM d, HH:mm")}</p>
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
