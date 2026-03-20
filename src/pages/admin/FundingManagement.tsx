import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, Search, Eye, XCircle, Download, Wallet, TrendingUp, Clock, AlertTriangle, CheckCircle2, Building2, Store, Globe } from "lucide-react";
import { format } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface FundingIntent {
  id: string;
  account_id: string;
  user_id: string;
  amount: number;
  currency: string;
  method: string;
  provider: string;
  status: string;
  reference: string;
  fee_amount: number;
  net_amount: number;
  provider_reference: string;
  created_at: string;
  expires_at: string;
  next_action: any;
  metadata: any;
  funding_scope: string;
  merchant_id: string | null;
  api_client_id: string | null;
  target_description: string | null;
}

interface FundingEvent {
  id: string;
  funding_intent_id: string;
  event_type: string;
  payload: any;
  created_at: string;
}

const statusColors: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  pending_provider: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  pending_customer_action: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  pending_verification: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  succeeded: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};

const methodLabels: Record<string, string> = {
  mobile_money: "Mobile Money",
  card: "Card",
  paypal: "PayPal",
  bank_transfer: "Bank Transfer",
};

const scopeLabels: Record<string, string> = {
  end_user: "End User",
  merchant: "Merchant",
  institution: "Institution",
  external_api: "External API",
};

const scopeIcons: Record<string, React.ReactNode> = {
  end_user: <Wallet className="h-3 w-3" />,
  merchant: <Store className="h-3 w-3" />,
  institution: <Building2 className="h-3 w-3" />,
  external_api: <Globe className="h-3 w-3" />,
};

