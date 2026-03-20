import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeftRight, Activity, RefreshCw, Search, ChevronDown, FileText, Clock,
  AlertTriangle, CheckCircle2, XCircle, Loader2, Network, Database, Send,
  TrendingUp, Globe, Shield, Users, CreditCard, Zap, MailWarning, Inbox
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  validated: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-destructive/10 text-destructive",
  in_process: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  settled: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-destructive/10 text-destructive",
  reversed: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  expired: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  dead_letter: "bg-destructive/10 text-destructive",
  processed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.03, duration: 0.25 } }),
};

function invokeEngine(action: string, params: any = {}) {
  return supabase.functions.invoke("interbank-engine", { body: { action, ...params } });
}

function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-2xl bg-muted/50 p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`rounded-xl p-2.5 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// PAYMENTS TAB
// ═══════════════════════════════════════════════════════
function PaymentsTab() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["interbank-payments", statusFilter],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (statusFilter !== "all") params.status = statusFilter;
      const { data, error } = await invokeEngine("list_payments", params);
      if (error) throw error;
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await invokeEngine("submit_payment", { payment_id: paymentId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Payment submitted successfully"); queryClient.invalidateQueries({ queryKey: ["interbank-payments"] }); },
    onError: (err: any) => toast.error(err.message || "Submit failed"),
  });

  const reverseMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await invokeEngine("reverse_payment", { payment_id: paymentId, reason: "Admin manual reversal" });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Payment reversed"); queryClient.invalidateQueries({ queryKey: ["interbank-payments"] }); },
    onError: (err: any) => toast.error(err.message || "Reversal failed"),
  });

  const payments = (data?.payments || []).filter((p: any) =>
    !search || p.id?.includes(search) || p.correlation_id?.includes(search) || p.debtor_account_ref?.includes(search) || p.creditor_account_ref?.includes(search)
  );

  const settledCount = payments.filter((p: any) => p.status === "settled").length;
  const totalVolume = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={CreditCard} label="Total Payments" value={payments.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Settled" value={settledCount} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={XCircle} label="Failed/Rejected" value={payments.filter((p: any) => ["failed", "rejected"].includes(p.status)).length} color="bg-destructive/10 text-destructive" />
        <StatCard icon={TrendingUp} label="Volume" value={`${totalVolume.toLocaleString()} XAF`} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID, correlation ID, or account ref..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {["created", "validated", "submitted", "accepted", "in_process", "settled", "rejected", "failed", "reversed"].map(s =>
              <SelectItem key={s} value={s}>{s}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Payment ID</TableHead>
                <TableHead>Debtor → Creditor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                payments.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={ArrowLeftRight} title="No interbank payments" description="Interbank payments will appear here when initiated via the ISO 20022 engine." /></TableCell></TableRow>
                ) :
                payments.map((p: any, i: number) => (
                  <motion.tr key={p.id} variants={rowVariants} initial="hidden" animate="visible" custom={i}
                    className="border-b transition-colors hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedPayment(p)}>
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{p.id?.slice(0, 12)}</code></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-medium">{p.debtor?.participant_code || p.debtor_participant_id?.slice(0, 8)}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{p.creditor?.participant_code || p.creditor_participant_id?.slice(0, 8)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{Number(p.amount).toLocaleString()} {p.currency}</TableCell>
                    <TableCell><Badge className={`${STATUS_COLORS[p.status] || ""} font-medium`}>{p.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        {p.status === 'created' && (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => submitMutation.mutate(p.id)} disabled={submitMutation.isPending}>
                            <Send className="h-3.5 w-3.5 mr-1" />Submit
                          </Button>
                        )}
                        {['settled', 'failed', 'rejected'].includes(p.status) && (
                          <Button size="sm" variant="destructive" className="h-8" onClick={() => reverseMutation.mutate(p.id)} disabled={reverseMutation.isPending}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />Reverse
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedPayment && <PaymentDetailDialog payment={selectedPayment} onClose={() => setSelectedPayment(null)} />}
    </div>
  );
}

function PaymentDetailDialog({ payment, onClose }: { payment: any; onClose: () => void }) {
  const { data: eventsData } = useQuery({
    queryKey: ["interbank-status-events", payment.id],
    queryFn: async () => { const { data } = await invokeEngine("list_status_events", { payment_id: payment.id }); return data; },
  });

  const { data: messagesData } = useQuery({
    queryKey: ["interbank-messages-for-payment", payment.id],
    queryFn: async () => { const { data } = await invokeEngine("list_messages", { payment_id: payment.id }); return data; },
  });

  const events = eventsData?.events || [];
  const messages = messagesData?.messages || [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Payment Detail
          </DialogTitle>
          <DialogDescription>
            <code className="text-xs font-mono">{payment.id}</code>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
            <Badge className={`${STATUS_COLORS[payment.status] || ""} font-medium`}>{payment.status}</Badge>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
            <p className="text-lg font-bold text-foreground">{Number(payment.amount).toLocaleString()} {payment.currency}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Debtor</p>
            <p className="text-sm font-medium">{payment.debtor?.legal_name || payment.debtor_account_ref || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Creditor</p>
            <p className="text-sm font-medium">{payment.creditor?.legal_name || payment.creditor_account_ref || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Correlation ID</p>
            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{payment.correlation_id || "—"}</code>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trace ID</p>
            <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{payment.trace_id || "—"}</code>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-foreground">
            <Clock className="h-4 w-4 text-primary" /> Status Timeline
          </h3>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-6">No status events recorded</p>
          ) : (
            <div className="space-y-3 pl-2">
              {events.map((e: any) => (
                <div key={e.id} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {e.status_to === 'settled' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                     ['rejected', 'failed'].includes(e.status_to) ? <XCircle className="h-4 w-4 text-destructive" /> :
                     <Activity className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{e.status_from || '∅'}</Badge>
                      <span className="text-muted-foreground text-xs">→</span>
                      <Badge className={`${STATUS_COLORS[e.status_to] || ""} font-medium text-xs`}>{e.status_to}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(e.event_time).toLocaleString()} · {e.source}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ISO Messages */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-foreground">
            <FileText className="h-4 w-4 text-primary" /> ISO Messages ({messages.length})
          </h3>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-6">No messages</p>
          ) : messages.map((m: any) => (
            <Collapsible key={m.id} className="rounded-lg border border-border overflow-hidden">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm w-full p-3 hover:bg-muted/50 transition-colors">
                <Badge variant="outline" className="font-mono text-xs">{m.message_type}</Badge>
                <Badge variant={m.direction === 'outbound' ? 'default' : 'secondary'} className="text-xs">{m.direction}</Badge>
                <span className="font-mono text-xs flex-1 text-left text-muted-foreground truncate">{m.message_id?.slice(0, 40)}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="text-xs bg-muted/50 p-4 overflow-x-auto max-h-60 border-t border-border font-mono">{m.payload_raw}</pre>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════
// PARTICIPANTS TAB
// ═══════════════════════════════════════════════════════
function ParticipantsTab() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ participant_code: "", legal_name: "", display_name: "", type: "bank", settlement_mode: "prefunded" });

  const { data, isLoading } = useQuery({
    queryKey: ["interbank-participants"],
    queryFn: async () => { const { data } = await invokeEngine("list_participants", {}); return data; },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeEngine("create_participant", { ...newParticipant, status: "active" });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Participant created");
      queryClient.invalidateQueries({ queryKey: ["interbank-participants"] });
      setShowCreate(false);
      setNewParticipant({ participant_code: "", legal_name: "", display_name: "", type: "bank", settlement_mode: "prefunded" });
    },
    onError: (err: any) => toast.error(err.message || "Create failed"),
  });

  const seedMutation = useMutation({
    mutationFn: async () => { const { data, error } = await invokeEngine("sandbox_seed_participants", {}); if (error) throw error; return data; },
    onSuccess: () => { toast.success("Sandbox participants seeded"); queryClient.invalidateQueries({ queryKey: ["interbank-participants"] }); },
  });

  const participants = data?.participants || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Participants" value={participants.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Active" value={participants.filter((p: any) => p.status === "active").length} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={Globe} label="Banks" value={participants.filter((p: any) => p.type === "bank").length} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
      </div>

      <div className="flex gap-3">
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Users className="h-4 w-4 mr-1.5" />Add Participant
        </Button>
        <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
          <Database className="h-4 w-4 mr-1.5" />Seed Sandbox
        </Button>
      </div>

      {showCreate && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Participant Code</label>
                <Input placeholder="e.g. BANK-CM01" className="mt-1" value={newParticipant.participant_code} onChange={e => setNewParticipant(p => ({ ...p, participant_code: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Legal Name</label>
                <Input placeholder="Legal Name" className="mt-1" value={newParticipant.legal_name} onChange={e => setNewParticipant(p => ({ ...p, legal_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Display Name</label>
                <Input placeholder="Display Name" className="mt-1" value={newParticipant.display_name} onChange={e => setNewParticipant(p => ({ ...p, display_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</label>
                <Select value={newParticipant.type} onValueChange={v => setNewParticipant(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="credit_union">Credit Union</SelectItem>
                    <SelectItem value="switch_partner">Switch Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex gap-2 pt-2">
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newParticipant.participant_code}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Participant
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Code</TableHead>
                <TableHead>Legal Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Settlement Mode</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                participants.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={Users} title="No participants" description="Add interbank participants or seed sandbox data to get started." /></TableCell></TableRow>
                ) :
                participants.map((p: any, i: number) => (
                  <motion.tr key={p.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-primary/5 p-1.5">
                          <Globe className="h-4 w-4 text-primary" />
                        </div>
                        <code className="font-mono font-semibold text-sm">{p.participant_code}</code>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{p.legal_name}</TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{p.type}</Badge></TableCell>
                    <TableCell><Badge className={`${STATUS_COLORS[p.status] || ""} font-medium`}>{p.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.settlement_mode}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MESSAGES TAB
// ═══════════════════════════════════════════════════════
function MessagesTab() {
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["interbank-messages", typeFilter],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (typeFilter !== "all") params.message_type = typeFilter;
      const { data } = await invokeEngine("list_messages", params);
      return data;
    },
  });

  const messages = data?.messages || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Messages" value={messages.length} color="bg-primary/10 text-primary" />
        <StatCard icon={Send} label="Outbound" value={messages.filter((m: any) => m.direction === "outbound").length} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard icon={Inbox} label="Inbound" value={messages.filter((m: any) => m.direction === "inbound").length} color="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" />
        <StatCard icon={CheckCircle2} label="Processed" value={messages.filter((m: any) => m.status === "processed").length} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
      </div>

      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="pacs.008">pacs.008</SelectItem>
          <SelectItem value="pacs.002">pacs.002</SelectItem>
          <SelectItem value="camt.054">camt.054</SelectItem>
          <SelectItem value="pain.001">pain.001</SelectItem>
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Message ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                messages.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={FileText} title="No ISO messages" description="ISO 20022 messages will appear here when payments are processed." /></TableCell></TableRow>
                ) :
                messages.map((m: any, i: number) => (
                  <motion.tr key={m.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{m.message_id?.slice(0, 30)}</code>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{m.message_type}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={m.direction === 'outbound' ? 'default' : 'secondary'} className="text-xs gap-1">
                        {m.direction === 'outbound' ? <Send className="h-3 w-3" /> : <Inbox className="h-3 w-3" />}
                        {m.direction}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge className={`${STATUS_COLORS[m.status] || ""} font-medium`}>{m.status}</Badge></TableCell>
                    <TableCell><code className="text-xs font-mono text-muted-foreground">{m.payment_id?.slice(0, 10) || '—'}</code></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// CONNECTORS TAB
// ═══════════════════════════════════════════════════════
function ConnectorsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["interbank-connectors"],
    queryFn: async () => { const { data } = await invokeEngine("list_connectors", {}); return data; },
  });

  const connectors = data?.connectors || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Network} label="Total Connectors" value={connectors.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Active" value={connectors.filter((c: any) => c.status === "active").length} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={AlertTriangle} label="With Errors" value={connectors.filter((c: any) => c.error_count > 0).length} color="bg-destructive/10 text-destructive" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Participant</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Delivery Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                connectors.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={Network} title="No connectors" description="Bank connectors will appear here when participants register endpoints." /></TableCell></TableRow>
                ) :
                connectors.map((c: any, i: number) => (
                  <motion.tr key={c.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`rounded-lg p-1.5 ${c.status === "active" ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
                          <Network className={`h-4 w-4 ${c.status === "active" ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`} />
                        </div>
                        <span className="font-semibold">{c.participant?.participant_code || c.participant_id?.slice(0, 10)}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{c.env}</Badge></TableCell>
                    <TableCell className="text-sm">{c.delivery_mode}</TableCell>
                    <TableCell><Badge className={`${STATUS_COLORS[c.status] || ""} font-medium`}>{c.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.last_seen_at ? new Date(c.last_seen_at).toLocaleString() : 'Never'}</TableCell>
                    <TableCell>
                      {c.error_count > 0 ? (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{c.error_count}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// OUTBOX TAB
// ═══════════════════════════════════════════════════════
function OutboxTab() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["interbank-outbox", statusFilter],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (statusFilter !== "all") params.status = statusFilter;
      const { data } = await invokeEngine("list_outbox", params);
      return data;
    },
  });

  const replayMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await invokeEngine("replay_outbox", { event_id: eventId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Event re-queued"); queryClient.invalidateQueries({ queryKey: ["interbank-outbox"] }); },
  });

  const events = data?.events || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={Inbox} label="Total Events" value={events.length} color="bg-primary/10 text-primary" />
        <StatCard icon={Clock} label="Pending" value={events.filter((e: any) => e.status === "pending").length} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard icon={CheckCircle2} label="Delivered" value={events.filter((e: any) => e.status === "delivered").length} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={MailWarning} label="Dead Letter" value={events.filter((e: any) => e.status === "dead_letter").length} color="bg-destructive/10 text-destructive" />
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="delivered">Delivered</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="dead_letter">Dead Letter</SelectItem>
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Event ID</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Next Retry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                events.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={Inbox} title="No outbox events" description="Interbank dispatch events will appear here when payments are processed." /></TableCell></TableRow>
                ) :
                events.map((e: any, i: number) => (
                  <motion.tr key={e.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{e.id?.slice(0, 12)}</code></TableCell>
                    <TableCell className="font-medium">{e.event_type}</TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLORS[e.status] || ""} font-medium gap-1`}>
                        {e.status === 'delivered' ? <CheckCircle2 className="h-3 w-3" /> :
                         e.status === 'dead_letter' ? <MailWarning className="h-3 w-3" /> :
                         e.status === 'pending' ? <Clock className="h-3 w-3" /> :
                         <AlertTriangle className="h-3 w-3" />}
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{e.retries}<span className="text-muted-foreground">/{e.max_retries}</span></span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.next_retry_at ? new Date(e.next_retry_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-right">
                      {['failed', 'dead_letter'].includes(e.status) && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => replayMutation.mutate(e.id)}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />Replay
                        </Button>
                      )}
                    </TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// RECONCILIATION TAB
// ═══════════════════════════════════════════════════════
function ReconciliationTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["interbank-reconciliation"],
    queryFn: async () => { const { data } = await invokeEngine("list_reconciliation", {}); return data; },
  });

  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ArrowLeftRight} label="Total Items" value={items.length} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Matched" value={items.filter((r: any) => r.mismatch_count === 0).length} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatCard icon={AlertTriangle} label="Mismatches" value={items.filter((r: any) => r.mismatch_count > 0).length} color="bg-destructive/10 text-destructive" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Participant</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Mismatches</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableSkeleton cols={6} /> :
                items.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={ArrowLeftRight} title="No reconciliation items" description="Settlement reconciliation records will appear here after interbank processing." /></TableCell></TableRow>
                ) :
                items.map((r: any, i: number) => (
                  <motion.tr key={r.id} variants={rowVariants} initial="hidden" animate="visible" custom={i} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell className="font-medium">{r.participant?.participant_code || r.participant_id?.slice(0, 10)}</TableCell>
                    <TableCell className="text-xs">{new Date(r.period_start).toLocaleDateString()} — {new Date(r.period_end).toLocaleDateString()}</TableCell>
                    <TableCell className="font-semibold">{Number(r.expected_total).toLocaleString()} XAF</TableCell>
                    <TableCell className="font-semibold">{Number(r.actual_total).toLocaleString()} XAF</TableCell>
                    <TableCell>
                      {r.mismatch_count > 0 ? (
                        <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{r.mismatch_count}</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1"><CheckCircle2 className="h-3 w-3" />Match</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{r.status}</Badge></TableCell>
                  </motion.tr>
                ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════
export default function AdminInterbankPayments() {
  const [activeTab, setActiveTab] = useState("payments");

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="rounded-2xl bg-primary p-8 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-foreground/20 p-2.5">
            <ArrowLeftRight className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Interbank Payments Engine</h1>
            <p className="text-primary-foreground/80 text-sm">
              ISO 20022 interbank payment processing, connector management & settlement monitoring
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="payments" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CreditCard className="h-4 w-4" />Payments
          </TabsTrigger>
          <TabsTrigger value="participants" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" />Participants
          </TabsTrigger>
          <TabsTrigger value="messages" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" />Messages
          </TabsTrigger>
          <TabsTrigger value="connectors" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Network className="h-4 w-4" />Connectors
          </TabsTrigger>
          <TabsTrigger value="outbox" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Inbox className="h-4 w-4" />Outbox
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="rounded-lg gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ArrowLeftRight className="h-4 w-4" />Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="participants"><ParticipantsTab /></TabsContent>
        <TabsContent value="messages"><MessagesTab /></TabsContent>
        <TabsContent value="connectors"><ConnectorsTab /></TabsContent>
        <TabsContent value="outbox"><OutboxTab /></TabsContent>
        <TabsContent value="reconciliation"><ReconciliationTab /></TabsContent>
      </Tabs>
    </div>
  );
}
