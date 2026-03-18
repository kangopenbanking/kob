import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Banknote, Clock, CheckCircle, XCircle, RefreshCw, ArrowUpRight, RotateCcw, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type PayoutTab = "all" | "consumer" | "merchant";

export default function PayoutManagement() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<PayoutTab>("all");

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
    },
    onError: (e: any) => toast.error(e.message || "Reversal failed"),
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

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      processing: { variant: "secondary", icon: RefreshCw },
      completed: { variant: "default", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle },
    };
    const cfg = map[status] || map.pending;
    const Icon = cfg.icon;
    return <Badge variant={cfg.variant}><Icon className="h-3 w-3 mr-1" />{status}</Badge>;
  };

  const getProviderBadge = (provider: string) => {
    const colors: Record<string, string> = {
      flutterwave: "bg-amber-100 text-amber-800",
      stripe: "bg-indigo-100 text-indigo-800",
      paypal: "bg-blue-100 text-blue-800",
      kob_internal: "bg-emerald-100 text-emerald-800",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[provider] || "bg-muted text-muted-foreground"}`}>
        {provider}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payout Management</h1>
        <p className="text-muted-foreground mt-2">Monitor and manage all consumer & merchant withdrawals</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Payouts</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">In-Flight</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Failed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{stats.failed}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Volume</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Gateway Payouts</CardTitle>
              <CardDescription>Consumer withdrawals and merchant payout disbursements</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
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
              ) : payouts?.length === 0 ? (
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
                      {payouts?.map((payout: any) => {
                        const isConsumer = !payout.merchant_id;
                        const isHighValue = payout.amount >= (isConsumer ? 1000000 : 5000000);
                        return (
                          <TableRow key={payout.id} className={isHighValue ? "bg-destructive/5" : ""}>
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
                              <div className="flex gap-1">
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
    </div>
  );
}