const FundingManagement = () => {
  const [intents, setIntents] = useState<FundingIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [selectedIntent, setSelectedIntent] = useState<FundingIntent | null>(null);
  const [events, setEvents] = useState<FundingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [stats, setStats] = useState({ total: 0, succeeded: 0, pending: 0, failed: 0, volume: 0 });

  const fetchIntents = async () => {
    setLoading(true);
    let query = supabase.from("funding_intents").select("*").order("created_at", { ascending: false }).limit(200);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (methodFilter !== "all") query = query.eq("method", methodFilter);
    if (scopeFilter !== "all") query = query.eq("funding_scope", scopeFilter);
    const { data, error } = await query;
    if (error) { toast.error("Failed to load funding intents"); console.error(error); }
    else {
      const filtered = searchTerm
        ? (data || []).filter((i: any) => i.reference?.includes(searchTerm) || i.id.includes(searchTerm) || i.provider_reference?.includes(searchTerm) || i.merchant_id?.includes(searchTerm) || i.api_client_id?.includes(searchTerm))
        : data || [];
      setIntents(filtered as FundingIntent[]);
      const all = (data || []) as FundingIntent[];
      setStats({
        total: all.length,
        succeeded: all.filter(i => i.status === "succeeded").length,
        pending: all.filter(i => ["created", "pending_provider", "pending_customer_action", "pending_verification"].includes(i.status)).length,
        failed: all.filter(i => ["failed", "cancelled", "expired"].includes(i.status)).length,
        volume: all.filter(i => i.status === "succeeded").reduce((s, i) => s + Number(i.amount), 0),
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchIntents(); }, [statusFilter, methodFilter, scopeFilter]);

  const openDetail = async (intent: FundingIntent) => {
    setSelectedIntent(intent);
    setEventsLoading(true);
    const { data } = await supabase.from("funding_events").select("*").eq("funding_intent_id", intent.id).order("created_at", { ascending: true });
    setEvents((data || []) as FundingEvent[]);
    setEventsLoading(false);
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from("funding_intents").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error("Cancel failed");
    else { toast.success("Intent cancelled"); fetchIntents(); setSelectedIntent(null); }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const { error } = await supabase.functions.invoke("gateway-reconcile-funding");
      if (error) throw error;
      toast.success("Reconciliation triggered");
      fetchIntents();
    } catch { toast.error("Reconciliation failed"); }
    setReconciling(false);
  };

  const exportCSV = () => {
    const headers = ["ID", "Reference", "Scope", "Amount", "Currency", "Method", "Provider", "Status", "Fee", "Net", "Merchant ID", "API Client", "Created"];
    const rows = intents.map(i => [i.id, i.reference, i.funding_scope, i.amount, i.currency, i.method, i.provider, i.status, i.fee_amount, i.net_amount, i.merchant_id || "", i.api_client_id || "", i.created_at]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `funding-intents-${Date.now()}.csv`; a.click();
  };

  const fmt = (n: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", minimumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Wallet} title="Funding Management" description="Monitor and manage funding intents across all consumer types" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Funding Management</h1>
          <p className="text-muted-foreground">Monitor and manage funding intents across all consumer types</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button variant="outline" size="sm" onClick={handleReconcile} disabled={reconciling}>
            <RefreshCw className={`h-4 w-4 mr-1 ${reconciling ? "animate-spin" : ""}`} />Reconcile
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3"><Wallet className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total Intents</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3"><CheckCircle2 className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold">{stats.succeeded}</p><p className="text-xs text-muted-foreground">Succeeded</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3"><Clock className="h-8 w-8 text-yellow-600" /><div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-xs text-muted-foreground">Pending</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold">{stats.failed}</p><p className="text-xs text-muted-foreground">Failed/Expired</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3"><TrendingUp className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{fmt(stats.volume)}</p><p className="text-xs text-muted-foreground">Total Volume</p></div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID, reference, merchant, or API client..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchIntents()} />
        </div>
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Scope" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scopes</SelectItem>
            <SelectItem value="end_user">End User</SelectItem>
            <SelectItem value="merchant">Merchant</SelectItem>
            <SelectItem value="institution">Institution</SelectItem>
            <SelectItem value="external_api">External API</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="pending_provider">Pending Provider</SelectItem>
            <SelectItem value="pending_customer_action">Pending Customer</SelectItem>
            <SelectItem value="pending_verification">Pending Verification</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="mobile_money">Mobile Money</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="paypal">PayPal</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchIntents}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : intents.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No funding intents found</TableCell></TableRow>
              ) : intents.map(intent => (
                <TableRow key={intent.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(intent)}>
                  <TableCell className="font-mono text-xs">{intent.reference || intent.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs gap-1">
                      {scopeIcons[intent.funding_scope || 'end_user']}
                      {scopeLabels[intent.funding_scope || 'end_user']}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{fmt(intent.amount)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{methodLabels[intent.method] || intent.method}</Badge></TableCell>
                  <TableCell className="capitalize text-sm">{intent.provider}</TableCell>
                  <TableCell><Badge className={`text-xs ${statusColors[intent.status] || ""}`}>{intent.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-sm">{fmt(intent.fee_amount || 0)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(intent.created_at), "dd MMM HH:mm")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openDetail(intent); }}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedIntent} onOpenChange={open => !open && setSelectedIntent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedIntent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Funding Intent
                  <Badge className={statusColors[selectedIntent.status]}>{selectedIntent.status.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline" className="gap-1">
                    {scopeIcons[selectedIntent.funding_scope || 'end_user']}
                    {scopeLabels[selectedIntent.funding_scope || 'end_user']}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="font-mono text-xs">{selectedIntent.id}</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details">
                <TabsList className="w-full">
                  <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                  <TabsTrigger value="events" className="flex-1">Events ({events.length})</TabsTrigger>
                  <TabsTrigger value="raw" className="flex-1">Raw Data</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Amount</span><p className="font-bold text-lg">{fmt(selectedIntent.amount)}</p></div>
                    <div><span className="text-muted-foreground">Net (after fees)</span><p className="font-bold text-lg">{fmt(selectedIntent.net_amount || 0)}</p></div>
                    <div><span className="text-muted-foreground">Funding Scope</span><p className="flex items-center gap-1">{scopeIcons[selectedIntent.funding_scope || 'end_user']} {scopeLabels[selectedIntent.funding_scope || 'end_user']}</p></div>
                    <div><span className="text-muted-foreground">Method</span><p>{methodLabels[selectedIntent.method]}</p></div>
                    <div><span className="text-muted-foreground">Provider</span><p className="capitalize">{selectedIntent.provider}</p></div>
                    <div><span className="text-muted-foreground">Fee</span><p>{fmt(selectedIntent.fee_amount || 0)}</p></div>
                    <div><span className="text-muted-foreground">Reference</span><p className="font-mono text-xs">{selectedIntent.reference}</p></div>
                    <div><span className="text-muted-foreground">Provider Ref</span><p className="font-mono text-xs">{selectedIntent.provider_reference || "—"}</p></div>
                    <div><span className="text-muted-foreground">Created</span><p>{format(new Date(selectedIntent.created_at), "PPpp")}</p></div>
                    <div><span className="text-muted-foreground">Expires</span><p>{selectedIntent.expires_at ? format(new Date(selectedIntent.expires_at), "PPpp") : "—"}</p></div>
                    {selectedIntent.account_id && <div><span className="text-muted-foreground">Account</span><p className="font-mono text-xs">{selectedIntent.account_id}</p></div>}
                    {selectedIntent.merchant_id && <div><span className="text-muted-foreground">Merchant ID</span><p className="font-mono text-xs">{selectedIntent.merchant_id}</p></div>}
                    {selectedIntent.api_client_id && <div><span className="text-muted-foreground">API Client</span><p className="font-mono text-xs">{selectedIntent.api_client_id}</p></div>}
                    {selectedIntent.target_description && <div className="col-span-2"><span className="text-muted-foreground">Description</span><p>{selectedIntent.target_description}</p></div>}
                  </div>

                  {selectedIntent.next_action && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Next Action</CardTitle></CardHeader>
                      <CardContent><pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{JSON.stringify(selectedIntent.next_action, null, 2)}</pre></CardContent>
                    </Card>
                  )}

                  {!["succeeded", "failed", "cancelled", "expired"].includes(selectedIntent.status) && (
                    <Button variant="destructive" size="sm" onClick={() => handleCancel(selectedIntent.id)}>
                      <XCircle className="h-4 w-4 mr-1" />Cancel Intent
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="events" className="mt-4">
                  {eventsLoading ? <p className="text-muted-foreground text-center py-4">Loading events...</p> : events.length === 0 ? <p className="text-muted-foreground text-center py-4">No events recorded</p> : (
                    <div className="space-y-3">
                      {events.map(ev => (
                        <div key={ev.id} className="flex items-start gap-3 border-l-2 border-primary/30 pl-4">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{ev.event_type.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(ev.created_at), "PPpp")}</p>
                            {ev.payload && <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(ev.payload, null, 2)}</pre>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="raw" className="mt-4">
                  <pre className="text-xs bg-muted p-4 rounded overflow-x-auto max-h-96">{JSON.stringify(selectedIntent, null, 2)}</pre>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FundingManagement;
