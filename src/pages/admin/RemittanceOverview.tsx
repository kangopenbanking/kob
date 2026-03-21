import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  Globe,
  Building2,
  Clock,
  Search,
  Eye,
  RefreshCw,
  Banknote,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wallet,
  CreditCard,
  Receipt,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  created: { label: "Created", variant: "outline" },
  pending: { label: "Pending", variant: "secondary" },
  received: { label: "Received", variant: "default" },
  credited: { label: "Credited", variant: "default" },
  settled: { label: "Settled", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  reversed: { label: "Reversed", variant: "destructive" },
};

const DEST_ICONS: Record<string, React.ElementType> = {
  kob_wallet: Wallet,
  bank_account: Building2,
  merchant_invoice: CreditCard,
  bill_payment: Receipt,
};

export default function RemittanceOverview() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRemittance, setSelectedRemittance] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch remittances
  const { data: remittances, isLoading: loadingRemittances, refetch } = useQuery({
    queryKey: ["admin-remittances", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("remittances")
        .select("*, remittance_partners(name)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch partners
  const { data: partners } = useQuery({
    queryKey: ["remittance-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remittance_partners")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch events for selected remittance
  const { data: events } = useQuery({
    queryKey: ["remittance-events", selectedRemittance?.id],
    enabled: !!selectedRemittance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remittance_events")
        .select("*")
        .eq("remittance_id", selectedRemittance.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch ledger links for selected remittance
  const { data: ledgerLinks } = useQuery({
    queryKey: ["remittance-ledger", selectedRemittance?.id],
    enabled: !!selectedRemittance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remittance_ledger_links")
        .select("*")
        .eq("remittance_id", selectedRemittance.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Compute stats
  const stats = {
    total: remittances?.length || 0,
    totalVolume: remittances?.reduce((s, r) => s + Number(r.amount_out || 0), 0) || 0,
    totalFees: remittances?.reduce((s, r) => s + Number(r.fee_total || 0), 0) || 0,
    credited: remittances?.filter((r) => r.status === "credited").length || 0,
    pending: remittances?.filter((r) => ["created", "pending", "received"].includes(r.status)).length || 0,
    failed: remittances?.filter((r) => r.status === "failed").length || 0,
  };

  const filtered = remittances?.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.receiver_name?.toLowerCase().includes(q) ||
      r.sender_name?.toLowerCase().includes(q) ||
      r.partner_reference?.toLowerCase().includes(q) ||
      r.destination_ref?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Globe}
        title="Remittance Monitoring"
        description="Track inbound diaspora remittances, partner health, and routing status"
      >
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </AdminPageHeader>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Remittances", value: stats.total, icon: Globe, color: "text-primary" },
          { label: "Volume (XAF)", value: stats.totalVolume.toLocaleString(), icon: TrendingUp, color: "text-emerald-600" },
          { label: "Total Fees", value: stats.totalFees.toLocaleString(), icon: Banknote, color: "text-amber-600" },
          { label: "Credited", value: stats.credited, icon: CheckCircle2, color: "text-emerald-600" },
          { label: "In Transit", value: stats.pending, icon: Clock, color: "text-blue-600" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-destructive" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="remittances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="remittances">Remittance Feed</TabsTrigger>
          <TabsTrigger value="partners">Partner Health</TabsTrigger>
        </TabsList>

        {/* ── Remittance Feed ── */}
        <TabsContent value="remittances" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by sender, receiver, reference…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingRemittances ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (
            <Card>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner / Ref</TableHead>
                      <TableHead>Sender</TableHead>
                      <TableHead>Receiver</TableHead>
                      <TableHead>Amount In</TableHead>
                      <TableHead>Amount Out (XAF)</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {filtered?.map((r, i) => {
                        const DestIcon = DEST_ICONS[r.destination_type] || Globe;
                        const sc = STATUS_CONFIG[r.status] || { label: r.status, variant: "outline" as const };
                        return (
                          <motion.tr
                            key={r.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.02 }}
                            className="border-b hover:bg-muted/50"
                          >
                            <TableCell>
                              <div className="font-medium text-xs">
                                {(r as any).remittance_partners?.name || "—"}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                                {r.partner_reference || "—"}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{r.sender_name || "—"}</TableCell>
                            <TableCell className="text-sm">{r.receiver_name || "—"}</TableCell>
                            <TableCell className="text-sm font-medium">
                              {Number(r.amount_in || 0).toLocaleString()} {r.currency_in}
                            </TableCell>
                            <TableCell className="text-sm font-bold">
                              {Number(r.amount_out || 0).toLocaleString()} XAF
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-xs">
                                <DestIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                {r.destination_type?.replace("_", " ")}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={sc.variant}>{sc.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setSelectedRemittance(r); setDetailOpen(true); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {filtered?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          No remittances found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        {/* ── Partner Health ── */}
        <TabsContent value="partners" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {partners?.map((p, i) => {
              const corridors = (p.supported_corridors as any[]) || [];
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {p.name}
                        </CardTitle>
                        <Badge variant={p.status === "active" ? "default" : "secondary"}>
                          {p.status}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {corridors.length} corridor{corridors.length !== 1 ? "s" : ""} configured
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Created</span>
                        <span>{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      {corridors.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {corridors.slice(0, 5).map((c: any, ci: number) => (
                            <Badge key={ci} variant="outline" className="text-[10px]">
                              {typeof c === "string" ? c : `${c.from || "?"} → ${c.to || "CM"}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
            {(!partners || partners.length === 0) && (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center text-muted-foreground">
                  No remittance partners configured yet
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Remittance Detail
            </DialogTitle>
          </DialogHeader>
          {selectedRemittance && (
            <Tabs defaultValue="details" className="flex-1 overflow-hidden">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="timeline">Event Timeline</TabsTrigger>
                <TabsTrigger value="ledger">Ledger Postings</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 pr-2 mt-3 h-[500px]">
                <TabsContent value="details" className="space-y-4 mt-0">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Partner Ref", selectedRemittance.partner_reference],
                      ["Status", selectedRemittance.status],
                      ["Sender", selectedRemittance.sender_name],
                      ["Sender Country", selectedRemittance.sender_country],
                      ["Receiver", selectedRemittance.receiver_name],
                      ["Receiver Phone", selectedRemittance.receiver_phone],
                      ["Amount In", `${Number(selectedRemittance.amount_in || 0).toLocaleString()} ${selectedRemittance.currency_in}`],
                      ["Amount Out", `${Number(selectedRemittance.amount_out || 0).toLocaleString()} ${selectedRemittance.currency_out}`],
                      ["FX Rate", selectedRemittance.fx_rate],
                      ["Fee Total", Number(selectedRemittance.fee_total || 0).toLocaleString()],
                      ["Destination", selectedRemittance.destination_type?.replace("_", " ")],
                      ["Dest Ref", selectedRemittance.destination_ref],
                      ["Purpose", selectedRemittance.purpose_code],
                      ["Correlation ID", selectedRemittance.correlation_id],
                    ].map(([label, val]) => (
                      <div key={label as string}>
                        <span className="text-muted-foreground text-xs">{label}</span>
                        <p className="font-medium truncate">{val || "—"}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="mt-0">
                  <div className="space-y-3">
                    {events?.map((e, i) => (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex gap-3 text-sm border-l-2 border-primary/30 pl-4 py-2"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{e.event_type}</Badge>
                            {e.signature_valid !== null && (
                              <Badge variant={e.signature_valid ? "default" : "destructive"} className="text-[10px]">
                                {e.signature_valid ? "sig valid" : "sig invalid"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(e.created_at).toLocaleString()}
                          </p>
                          {e.provider_event_id && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Provider: {e.provider_event_id}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {(!events || events.length === 0) && (
                      <p className="text-center text-muted-foreground py-8 text-sm">No events recorded</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="ledger" className="mt-0">
                  <div className="space-y-2">
                    {ledgerLinks?.map((l, i) => (
                      <motion.div
                        key={l.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card>
                          <CardContent className="p-3 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{l.posting_type}</Badge>
                              <span className="text-xs text-muted-foreground font-mono">
                                Journal: {l.journal_entry_id || "—"}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(l.created_at).toLocaleString()}
                            </span>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                    {(!ledgerLinks || ledgerLinks.length === 0) && (
                      <p className="text-center text-muted-foreground py-8 text-sm">No ledger postings</p>
                    )}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
