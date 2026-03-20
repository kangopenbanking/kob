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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ArrowLeftRight, Activity, RefreshCw, Search, ChevronDown, FileText, Clock, AlertTriangle, CheckCircle2, XCircle, Loader2, Network, Database, Send } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  validated: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  rejected: "bg-destructive/10 text-destructive",
  in_process: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  settled: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-destructive/10 text-destructive",
  reversed: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  expired: "bg-muted text-muted-foreground",
};

function invokeEngine(action: string, params: any = {}) {
  return supabase.functions.invoke("interbank-engine", { body: { action, ...params } });
}

export default function AdminInterbankPayments() {
  const [activeTab, setActiveTab] = useState("payments");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interbank Payments Engine</h1>
          <p className="text-muted-foreground">ISO 20022 interbank payment processing, connector management & monitoring</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="outbox">Outbox</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
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
    onSuccess: () => {
      toast.success("Payment submitted successfully");
      queryClient.invalidateQueries({ queryKey: ["interbank-payments"] });
    },
    onError: (err: any) => toast.error(err.message || "Submit failed"),
  });

  const reverseMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await invokeEngine("reverse_payment", { payment_id: paymentId, reason: "Admin manual reversal" });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Payment reversed");
      queryClient.invalidateQueries({ queryKey: ["interbank-payments"] });
    },
    onError: (err: any) => toast.error(err.message || "Reversal failed"),
  });

  const payments = (data?.payments || []).filter((p: any) =>
    !search || p.id?.includes(search) || p.correlation_id?.includes(search) || p.debtor_account_ref?.includes(search) || p.creditor_account_ref?.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID, correlation ID, or account ref..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Debtor → Creditor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : payments.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No interbank payments found</TableCell></TableRow>
              ) : payments.map((p: any) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelectedPayment(p)}>
                  <TableCell className="font-mono text-xs">{p.id?.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <span className="text-xs">{p.debtor?.participant_code || p.debtor_participant_id?.slice(0, 8)}</span>
                    <span className="mx-1">→</span>
                    <span className="text-xs">{p.creditor?.participant_code || p.creditor_participant_id?.slice(0, 8)}</span>
                  </TableCell>
                  <TableCell className="font-semibold">{Number(p.amount).toLocaleString()} {p.currency}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[p.status] || ""}>{p.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
                  <TableCell className="space-x-1" onClick={(e) => e.stopPropagation()}>
                    {p.status === 'created' && (
                      <Button size="sm" variant="outline" onClick={() => submitMutation.mutate(p.id)} disabled={submitMutation.isPending}>
                        <Send className="h-3 w-3 mr-1" />Submit
                      </Button>
                    )}
                    {['settled', 'failed', 'rejected'].includes(p.status) && (
                      <Button size="sm" variant="destructive" onClick={() => reverseMutation.mutate(p.id)} disabled={reverseMutation.isPending}>
                        <RefreshCw className="h-3 w-3 mr-1" />Reverse
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedPayment && (
        <PaymentDetailDialog payment={selectedPayment} onClose={() => setSelectedPayment(null)} />
      )}
    </div>
  );
}

