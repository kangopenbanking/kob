import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Banknote, Clock, CheckCircle, XCircle, RefreshCw, RotateCcw,
  AlertTriangle, Search, Download, Eye, Ban, ArrowUpRight,
  ArrowDownRight, TrendingUp, Layers, Zap, Activity
} from "lucide-react";
import { format } from "date-fns";
import { PayoutDetailDrawer } from "@/components/admin/PayoutDetailDrawer";
import { AdminAutoWithdrawalRules } from "@/components/admin/AdminAutoWithdrawalRules";
import { AdminBatchPayouts } from "@/components/admin/AdminBatchPayouts";

type PayoutTab = "all" | "consumer" | "merchant";
type TopTab = "payouts" | "auto-rules" | "batches";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" as const },
};

export default function PayoutManagement() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<PayoutTab>("all");
  const [topTab, setTopTab] = useState<TopTab>("payouts");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["admin-gateway-payouts", statusFilter, activeTab],
    queryFn: async () => {
      let query = (supabase as any)
        .from("gateway_payouts")
        .select("*, gateway_merchants(business_name, user_id)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (activeTab === "consumer") query = query.is("merchant_id", null);
      else if (activeTab === "merchant") query = query.not("merchant_id", "is", null);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const retryPayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const { data, error } = await supabase.functions.invoke("gateway-retry-payout", { body: { payout_id: payoutId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.detail || data.message || data.error);
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-gateway-payouts"] }); toast.success("Payout retry initiated"); setDrawerOpen(false); },
    onError: (e: any) => toast.error(e.message || "Retry failed"),
  });

  const reversePayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const { data, error } = await supabase.functions.invoke("gateway-admin-reverse-withdrawal", { body: { payout_id: payoutId, reason: "Admin manual reversal" } });
      if (error) {
        // Parse RFC 7807 error body from edge function
        let detail = "Reversal failed";
        try {
          const body = typeof (error as any)?.context?.body === 'string' ? JSON.parse((error as any).context.body) : (error as any)?.context?.body;
          if (body?.detail) detail = body.detail;
          else if (body?.message) detail = body.message;
        } catch {}
        throw new Error(detail);
      }
      if (data?.error || data?.type) throw new Error(data.detail || data.message || data.error || "Reversal failed");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-gateway-payouts"] });
      const restored = data?.total_restored ? ` (${new Intl.NumberFormat('en-US').format(data.total_restored)} ${data?.currency || 'XAF'} restored)` : '';
      toast.success(`Payout reversed — balance restored${restored}`);
      setDrawerOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Reversal failed"),
  });

  const cancelPayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const { data, error } = await supabase.functions.invoke("gateway-cancel-payout", { body: { payout_id: payoutId } });
      if (error) throw error;
      if (data?.error || data?.type) throw new Error(data.detail || data.message || data.error || "Cancel failed");
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-gateway-payouts"] }); toast.success("Payout cancelled"); setDrawerOpen(false); },
    onError: (e: any) => toast.error(e.message || "Cancel failed"),
  });

  const filteredPayouts = (payouts || []).filter((p: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.tx_ref?.toLowerCase().includes(q) ||
      p.beneficiary_name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.gateway_merchants?.business_name?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: payouts?.length || 0,
    pending: payouts?.filter((p: any) => p.status === "pending" || p.status === "processing").length || 0,
    completed: payouts?.filter((p: any) => p.status === "completed").length || 0,
    failed: payouts?.filter((p: any) => p.status === "failed").length || 0,
    reversed: payouts?.filter((p: any) => p.status === "reversed").length || 0,
    totalAmount: payouts?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0,
  };

  const formatCurrency = (amount: number, currency: string = "XAF") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  const handleExport = () => {
    if (!filteredPayouts.length) { toast.error("No payouts to export"); return; }
    const headers = ["Date", "Type", "Amount", "Fee", "Currency", "Channel", "Provider", "Status", "Beneficiary", "Reference"];
    const rows = filteredPayouts.map((p: any) => [
      format(new Date(p.created_at), "yyyy-MM-dd HH:mm"),
      p.merchant_id ? "Merchant" : "Consumer",
      p.amount, p.fee_amount || 0, p.currency, p.channel, p.provider, p.status,
      p.beneficiary_name || "", p.tx_ref || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported payouts CSV");
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; icon: any; label: string }> = {
      pending: { cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800", icon: Clock, label: "Pending" },
      processing: { cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800", icon: RefreshCw, label: "Processing" },
      completed: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800", icon: CheckCircle, label: "Completed" },
      failed: { cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800", icon: XCircle, label: "Failed" },
      cancelled: { cls: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/40 dark:text-gray-400 dark:border-gray-700", icon: Ban, label: "Cancelled" },
      reversed: { cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800", icon: RotateCcw, label: "Reversed" },
    };
    const cfg = map[status] || map.pending;
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
        <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
        {cfg.label}
      </span>
    );
  };

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      flutterwave: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400",
      stripe: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400",
      paypal: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400",
      kob_internal: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400",
    };
    return (
      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${colors[provider] || "bg-muted text-muted-foreground border-border"}`}>
        {provider?.replace("_", " ")}
      </span>
    );
  };

  const openDetail = (payout: any) => { setSelectedPayout(payout); setDrawerOpen(true); };

  const statCards = [
    { label: "Total Payouts", value: stats.total, icon: Layers, color: "bg-primary/10 text-primary" },
    { label: "In-Flight", value: stats.pending, icon: Activity, color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
    { label: "Completed", value: stats.completed, icon: CheckCircle, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
    { label: "Failed", value: stats.failed, icon: XCircle, color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
    { label: "Reversed", value: stats.reversed, icon: RotateCcw, color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
    { label: "Total Volume", value: formatCurrency(stats.totalAmount), icon: TrendingUp, color: "bg-primary/10 text-primary", isCurrency: true },
  ];

  const topTabConfig = [
    { value: "payouts", label: "Payouts", icon: Banknote },
    { value: "auto-rules", label: "Auto-Withdrawal Rules", icon: Zap },
    { value: "batches", label: "Batch Payouts", icon: Layers },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div {...fadeUp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-foreground/10 p-6 md:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDgpIiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Banknote className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary-foreground tracking-tight">Payout Management</h1>
              <p className="text-sm text-primary-foreground/70">Monitor, manage and audit all consumer & merchant withdrawals</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}>
              <Card className="border-border/40 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{stat.label}</p>
                      <p className={`font-bold tabular-nums ${stat.isCurrency ? "text-lg" : "text-2xl"} text-foreground`}>{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Top-level Tabs */}
      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)}>
        <TabsList className="bg-muted/60 h-11 p-1 rounded-xl gap-1">
          {topTabConfig.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="rounded-lg data-[state=active]:shadow-sm gap-1.5 text-xs font-semibold px-4">
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ─── Payouts Tab ─── */}
        <TabsContent value="payouts" className="mt-4">
          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Gateway Payouts</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Real-time consumer withdrawal and merchant disbursement ledger</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Search ref, beneficiary…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-9 w-[180px] text-xs rounded-lg" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="reversed">Reversed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleExport} className="h-9 text-xs rounded-lg gap-1.5">
                    <Download className="h-3.5 w-3.5" />Export
                  </Button>
                </div>
              </div>
            </CardHeader>

            <Separator />

            <CardContent className="pt-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PayoutTab)}>
                <TabsList className="bg-muted/40 h-9 p-0.5 rounded-lg mb-4">
                  <TabsTrigger value="all" className="text-xs rounded-md h-8 px-4">All</TabsTrigger>
                  <TabsTrigger value="consumer" className="text-xs rounded-md h-8 px-4 gap-1">
                    <ArrowUpRight className="h-3 w-3" />Consumer
                  </TabsTrigger>
                  <TabsTrigger value="merchant" className="text-xs rounded-md h-8 px-4 gap-1">
                    <ArrowDownRight className="h-3 w-3" />Merchant
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab}>
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
                      ))}
                    </div>
                  ) : filteredPayouts.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                        <Banknote className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">No payouts found</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Adjust your filters or wait for new transactions</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/30">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Source</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fee</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Channel</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Provider</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Beneficiary</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ref</TableHead>
                            <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPayouts.map((payout: any, index: number) => {
                            const isConsumer = !payout.merchant_id;
                            const isHighValue = payout.amount >= (isConsumer ? 1000000 : 5000000);
                            const isTerminal = ["completed", "cancelled", "reversed"].includes(payout.status);
                            return (
                              <motion.tr
                                key={payout.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.02, duration: 0.2 }}
                                className={`border-b border-border/20 cursor-pointer transition-colors hover:bg-muted/30 ${isHighValue ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}
                                onClick={() => openDetail(payout)}
                              >
                                <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap py-3">
                                  {format(new Date(payout.created_at), "MMM dd, HH:mm")}
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-1.5">
                                    {isConsumer ? (
                                      <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                                        <ArrowUpRight className="h-2.5 w-2.5" />Consumer
                                      </span>
                                    ) : (
                                      <span className="text-xs font-medium text-foreground truncate max-w-[100px]">{payout.gateway_merchants?.business_name || "Merchant"}</span>
                                    )}
                                    {isHighValue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold text-sm tabular-nums py-3">{formatCurrency(payout.amount, payout.currency)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground tabular-nums py-3">
                                  {payout.fee_amount ? formatCurrency(payout.fee_amount, payout.currency) : "—"}
                                </TableCell>
                                <TableCell className="py-3">
                                  <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-foreground">{payout.channel}</span>
                                </TableCell>
                                <TableCell className="py-3">{getProviderBadge(payout.provider)}</TableCell>
                                <TableCell className="py-3">{getStatusBadge(payout.status)}</TableCell>
                                <TableCell className="text-xs max-w-[100px] truncate text-muted-foreground py-3" title={payout.beneficiary_name}>{payout.beneficiary_name || "—"}</TableCell>
                                <TableCell className="font-mono text-[10px] max-w-[80px] truncate text-muted-foreground py-3" title={payout.tx_ref}>{payout.tx_ref || "—"}</TableCell>
                                <TableCell className="py-3">
                                  <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                    <Button size="sm" variant="ghost" onClick={() => openDetail(payout)} className="h-7 w-7 p-0 rounded-lg" title="View details">
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    {payout.status === "failed" && (
                                      <Button size="sm" variant="outline" onClick={() => retryPayout.mutate(payout.id)} disabled={retryPayout.isPending} className="h-7 px-2 text-[10px] rounded-lg gap-1">
                                        <RefreshCw className="h-3 w-3" />Retry
                                      </Button>
                                    )}
                                    {payout.status === "pending" && (
                                      <Button size="sm" variant="secondary" onClick={() => cancelPayout.mutate(payout.id)} disabled={cancelPayout.isPending} className="h-7 px-2 text-[10px] rounded-lg gap-1">
                                        <Ban className="h-3 w-3" />Cancel
                                      </Button>
                                    )}
                                    {!isTerminal && payout.status !== "failed" && (
                                      <Button size="sm" variant="destructive" onClick={() => reversePayout.mutate(payout.id)} disabled={reversePayout.isPending} className="h-7 px-2 text-[10px] rounded-lg gap-1">
                                        <RotateCcw className="h-3 w-3" />Reverse
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </motion.tr>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Auto-Withdrawal Rules Tab ─── */}
        <TabsContent value="auto-rules" className="mt-4">
          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <CardTitle className="text-lg">Auto-Withdrawal Rules</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage automated payout schedules across all users and merchants</p>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <AdminAutoWithdrawalRules />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Batch Payouts Tab ─── */}
        <TabsContent value="batches" className="mt-4">
          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <CardTitle className="text-lg">Batch Payouts</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Bulk disbursement batches created via the API</p>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <AdminBatchPayouts />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Drawer */}
      <PayoutDetailDrawer
        payout={selectedPayout}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onRetry={(id) => retryPayout.mutate(id)}
        onReverse={(id) => reversePayout.mutate(id)}
        onCancel={(id) => cancelPayout.mutate(id)}
        retryPending={retryPayout.isPending}
        reversePending={reversePayout.isPending}
        cancelPending={cancelPayout.isPending}
      />
    </div>
  );
}
