import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert, Plus, Clock, CheckCircle, XCircle, AlertTriangle, ChevronRight, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Investigating", value: "investigating" },
  { label: "Under Review", value: "under_review" },
  { label: "Escalated", value: "escalated" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
];

export default function CustomerDisputes() {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [fileOpen, setFileOpen] = useState(false);
  const [detailDispute, setDetailDispute] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({
    reason: '', description: '', dispute_type: 'unauthorized', amount: '',
    transaction_ref: '', institution_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch recent transactions for selector
  // Fetch user's account IDs first
  const { data: userAccounts = [] } = useQuery({
    queryKey: ["customer-accounts-for-disputes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const userAccountIds = userAccounts.map((a: any) => a.id);

  const { data: recentTxns = [] } = useQuery({
    queryKey: ["customer-recent-txns", user?.id, userAccountIds],
    queryFn: async () => {
      if (!user?.id || userAccountIds.length === 0) return [];
      const { data } = await supabase
        .from("transactions")
        .select("id, amount, currency, transaction_information, booking_datetime, account_id")
        .in("account_id", userAccountIds)
        .order("booking_datetime", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user?.id && userAccountIds.length > 0,
  });

  // Fetch linked institutions
  const { data: institutions = [] } = useQuery({
    queryKey: ["customer-institutions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: accounts } = await supabase
        .from("accounts")
        .select("institution_id, institutions(id, institution_name)")
        .eq("user_id", user.id)
        .not("institution_id", "is", null);
      if (!accounts) return [];
      const unique = new Map<string, string>();
      accounts.forEach((a: any) => {
        if (a.institutions) unique.set(a.institutions.id, a.institutions.institution_name);
      });
      return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
    },
    enabled: !!user?.id,
  });

  const { data: disputes, isLoading, refetch } = useQuery({
    queryKey: ["customer-disputes"],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return [];
      const { data } = await supabase.from("disputes").select("*").eq("user_id", authUser.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["cust-dispute-activities", detailDispute?.id],
    queryFn: async () => {
      if (!detailDispute) return [];
      const { data } = await supabase.from("dispute_activities" as any).select("*").eq("dispute_id", detailDispute.id).order("created_at", { ascending: true });
      return (data as any[]) || [];
    },
    enabled: !!detailDispute,
  });

  const filteredDisputes = useMemo(() => {
    if (!disputes) return [];
    if (statusFilter === "all") return disputes;
    return disputes.filter((d: any) => d.status === statusFilter);
  }, [disputes, statusFilter]);

  const handleSelectTransaction = (txnId: string) => {
    const txn = recentTxns.find((t: any) => t.id === txnId);
    if (txn) {
      setForm(p => ({
        ...p,
        transaction_ref: txn.id,
        amount: String(Math.abs(txn.amount || 0)),
        reason: p.reason || txn.transaction_information || '',
      }));
    }
  };

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
          institution_id: form.institution_id || undefined,
        },
      });
      if (error) throw error;
      toast({ title: "Dispute filed", description: "Your dispute has been submitted. We'll review it within 5 business days." });
      setFileOpen(false);
      setForm({ reason: '', description: '', dispute_type: 'unauthorized', amount: '', transaction_ref: '', institution_id: '' });
      refetch();
    } catch (err: any) {
      toast({ title: "Error", description: extractEdgeFunctionError(err, "Could not file dispute"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const statusIcon = (s: string) => {
    if (['won', 'resolved'].includes(s)) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (['lost', 'rejected'].includes(s)) return <XCircle className="h-4 w-4 text-destructive" />;
    if (['investigating', 'under_review'].includes(s)) return <Clock className="h-4 w-4 text-blue-600" />;
    return <AlertTriangle className="h-4 w-4 text-amber-600" />;
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
            <h1 className="text-xl font-bold">My Disputes</h1>
            <p className="text-sm text-muted-foreground">File & track disputes</p>
          </div>
        </div>
        <Dialog open={fileOpen} onOpenChange={setFileOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> File Dispute</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>File a Dispute</DialogTitle></DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-3 pr-2">
                {/* Transaction Selector */}
                {recentTxns.length > 0 && (
                  <div>
                    <Label>Select a Transaction (optional)</Label>
                    <Select onValueChange={handleSelectTransaction}>
                      <SelectTrigger><SelectValue placeholder="Pick from recent transactions" /></SelectTrigger>
                      <SelectContent>
                        {recentTxns.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.transaction_information || t.transaction_reference || t.id.slice(0, 8)} — {t.currency} {Math.abs(t.amount || 0).toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Institution Selector */}
                {institutions.length > 0 && (
                  <div>
                    <Label>Institution (optional)</Label>
                    <Select value={form.institution_id} onValueChange={v => setForm(p => ({ ...p, institution_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select institution" /></SelectTrigger>
                      <SelectContent>
                        {institutions.map((inst: any) => (
                          <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div><Label>Dispute Type</Label>
                  <Select value={form.dispute_type} onValueChange={v => setForm(p => ({ ...p, dispute_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unauthorized">Unauthorized Transaction</SelectItem>
                      <SelectItem value="duplicate">Duplicate Charge</SelectItem>
                      <SelectItem value="not_received">Product/Service Not Received</SelectItem>
                      <SelectItem value="defective">Defective Product</SelectItem>
                      <SelectItem value="wrong_amount">Wrong Amount</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Amount (XAF)</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" /></div>
                <div><Label>Transaction Reference</Label><Input value={form.transaction_ref} onChange={e => setForm(p => ({ ...p, transaction_ref: e.target.value }))} placeholder="e.g. TXN-123456" /></div>
                <div><Label>Reason</Label><Input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Brief reason for dispute" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Provide details..." rows={3} /></div>
                <Button className="w-full" onClick={handleFileDispute} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Dispute"}
                </Button>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Filter Chips */}
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
            {f.value !== "all" && disputes && (
              <span className="ml-1 opacity-70">
                {disputes.filter((d: any) => d.status === f.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : !filteredDisputes.length ? (
        <Card><CardContent className="py-12 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No disputes</p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== "all" ? "No disputes with this status." : "File a dispute if you have an issue with a transaction."}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredDisputes.map((d: any) => (
            <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailDispute(d)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {statusIcon(d.status)}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{d.reason}</p>
                      <p className="text-xs text-muted-foreground">XAF {Number(d.amount).toLocaleString()} · {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusColor(d.status)}>{d.status.replace(/_/g, ' ')')</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailDispute} onOpenChange={open => !open && setDetailDispute(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          {detailDispute && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {statusIcon(detailDispute.status)}
                  Dispute #{detailDispute.id.slice(0, 8)}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs text-muted-foreground">Status</Label><p><Badge variant={statusColor(detailDispute.status)}>{detailDispute.status.replace(/_/g, ' ')')</Badge></p></div>
                <div><Label className="text-xs text-muted-foreground">Amount</Label><p className="font-semibold">XAF {Number(detailDispute.amount).toLocaleString()}</p></div>
                <div><Label className="text-xs text-muted-foreground">Type</Label><p>{detailDispute.dispute_type?.replace(/_/g, ' ')')</p></div>
                <div><Label className="text-xs text-muted-foreground">Filed</Label><p>{format(new Date(detailDispute.created_at), "MMM d, yyyy")}</p></div>
              </div>
              <div className="text-sm"><Label className="text-xs text-muted-foreground">Reason</Label><p>{detailDispute.reason}</p></div>
              {detailDispute.description && <div className="text-sm"><Label className="text-xs text-muted-foreground">Description</Label><p>{detailDispute.description}</p></div>}
              {detailDispute.resolution && <div className="text-sm"><Label className="text-xs text-muted-foreground">Resolution</Label><p className="text-green-700">{detailDispute.resolution}</p></div>}

              {/* Timeline */}
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">Activity Timeline</Label>
                <ScrollArea className="h-[200px] mt-1">
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No activity yet</p>
                  ) : (
                    <div className="space-y-2">
                      {activities.map((a: any) => (
                        <div key={a.id} className="flex gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div>
                            <span className="font-medium capitalize">{a.action.replace(/_/g, ' ')')</span>
                            {a.note && <span className="text-muted-foreground"> — {a.note}</span>}
                            <p className="text-muted-foreground">{format(new Date(a.created_at), "MMM d, HH:mm")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