function PaymentDetailDialog({ payment, onClose }: { payment: any; onClose: () => void }) {
  const { data: eventsData } = useQuery({
    queryKey: ["interbank-status-events", payment.id],
    queryFn: async () => {
      const { data } = await invokeEngine("list_status_events", { payment_id: payment.id });
      return data;
    },
  });

  const { data: messagesData } = useQuery({
    queryKey: ["interbank-messages-for-payment", payment.id],
    queryFn: async () => {
      const { data } = await invokeEngine("list_messages", { payment_id: payment.id });
      return data;
    },
  });

  const events = eventsData?.events || [];
  const messages = messagesData?.messages || [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment Detail — {payment.id?.slice(0, 12)}...</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_COLORS[payment.status] || ""}>{payment.status}</Badge></div>
          <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">{Number(payment.amount).toLocaleString()} {payment.currency}</span></div>
          <div><span className="text-muted-foreground">Debtor:</span> {payment.debtor?.legal_name || payment.debtor_account_ref}</div>
          <div><span className="text-muted-foreground">Creditor:</span> {payment.creditor?.legal_name || payment.creditor_account_ref}</div>
          <div><span className="text-muted-foreground">Correlation ID:</span> <span className="font-mono text-xs">{payment.correlation_id}</span></div>
          <div><span className="text-muted-foreground">Trace ID:</span> <span className="font-mono text-xs">{payment.trace_id}</span></div>
        </div>

        <div className="mt-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><Clock className="h-4 w-4" /> Status Timeline</h3>
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No status events</p>
            ) : events.map((e: any, i: number) => (
              <div key={e.id} className="flex items-start gap-3 text-sm">
                <div className="mt-1">
                  {e.status_to === 'settled' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                   e.status_to === 'rejected' || e.status_to === 'failed' ? <XCircle className="h-4 w-4 text-destructive" /> :
                   <Activity className="h-4 w-4 text-primary" />}
                </div>
                <div className="flex-1">
                  <div><Badge variant="outline" className="text-xs">{e.status_from || '∅'}</Badge> → <Badge className={STATUS_COLORS[e.status_to] || ""}>{e.status_to}</Badge></div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(e.event_time).toLocaleString()} · source: {e.source}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> ISO Messages ({messages.length})</h3>
          {messages.map((m: any) => (
            <Collapsible key={m.id} className="mb-2">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm w-full p-2 rounded bg-muted/50 hover:bg-muted">
                <Badge variant="outline">{m.message_type}</Badge>
                <Badge variant={m.direction === 'outbound' ? 'default' : 'secondary'}>{m.direction}</Badge>
                <span className="font-mono text-xs flex-1 text-left">{m.message_id?.slice(0, 30)}</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-x-auto max-h-60">{m.payload_raw}</pre>
              </CollapsibleContent>
            </Collapsible>
          ))}
          {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages</p>}
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
    queryFn: async () => {
      const { data } = await invokeEngine("list_participants", {});
      return data;
    },
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
    mutationFn: async () => {
      const { data, error } = await invokeEngine("sandbox_seed_participants", {});
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Sandbox participants seeded");
      queryClient.invalidateQueries({ queryKey: ["interbank-participants"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => setShowCreate(true)}><Activity className="h-4 w-4 mr-1" />Add Participant</Button>
        <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
          <Database className="h-4 w-4 mr-1" />Seed Sandbox
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-4 grid grid-cols-2 gap-3">
            <Input placeholder="Participant Code (e.g. BANK-CM01)" value={newParticipant.participant_code} onChange={e => setNewParticipant(p => ({ ...p, participant_code: e.target.value }))} />
            <Input placeholder="Legal Name" value={newParticipant.legal_name} onChange={e => setNewParticipant(p => ({ ...p, legal_name: e.target.value }))} />
            <Input placeholder="Display Name" value={newParticipant.display_name} onChange={e => setNewParticipant(p => ({ ...p, display_name: e.target.value }))} />
            <Select value={newParticipant.type} onValueChange={v => setNewParticipant(p => ({ ...p, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="credit_union">Credit Union</SelectItem>
                <SelectItem value="switch_partner">Switch Partner</SelectItem>
              </SelectContent>
            </Select>
            <div className="col-span-2 flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Create</Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Legal Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Settlement Mode</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : (data?.participants || []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono font-semibold">{p.participant_code}</TableCell>
                  <TableCell>{p.legal_name}</TableCell>
                  <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                  <TableCell><Badge className={p.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-muted text-muted-foreground'}>{p.status}</Badge></TableCell>
                  <TableCell>{p.settlement_mode}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
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

  return (
    <div className="space-y-4">
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
              <TableRow>
                <TableHead>Message ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : (data?.messages || []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.message_id?.slice(0, 30)}</TableCell>
                  <TableCell><Badge variant="outline">{m.message_type}</Badge></TableCell>
                  <TableCell><Badge variant={m.direction === 'outbound' ? 'default' : 'secondary'}>{m.direction}</Badge></TableCell>
                  <TableCell><Badge className={m.status === 'processed' ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}>{m.status}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{m.payment_id?.slice(0, 8) || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
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
    queryFn: async () => {
      const { data } = await invokeEngine("list_connectors", {});
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-5 w-5" /> Bank Connectors</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Delivery Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : (data?.connectors || []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No connectors registered</TableCell></TableRow>
              ) : (data?.connectors || []).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-semibold">{c.participant?.participant_code || c.participant_id?.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant="outline">{c.env}</Badge></TableCell>
                  <TableCell>{c.delivery_mode}</TableCell>
                  <TableCell><Badge className={c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-destructive/10 text-destructive'}>{c.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.last_seen_at ? new Date(c.last_seen_at).toLocaleString() : 'Never'}</TableCell>
                  <TableCell>{c.error_count > 0 ? <Badge variant="destructive">{c.error_count}</Badge> : '0'}</TableCell>
                </TableRow>
              ))}
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
    onSuccess: () => {
      toast.success("Event re-queued");
      queryClient.invalidateQueries({ queryKey: ["interbank-outbox"] });
    },
  });

  return (
    <div className="space-y-4">
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
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Next Retry</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : (data?.events || []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.id?.slice(0, 8)}</TableCell>
                  <TableCell>{e.event_type}</TableCell>
                  <TableCell>
                    <Badge className={
                      e.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      e.status === 'dead_letter' ? 'bg-destructive/10 text-destructive' :
                      e.status === 'failed' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }>{e.status}</Badge>
                  </TableCell>
                  <TableCell>{e.retries}/{e.max_retries}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.next_retry_at ? new Date(e.next_retry_at).toLocaleString() : '—'}</TableCell>
                  <TableCell>
                    {['failed', 'dead_letter'].includes(e.status) && (
                      <Button size="sm" variant="outline" onClick={() => replayMutation.mutate(e.id)}>
                        <RefreshCw className="h-3 w-3 mr-1" />Replay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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
    queryFn: async () => {
      const { data } = await invokeEngine("list_reconciliation", {});
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" /> Reconciliation Items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Mismatches</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : (data?.items || []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No reconciliation items</TableCell></TableRow>
              ) : (data?.items || []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.participant?.participant_code || r.participant_id?.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">{new Date(r.period_start).toLocaleDateString()} — {new Date(r.period_end).toLocaleDateString()}</TableCell>
                  <TableCell>{Number(r.expected_total).toLocaleString()} XAF</TableCell>
                  <TableCell>{Number(r.actual_total).toLocaleString()} XAF</TableCell>
                  <TableCell>{r.mismatch_count > 0 ? <Badge variant="destructive">{r.mismatch_count}</Badge> : '0'}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
