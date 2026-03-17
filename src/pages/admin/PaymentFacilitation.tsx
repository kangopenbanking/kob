import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SettlementManagement } from "@/components/admin/SettlementManagement";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import {
  Activity, CreditCard, RefreshCw, AlertTriangle, CheckCircle, XCircle, Smartphone,
  Landmark, TrendingUp, Search, Copy, ExternalLink, Store, BookOpen, Code2,
  ChevronRight, Zap, Shield, ArrowRight, Clock, DollarSign, Users,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ─── Types ───
type UnifiedTx = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  transaction_type: string;
  created_at: string;
  kob_fee_amount: number | null;
  transaction_ref: string;
  error_message?: string | null;
  method: "Mobile Money" | "Bank Transfer";
  phone_number?: string;
  provider?: string;
  bank_name?: string;
  account_number?: string;
  is_kob_facilitated?: boolean;
};

// ─── Stat Card Skeleton ───
const StatSkeleton = () => (
  <Card>
    <CardHeader className="pb-2">
      <Skeleton className="h-4 w-28" />
    </CardHeader>
    <CardContent className="space-y-2">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-36" />
    </CardContent>
  </Card>
);

// ─── Table Skeleton ───
const TableSkeleton = ({ cols = 7, rows = 6 }: { cols?: number; rows?: number }) => (
  <Table>
    <TableHeader>
      <TableRow>
        {Array.from({ length: cols }).map((_, i) => (
          <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

// ─── Status Badge ───
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { icon: typeof Clock; label: string; className: string }> = {
    completed: { icon: CheckCircle, label: "Completed", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    pending: { icon: Clock, label: "Pending", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    processing: { icon: Activity, label: "Processing", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    failed: { icon: XCircle, label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const c = config[status] || { icon: Clock, label: status, className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={`flex items-center gap-1 w-fit text-[10px] uppercase tracking-wider font-semibold border ${c.className}`}>
      <c.icon className="h-3 w-3" />{c.label}
    </Badge>
  );
};

// ─── Integration Guide Data ───
const GUIDE_STEPS = [
  { title: "1. Complete KYB Verification", desc: "Merchant must have approved KYB status before enabling facilitation.", icon: Shield, link: "/admin/business-kyc" },
  { title: "2. Configure Settlement Account", desc: "Set up bank account or mobile money wallet for receiving settlements.", icon: Landmark, link: "/admin/fee-management" },
  { title: "3. Generate API Credentials", desc: "Create API key and secret for the merchant's integration.", icon: Code2, link: "/admin/api-management" },
  { title: "4. Integrate Payment Endpoints", desc: "Use the REST API to initiate charges, verify status, and handle webhooks.", icon: Zap, link: "/developer/payment-facilitation" },
];

const CODE_SNIPPETS = {
  curl: `curl -X POST https://api.kangpay.com/v1/gateway/charges \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "currency": "XAF",
    "channel": "mobile_money",
    "phone_number": "+237670000000",
    "tx_ref": "txn_unique_ref",
    "narration": "Payment for order #123"
  }'`,
  javascript: `import { KangPay } from '@kangpay/sdk';

const kp = new KangPay({ apiKey: process.env.KANGPAY_KEY });

const charge = await kp.charges.create({
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  phone_number: '+237670000000',
  tx_ref: 'txn_unique_ref',
  narration: 'Payment for order #123',
});`,
};

const PaymentFacilitation = () => {
  const queryClient = useQueryClient();
  const [methodFilter, setMethodFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });
  const [selectedTx, setSelectedTx] = useState<UnifiedTx | null>(null);
  const [codeTab, setCodeTab] = useState<"curl" | "javascript">("curl");

  // ─── Data Queries ───
  const { data: mmTransactions, isLoading: mmLoading, refetch: refetchMM } = useQuery({
    queryKey: ["admin-pf-mm", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mobile_money_transactions")
        .select("id, amount, currency, status, provider, phone_number, transaction_type, created_at, is_kob_facilitated, kob_fee_amount, transaction_ref, error_message")
        .eq("is_kob_facilitated", true)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  const { data: btTransactions, isLoading: btLoading, refetch: refetchBT } = useQuery({
    queryKey: ["admin-pf-bt", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transfer_transactions")
        .select("id, amount, currency, status, bank_name, account_number, transaction_type, created_at, is_kob_facilitated, kob_fee_amount, transaction_ref, error_message")
        .eq("is_kob_facilitated", true)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

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

  const { data: merchants } = useQuery({
    queryKey: ["admin-pf-merchants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gateway_merchants")
        .select("id, business_name, status, kyb_status, created_at")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = mmLoading || btLoading;

  // ─── Computed ───
  const allTransactions = useMemo<UnifiedTx[]>(() => {
    const mm = (mmTransactions || []).map((t: any) => ({ ...t, method: "Mobile Money" as const }));
    const bt = (btTransactions || []).map((t: any) => ({ ...t, method: "Bank Transfer" as const }));
    return [...mm, ...bt].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [mmTransactions, btTransactions]);

  const filteredTransactions = useMemo(() => {
    let txs = allTransactions;
    if (methodFilter !== "all") txs = txs.filter((t) => t.method === methodFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      txs = txs.filter((t) =>
        t.transaction_ref?.toLowerCase().includes(q) ||
        t.phone_number?.toLowerCase().includes(q) ||
        t.account_number?.toLowerCase().includes(q) ||
        t.bank_name?.toLowerCase().includes(q)
      );
    }
    return txs;
  }, [allTransactions, methodFilter, search]);

  const mmCompleted = mmTransactions?.filter((t: any) => t.status === "completed").length || 0;
  const mmFailed = mmTransactions?.filter((t: any) => t.status === "failed").length || 0;
  const mmTotal = mmTransactions?.length || 0;
  const mmVolume = mmTransactions?.filter((t: any) => t.status === "completed").reduce((s: number, t: any) => s + (t.amount || 0), 0) || 0;

  const btCompleted = btTransactions?.filter((t: any) => t.status === "completed").length || 0;
  const btFailed = btTransactions?.filter((t: any) => t.status === "failed").length || 0;
  const btTotal = btTransactions?.length || 0;
  const btVolume = btTransactions?.filter((t: any) => t.status === "completed").reduce((s: number, t: any) => s + (t.amount || 0), 0) || 0;

  const totalFees = allTransactions.filter((t) => t.status === "completed").reduce((s, t) => s + (t.kob_fee_amount || 0), 0);
  const failedCount = mmFailed + btFailed;

  const formatCurrency = (amount: number, currency = "XAF") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // ─── Stat Cards ───
  const stats = [
    {
      label: "Total Transactions",
      value: mmTotal + btTotal,
      sub: `${mmCompleted + btCompleted} completed`,
      icon: Activity,
      iconBg: "bg-primary/10 text-primary",
    },
    {
      label: "Total Volume",
      value: formatCurrency(mmVolume + btVolume),
      sub: "Completed payments",
      icon: TrendingUp,
      iconBg: "bg-blue-500/10 text-blue-600",
    },
    {
      label: "KOB Fees Earned",
      value: formatCurrency(totalFees),
      sub: "Platform revenue",
      icon: DollarSign,
      iconBg: "bg-emerald-500/10 text-emerald-600",
    },
    {
      label: "Active Merchants",
      value: merchants?.length || 0,
      sub: `${facilitatedInstitutions?.length || 0} institutions`,
      icon: Users,
      iconBg: "bg-violet-500/10 text-violet-600",
    },
    {
      label: "Failed Payments",
      value: failedCount,
      sub: failedCount > 0 ? "Requires attention" : "All clear",
      icon: AlertTriangle,
      iconBg: failedCount > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      pulse: failedCount > 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Facilitation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage KOB payment facilitation, settlements, and merchant integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" size="sm" onClick={() => { refetchMM(); refetchBT(); }}>
            <RefreshCw className="h-4 w-4 mr-1.5" />Refresh
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)
          : stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="relative overflow-hidden">
                  {s.pulse && (
                    <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                    </span>
                  )}
                  <CardHeader className="flex flex-row items-center gap-3 pb-2">
                    <div className={`rounded-xl p-2.5 ${s.iconBg}`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{s.value}</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="live-feed" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="live-feed" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" />Live Feed</TabsTrigger>
          <TabsTrigger value="failed" className="gap-1.5 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />Failed
            {failedCount > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">{failedCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" />Performance</TabsTrigger>
          <TabsTrigger value="entities" className="gap-1.5 text-xs"><Store className="h-3.5 w-3.5" />Entities</TabsTrigger>
          <TabsTrigger value="settlements" className="gap-1.5 text-xs"><CreditCard className="h-3.5 w-3.5" />Settlements</TabsTrigger>
          <TabsTrigger value="guide" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" />Integration Guide</TabsTrigger>
        </TabsList>

        {/* ─── LIVE FEED ─── */}
        <TabsContent value="live-feed">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Real-time Payment Feed</CardTitle>
                  <CardDescription>Live facilitated transactions across all channels</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search ref, phone, account…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-9 text-sm w-full sm:w-[220px]"
                    />
                  </div>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton cols={7} rows={8} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Method</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Fee</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filteredTransactions.slice(0, 50).map((tx, i) => (
                        <motion.tr
                          key={tx.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                          onClick={() => setSelectedTx(tx)}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), "MMM dd, HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1 text-[10px] font-medium">
                              {tx.method === "Mobile Money" ? <Smartphone className="h-3 w-3" /> : <Landmark className="h-3 w-3" />}
                              {tx.method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">{tx.transaction_type}</Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-sm">{formatCurrency(tx.amount, tx.currency)}</TableCell>
                          <TableCell className="text-emerald-600 text-sm">{formatCurrency(tx.kob_fee_amount || 0, tx.currency)}</TableCell>
                          <TableCell><StatusBadge status={tx.status} /></TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{tx.transaction_ref?.substring(0, 16)}</TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {filteredTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">No facilitated transactions found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
              {filteredTransactions.length > 50 && (
                <p className="text-center text-xs text-muted-foreground mt-3">Showing 50 of {filteredTransactions.length} transactions</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── FAILED ─── */}
        <TabsContent value="failed">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Failed Payment Dashboard</CardTitle>
              <CardDescription>Review failed facilitated payments and identify patterns</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton cols={6} rows={5} />
              ) : (
                <>
                  {/* Error summary */}
                  {failedCount > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {["timeout", "insufficient_funds", "provider_error", "unknown"].map((cat) => {
                        const items = allTransactions.filter((t) => {
                          if (t.status !== "failed") return false;
                          const msg = (t.error_message || "").toLowerCase();
                          if (cat === "timeout") return msg.includes("timeout") || msg.includes("timed");
                          if (cat === "insufficient_funds") return msg.includes("insufficient") || msg.includes("balance");
                          if (cat === "provider_error") return msg.includes("provider") || msg.includes("gateway");
                          return !msg.includes("timeout") && !msg.includes("insufficient") && !msg.includes("provider");
                        });
                        if (items.length === 0) return null;
                        return (
                          <Badge key={cat} variant="outline" className="text-[10px] gap-1 border-destructive/20 text-destructive">
                            {cat.replace("_", " ")} ({items.length})
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Method</TableHead>
                        <TableHead className="text-xs">Amount</TableHead>
                        <TableHead className="text-xs">Error</TableHead>
                        <TableHead className="text-xs">Reference</TableHead>
                        <TableHead className="text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {allTransactions.filter((t) => t.status === "failed").map((tx, i) => (
                          <motion.tr
                            key={tx.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b hover:bg-muted/50 cursor-pointer"
                            onClick={() => setSelectedTx(tx)}
                          >
                            <TableCell className="font-mono text-xs">{format(new Date(tx.created_at), "MMM dd, HH:mm")}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] gap-1">
                                {tx.method === "Mobile Money" ? <Smartphone className="h-3 w-3" /> : <Landmark className="h-3 w-3" />}
                                {tx.method}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{formatCurrency(tx.amount, tx.currency)}</TableCell>
                            <TableCell className="text-destructive text-xs max-w-[200px] truncate">{tx.error_message || "Unknown error"}</TableCell>
                            <TableCell className="font-mono text-[11px]">{tx.transaction_ref?.substring(0, 16)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  supabase.functions.invoke("mobile-money-verify", { body: { transaction_ref: tx.transaction_ref } })
                                    .then(() => { toast.success("Re-verification triggered"); refetchMM(); refetchBT(); })
                                    .catch(() => toast.error("Retry failed"));
                                }}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />Retry
                              </Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                      {failedCount === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12">
                            <CheckCircle className="h-8 w-8 mx-auto text-emerald-500/40 mb-2" />
                            <p className="text-sm text-muted-foreground">No failed payments — all clear!</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── PERFORMANCE ─── */}
        <TabsContent value="performance">
          <div className="grid gap-6 md:grid-cols-2">
            {[
              { label: "Mobile Money", icon: Smartphone, completed: mmCompleted, failed: mmFailed, total: mmTotal, volume: mmVolume, color: "primary" },
              { label: "Bank Transfer", icon: Landmark, completed: btCompleted, failed: btFailed, total: btTotal, volume: btVolume, color: "blue" },
            ].map((ch) => {
              const rate = ch.total > 0 ? (ch.completed / ch.total) * 100 : 0;
              const feeRev = allTransactions
                .filter((t) => t.status === "completed" && t.method === ch.label)
                .reduce((s, t) => s + (t.kob_fee_amount || 0), 0);
              return (
                <motion.div key={ch.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`rounded-xl p-2.5 ${ch.color === "primary" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-600"}`}>
                          <ch.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{ch.label}</CardTitle>
                          <CardDescription>Performance metrics</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {/* Success rate bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">Success Rate</span>
                          <span className="font-semibold">{rate.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
                        </div>
                      </div>
                      {/* Stats grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-muted/50 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Volume</p>
                          <p className="text-lg font-bold mt-0.5">{formatCurrency(ch.volume)}</p>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Fee Revenue</p>
                          <p className="text-lg font-bold text-emerald-600 mt-0.5">{formatCurrency(feeRev)}</p>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Completed</p>
                          <p className="text-lg font-bold mt-0.5">{ch.completed}</p>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Failed</p>
                          <p className="text-lg font-bold text-destructive mt-0.5">{ch.failed}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── ENTITIES (Institutions + Merchants) ─── */}
        <TabsContent value="entities">
          <div className="space-y-6">
            {/* Institutions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="rounded-xl p-2 bg-primary/10 text-primary"><Landmark className="h-4 w-4" /></div>
                  <div>
                    <CardTitle className="text-lg">Facilitated Institutions</CardTitle>
                    <CardDescription>Institutions using KOB payment infrastructure</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Institution</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Settlement Frequency</TableHead>
                      <TableHead className="text-xs">Onboarded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {facilitatedInstitutions?.map((inst: any, i: number) => (
                        <motion.tr key={inst.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b hover:bg-muted/50">
                          <TableCell className="font-medium">{inst.institution_name}</TableCell>
                          <TableCell>
                            <Badge variant={inst.status === "approved" ? "default" : "secondary"} className="text-[10px]">{inst.status}</Badge>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{inst.settlement_frequency || "daily"}</Badge></TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{format(new Date(inst.created_at), "MMM dd, yyyy")}</TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {!facilitatedInstitutions?.length && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No facilitated institutions</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Merchants */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="rounded-xl p-2 bg-violet-500/10 text-violet-600"><Store className="h-4 w-4" /></div>
                  <div>
                    <CardTitle className="text-lg">Active Gateway Merchants</CardTitle>
                    <CardDescription>Merchants integrated via KOB Gateway API</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Business Name</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">KYB</TableHead>
                      <TableHead className="text-xs">Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {merchants?.map((m: any, i: number) => (
                        <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b hover:bg-muted/50">
                          <TableCell className="font-medium">{m.business_name}</TableCell>
                          <TableCell><Badge variant="default" className="text-[10px]">{m.status}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={m.kyb_status === "verified" ? "default" : "secondary"} className="text-[10px]">
                              {m.kyb_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{format(new Date(m.created_at), "MMM dd, yyyy")}</TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {!merchants?.length && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No active merchants</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── SETTLEMENTS ─── */}
        <TabsContent value="settlements">
          <SettlementManagement />
        </TabsContent>

        {/* ─── INTEGRATION GUIDE ─── */}
        <TabsContent value="guide">
          <div className="space-y-6">
            {/* Steps */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Merchant & Developer Onboarding</CardTitle>
                <CardDescription>Step-by-step guide for integrating payment facilitation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {GUIDE_STEPS.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="group relative rounded-xl border border-border/60 p-4 hover:border-primary/30 hover:bg-primary/[0.02] transition-all cursor-pointer"
                      onClick={() => window.open(step.link, "_blank")}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg p-2 bg-primary/10 text-primary shrink-0">
                          <step.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold">{step.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-1" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* API Endpoints */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Code2 className="h-5 w-5 text-primary" />API Reference</CardTitle>
                <CardDescription>Key endpoints for payment facilitation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  {[
                    { method: "POST", path: "/v1/gateway/charges", desc: "Initiate a mobile money or card charge" },
                    { method: "GET", path: "/v1/gateway/charges/:id", desc: "Verify charge status" },
                    { method: "POST", path: "/v1/gateway/payouts", desc: "Send a payout to bank or mobile money" },
                    { method: "POST", path: "/v1/gateway/refunds", desc: "Process a refund on a completed charge" },
                  ].map((ep) => (
                    <div key={ep.path} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
                      <Badge className={`text-[10px] font-mono shrink-0 ${ep.method === "POST" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"}`} variant="outline">
                        {ep.method}
                      </Badge>
                      <code className="text-xs font-mono text-foreground/80 flex-1">{ep.path}</code>
                      <span className="text-xs text-muted-foreground hidden sm:inline">{ep.desc}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Code Snippets */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-sm font-semibold">Quick Start Code</h4>
                    <div className="flex rounded-lg border overflow-hidden text-xs">
                      <button
                        onClick={() => setCodeTab("curl")}
                        className={`px-3 py-1 transition-colors ${codeTab === "curl" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        cURL
                      </button>
                      <button
                        onClick={() => setCodeTab("javascript")}
                        className={`px-3 py-1 transition-colors ${codeTab === "javascript" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      >
                        JavaScript
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <pre className="rounded-xl bg-muted/70 border border-border/50 p-4 text-xs font-mono overflow-x-auto max-h-[300px]">
                      <code>{CODE_SNIPPETS[codeTab]}</code>
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7 text-xs"
                      onClick={() => copyToClipboard(CODE_SNIPPETS[codeTab])}
                    >
                      <Copy className="h-3 w-3 mr-1" />Copy
                    </Button>
                  </div>
                </div>

                {/* Fee table */}
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-3">Fee Structure (Default)</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Channel</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Fee Model</TableHead>
                        <TableHead className="text-xs">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { ch: "Mobile Money", type: "Charge", model: "Percentage", rate: "1.5%" },
                        { ch: "Mobile Money", type: "Payout", model: "Flat", rate: "100 XAF" },
                        { ch: "Bank Transfer", type: "Payout", model: "Flat", rate: "500 XAF" },
                        { ch: "Card", type: "Charge", model: "Percentage", rate: "2.5%" },
                      ].map((f, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{f.ch}</TableCell>
                          <TableCell className="text-xs">{f.type}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{f.model}</Badge></TableCell>
                          <TableCell className="font-semibold text-xs">{f.rate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Transaction Detail Dialog ─── */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => { if (!open) setSelectedTx(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTx?.method === "Mobile Money" ? <Smartphone className="h-5 w-5 text-primary" /> : <Landmark className="h-5 w-5 text-primary" />}
              Transaction Detail
            </DialogTitle>
            <DialogDescription>Full transaction information and fee breakdown</DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              {/* Status + Ref */}
              <div className="flex items-center justify-between">
                <StatusBadge status={selectedTx.status} />
                <button
                  onClick={() => copyToClipboard(selectedTx.transaction_ref)}
                  className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="h-3 w-3" />{selectedTx.transaction_ref?.substring(0, 20)}…
                </button>
              </div>

              <Separator />

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Amount", value: formatCurrency(selectedTx.amount, selectedTx.currency) },
                  { label: "Currency", value: selectedTx.currency },
                  { label: "KOB Fee", value: formatCurrency(selectedTx.kob_fee_amount || 0, selectedTx.currency) },
                  { label: "Net Amount", value: formatCurrency(selectedTx.amount - (selectedTx.kob_fee_amount || 0), selectedTx.currency) },
                  { label: "Method", value: selectedTx.method },
                  { label: "Type", value: selectedTx.transaction_type },
                  ...(selectedTx.provider ? [{ label: "Provider", value: selectedTx.provider }] : []),
                  ...(selectedTx.phone_number ? [{ label: "Phone", value: selectedTx.phone_number }] : []),
                  ...(selectedTx.bank_name ? [{ label: "Bank", value: selectedTx.bank_name }] : []),
                  ...(selectedTx.account_number ? [{ label: "Account", value: selectedTx.account_number }] : []),
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{item.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</h4>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                    Created
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className={`h-2 w-2 rounded-full ${selectedTx.status === "completed" ? "bg-emerald-500" : selectedTx.status === "failed" ? "bg-destructive" : "bg-amber-500"}`} />
                    {selectedTx.status === "completed" ? "Completed" : selectedTx.status === "failed" ? "Failed" : "Processing"}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(selectedTx.created_at), "MMMM dd, yyyy 'at' HH:mm:ss")}</p>
              </div>

              {/* Error */}
              {selectedTx.status === "failed" && selectedTx.error_message && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Error Details</p>
                  <p className="text-xs text-destructive/80">{selectedTx.error_message}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentFacilitation;
