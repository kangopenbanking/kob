import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Banknote, Clock, CheckCircle, XCircle, RefreshCw, RotateCcw, AlertTriangle, Search, Download, Eye, Ban } from "lucide-react";
import { format } from "date-fns";
import { PayoutDetailDrawer } from "@/components/admin/PayoutDetailDrawer";
import { AdminAutoWithdrawalRules } from "@/components/admin/AdminAutoWithdrawalRules";
import { AdminBatchPayouts } from "@/components/admin/AdminBatchPayouts";

type PayoutTab = "all" | "consumer" | "merchant";
type TopTab = "payouts" | "auto-rules" | "batches";

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

      if (activeTab === "consumer") {
        query = query.is("merchant_id", null);
      } else if (activeTab === "merchant") {
        query = query.not("merchant_id", "is", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const retryPayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const { data, error } = await supabase.functions.invoke("gateway-retry-payout", {
        body: { payout_id: payoutId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gateway-payouts"] });
      toast.success("Payout retry initiated");
      setDrawerOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Retry failed"),
  });

  const reversePayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const { data, error } = await supabase.functions.invoke("gateway-admin-reverse-withdrawal", {
        body: { payout_id: payoutId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gateway-payouts"] });
      toast.success("Payout reversed — balance restored");
      setDrawerOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Reversal failed"),
  });

  const cancelPayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const { data, error } = await supabase.functions.invoke("gateway-cancel-payout", {
        body: { payout_id: payoutId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gateway-payouts"] });
      toast.success("Payout cancelled");
      setDrawerOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Cancel failed"),
  });

  // Filter by search
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
      p.amount,
      p.fee_amount || 0,
      p.currency,
      p.channel,
      p.provider,
      p.status,
      p.beneficiary_name || "",
      p.tx_ref || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported payouts CSV");
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      processing: { variant: "secondary", icon: RefreshCw },
      completed: { variant: "default", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle },
      cancelled: { variant: "outline", icon: Ban },
    };
    const cfg = map[status] || map.pending;
    const Icon = cfg.icon;
    return <Badge variant={cfg.variant}><Icon className="h-3 w-3 mr-1" />{status}</Badge>;
  };

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      flutterwave: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      stripe: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
      paypal: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      kob_internal: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[provider] || "bg-muted text-muted-foreground"}`}>
        {provider}
      </span>
    );
  };

  const openDetail = (payout: any) => {
    setSelectedPayout(payout);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payout Management</h1>
        <p className="text-muted-foreground mt-2">Monitor and manage all consumer & merchant withdrawals</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Payouts</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">In-Flight</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Completed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-emerald-600">{stats.completed}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Failed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{stats.failed}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Volume</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div></CardContent></Card>
      </div>

      {/* Top-level tabs */}
      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as TopTab)}>
        <TabsList>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="auto-rules">Auto-Withdrawal Rules</TabsTrigger>
          <TabsTrigger value="batches">Batch Payouts</TabsTrigger>
        </TabsList>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Gateway Payouts</CardTitle>
                  <CardDescription>Consumer withdrawals and merchant payout disbursements</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search ref, beneficiary…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-[200px]"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-1" />Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PayoutTab)}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="consumer">Consumer</TabsTrigger>
                  <TabsTrigger value="merchant">Merchant</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab}>
                  {isLoading ? (
                    <p className="text-center py-8 text-muted-foreground">Loading payouts...</p>
                  ) : filteredPayouts.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No payouts found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Fee</TableHead>
                            <TableHead>Channel</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Beneficiary</TableHead>
                            <TableHead>Ref</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPayouts.map((payout: any) => {
                            const isConsumer = !payout.merchant_id;
                            const isHighValue = payout.amount >= (isConsumer ? 1000000 : 5000000);
                            return (
                              <TableRow
                                key={payout.id}
                                className={`cursor-pointer ${isHighValue ? "bg-destructive/5" : ""}`}
                                onClick={() => openDetail(payout)}
                              >
                                <TableCell className="font-mono text-xs whitespace-nowrap">
                                  {format(new Date(payout.created_at), "MMM dd, HH:mm")}
                                </TableCell>
                                <TableCell>
                                  {isConsumer ? (
                                    <Badge variant="outline" className="text-[10px]">Consumer</Badge>
                                  ) : (
                                    <span className="text-xs font-medium">{payout.gateway_merchants?.business_name || "Merchant"}</span>
                                  )}
                                  {isHighValue && <AlertTriangle className="h-3 w-3 text-destructive inline ml-1" />}
                                </TableCell>
                                <TableCell className="font-semibold">{formatCurrency(payout.amount, payout.currency)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {payout.fee_amount ? formatCurrency(payout.fee_amount, payout.currency) : "—"}
                                </TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px]">{payout.channel}</Badge></TableCell>
                                <TableCell>{getProviderBadge(payout.provider)}</TableCell>
                                <TableCell>{getStatusBadge(payout.status)}</TableCell>
                                <TableCell className="text-xs max-w-[120px] truncate" title={payout.beneficiary_name}>
                                  {payout.beneficiary_name || "—"}
                                </TableCell>
                                <TableCell className="font-mono text-[10px] max-w-[100px] truncate" title={payout.tx_ref}>
                                  {payout.tx_ref || "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openDetail(payout)}
                                      title="View details"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    {payout.status === "failed" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => retryPayout.mutate(payout.id)}
                                        disabled={retryPayout.isPending}
                                        title="Retry payout"
                                      >
                                        <RefreshCw className="h-3 w-3 mr-1" />Retry
                                      </Button>
                                    )}
                                    {payout.status === "pending" && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => cancelPayout.mutate(payout.id)}
                                        disabled={cancelPayout.isPending}
                                        title="Cancel payout"
                                      >
                                        <Ban className="h-3 w-3 mr-1" />Cancel
                                      </Button>
                                    )}
                                    {(payout.status === "processing" || payout.status === "pending") && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => reversePayout.mutate(payout.id)}
                                        disabled={reversePayout.isPending}
                                        title="Reverse and restore balance"
                                      >
                                        <RotateCcw className="h-3 w-3 mr-1" />Reverse
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
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

        {/* Auto-Withdrawal Rules Tab */}
        <TabsContent value="auto-rules">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Withdrawal Rules</CardTitle>
              <CardDescription>Manage automated payout schedules across all users and merchants</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminAutoWithdrawalRules />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Payouts Tab */}
        <TabsContent value="batches">
          <Card>
            <CardHeader>
              <CardTitle>Batch Payouts</CardTitle>
              <CardDescription>Bulk disbursement batches created via the API</CardDescription>
            </CardHeader>
            <CardContent>
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
