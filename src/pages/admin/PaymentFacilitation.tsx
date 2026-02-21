import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SettlementManagement } from "@/components/admin/SettlementManagement";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, CreditCard, RefreshCw, AlertTriangle, CheckCircle, XCircle, Smartphone, Landmark, TrendingUp } from "lucide-react";
import { format } from "date-fns";

const PaymentFacilitation = () => {
  const [methodFilter, setMethodFilter] = useState("all");

  // Live transaction feed - recent facilitated transactions
  const { data: mmTransactions, refetch: refetchMM } = useQuery({
    queryKey: ["admin-pf-mm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mobile_money_transactions")
        .select("id, amount, currency, status, provider, phone_number, transaction_type, created_at, is_kob_facilitated, kob_fee_amount, transaction_ref")
        .eq("is_kob_facilitated", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: btTransactions, refetch: refetchBT } = useQuery({
    queryKey: ["admin-pf-bt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transfer_transactions")
        .select("id, amount, currency, status, bank_name, transaction_type, created_at, is_kob_facilitated, kob_fee_amount, transaction_ref, error_message")
        .eq("is_kob_facilitated", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Failed payments
  const failedMM = mmTransactions?.filter((t) => t.status === "failed") || [];
  const failedBT = btTransactions?.filter((t) => t.status === "failed") || [];

  // Institutions with facilitation
  const { data: facilitatedInstitutions } = useQuery({
    queryKey: ["admin-pf-institutions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("institutions")
        .select("id, institution_name, status, use_kob_flutterwave, settlement_frequency, created_at")
        .eq("use_kob_flutterwave", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Payment method performance
  const mmCompleted = mmTransactions?.filter((t) => t.status === "completed").length || 0;
  const mmFailed = mmTransactions?.filter((t) => t.status === "failed").length || 0;
  const mmTotal = mmTransactions?.length || 0;
  const mmVolume = mmTransactions?.filter((t) => t.status === "completed").reduce((s, t) => s + (t.amount || 0), 0) || 0;

  const btCompleted = btTransactions?.filter((t) => t.status === "completed").length || 0;
  const btFailed = btTransactions?.filter((t) => t.status === "failed").length || 0;
  const btTotal = btTransactions?.length || 0;
  const btVolume = btTransactions?.filter((t) => t.status === "completed").reduce((s, t) => s + (t.amount || 0), 0) || 0;

  const totalFees = [
    ...(mmTransactions?.filter((t) => t.status === "completed") || []),
    ...(btTransactions?.filter((t) => t.status === "completed") || []),
  ].reduce((s, t) => s + (t.kob_fee_amount || 0), 0);

  const formatCurrency = (amount: number, currency: string = "XAF") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  const getStatusBadge = (status: string) => {
    if (status === "completed") return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
    if (status === "failed") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const allTransactions = [
    ...(mmTransactions?.map((t) => ({ ...t, method: "Mobile Money" as const })) || []),
    ...(btTransactions?.map((t) => ({ ...t, method: "Bank Transfer" as const })) || []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredTransactions = methodFilter === "all"
    ? allTransactions
    : allTransactions.filter((t) => t.method === methodFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Facilitation</h1>
          <p className="text-muted-foreground mt-2">
            Manage KOB payment facilitation and settlements for developers and fintechs
          </p>
        </div>
        <Button variant="outline" onClick={() => { refetchMM(); refetchBT(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4" />Total Transactions</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{mmTotal + btTotal}</div><p className="text-xs text-muted-foreground">{mmCompleted + btCompleted} completed</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4" />Total Volume</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(mmVolume + btVolume)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" />KOB Fees Earned</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(totalFees)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Failed Payments</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{failedMM.length + failedBT.length}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="live-feed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live-feed"><Activity className="h-4 w-4 mr-2" />Live Feed</TabsTrigger>
          <TabsTrigger value="failed"><AlertTriangle className="h-4 w-4 mr-2" />Failed ({failedMM.length + failedBT.length})</TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="h-4 w-4 mr-2" />Performance</TabsTrigger>
          <TabsTrigger value="institutions"><Landmark className="h-4 w-4 mr-2" />Institutions</TabsTrigger>
          <TabsTrigger value="settlements"><CreditCard className="h-4 w-4 mr-2" />Settlements</TabsTrigger>
        </TabsList>

        <TabsContent value="live-feed">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>Real-time Payment Feed</CardTitle><CardDescription>Live facilitated transactions across all channels</CardDescription></div>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.slice(0, 30).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs">{format(new Date(tx.created_at), "HH:mm:ss")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tx.method === "Mobile Money" ? <Smartphone className="h-3 w-3 mr-1" /> : <Landmark className="h-3 w-3 mr-1" />}
                          {tx.method}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{tx.transaction_type}</Badge></TableCell>
                      <TableCell className="font-semibold">{formatCurrency(tx.amount, tx.currency)}</TableCell>
                      <TableCell className="text-green-600">{formatCurrency(tx.kob_fee_amount || 0, tx.currency)}</TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{tx.transaction_ref?.substring(0, 12)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No facilitated transactions yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed">
          <Card>
            <CardHeader><CardTitle>Failed Payment Dashboard</CardTitle><CardDescription>Review and retry failed facilitated payments</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...failedMM.map((t) => ({ ...t, method: "Mobile Money" })), ...failedBT.map((t) => ({ ...t, method: "Bank Transfer" }))].map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs">{format(new Date(tx.created_at), "MMM dd, HH:mm")}</TableCell>
                      <TableCell><Badge variant="outline">{tx.method}</Badge></TableCell>
                      <TableCell className="font-semibold">{formatCurrency(tx.amount, tx.currency)}</TableCell>
                      <TableCell className="text-destructive text-xs max-w-[250px] truncate">{tx.error_message || "Unknown error"}</TableCell>
                      <TableCell className="font-mono text-xs">{tx.transaction_ref?.substring(0, 12)}</TableCell>
                    </TableRow>
                  ))}
                  {failedMM.length + failedBT.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No failed payments</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />Mobile Money</CardTitle>
                <CardDescription>Performance metrics for mobile money payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Success Rate</p><p className="text-2xl font-bold">{mmTotal > 0 ? ((mmCompleted / mmTotal) * 100).toFixed(1) : 0}%</p></div>
                  <div><p className="text-xs text-muted-foreground">Failure Rate</p><p className="text-2xl font-bold text-destructive">{mmTotal > 0 ? ((mmFailed / mmTotal) * 100).toFixed(1) : 0}%</p></div>
                  <div><p className="text-xs text-muted-foreground">Volume</p><p className="text-lg font-semibold">{formatCurrency(mmVolume)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Transactions</p><p className="text-lg font-semibold">{mmTotal}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />Bank Transfer</CardTitle>
                <CardDescription>Performance metrics for bank transfer payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Success Rate</p><p className="text-2xl font-bold">{btTotal > 0 ? ((btCompleted / btTotal) * 100).toFixed(1) : 0}%</p></div>
                  <div><p className="text-xs text-muted-foreground">Failure Rate</p><p className="text-2xl font-bold text-destructive">{btTotal > 0 ? ((btFailed / btTotal) * 100).toFixed(1) : 0}%</p></div>
                  <div><p className="text-xs text-muted-foreground">Volume</p><p className="text-lg font-semibold">{formatCurrency(btVolume)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Transactions</p><p className="text-lg font-semibold">{btTotal}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="institutions">
          <Card>
            <CardHeader><CardTitle>Institution Facilitation Status</CardTitle><CardDescription>Institutions using KOB payment facilitation</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institution</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Settlement Frequency</TableHead>
                    <TableHead>Onboarded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facilitatedInstitutions?.map((inst: any) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.institution_name}</TableCell>
                      <TableCell><Badge variant={inst.status === "approved" ? "default" : "secondary"}>{inst.status}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{inst.settlement_frequency || "daily"}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{format(new Date(inst.created_at), "MMM dd, yyyy")}</TableCell>
                    </TableRow>
                  ))}
                  {!facilitatedInstitutions?.length && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No facilitated institutions</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settlements">
          <SettlementManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentFacilitation;
