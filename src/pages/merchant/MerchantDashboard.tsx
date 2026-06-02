import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, DollarSign, ArrowUpDown, TrendingUp, AlertCircle, CheckCircle2,
  Key, Webhook, Building2, ShieldCheck, ArrowRight, Rocket, Wallet,
  Link2, CreditCard, BarChart3, ArrowUpRight, ArrowDownRight,
  Clock, Eye, EyeOff, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { Area, AreaChart, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { motion } from "framer-motion";

interface SetupStep {
  key: string;
  title: string;
  description: string;
  icon: any;
  completed: boolean;
  path: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function MerchantDashboard() {
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<any>(null);
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, txCount: 0, successRate: 0, failedCount: 0, pendingCount: 0 });
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [chartData, setChartData] = useState<{ day: string; revenue: number }[]>([]);
  const [disputeCount, setDisputeCount] = useState(0);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [showWalletBalances, setShowWalletBalances] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: m } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
      setMerchant(m);

      if (m) {
        const [chargesRes, successCountRes, totalCountRes, failedCountRes, pendingCountRes, apiKeysRes, webhooksRes, settlementRes, walletsRes, disputesRes] = await Promise.all([
          supabase.from("gateway_charges").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false }).limit(10),
          supabase.from("gateway_charges").select("amount", { count: "exact" }).eq("merchant_id", m.id).eq("status", "successful"),
          supabase.from("gateway_charges").select("id", { count: "exact", head: true }).eq("merchant_id", m.id),
          supabase.from("gateway_charges").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).eq("status", "failed"),
          supabase.from("gateway_charges").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).eq("status", "pending"),
          supabase.from("gateway_merchant_api_keys").select("id").eq("merchant_id", m.id).limit(1),
          supabase.from("gateway_merchant_webhooks").select("id").eq("merchant_id", m.id).limit(1),
          supabase.from("gateway_merchant_settlement_accounts").select("id").eq("merchant_id", m.id).limit(1),
          supabase.from("gateway_merchant_wallets").select("*").eq("merchant_id", m.id),
          supabase.from("gateway_disputes").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).in("status", ["open", "under_review"]),
        ]);

        setCharges(chargesRes.data || []);
        setWallets(walletsRes.data || []);
        setDisputeCount(disputesRes.count || 0);

        const successfulData = successCountRes.data || [];
        const totalRevenue = successfulData.reduce((s, c) => s + Number(c.amount), 0);
        const totalTx = totalCountRes.count || 0;
        const successCount = successCountRes.count || 0;
        const failedCount = failedCountRes.count || 0;
        const pendingCount = pendingCountRes.count || 0;
        
        setStats({
          totalRevenue,
          txCount: totalTx,
          successRate: totalTx > 0 ? Math.round((successCount / totalTx) * 100) : 0,
          failedCount,
          pendingCount,
        });

        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentSuccessful } = await supabase
          .from("gateway_charges")
          .select("amount, created_at")
          .eq("merchant_id", m.id)
          .eq("status", "successful")
          .gte("created_at", fourteenDaysAgo)
          .order("created_at", { ascending: true });
        
        const daily: Record<string, number> = {};
        (recentSuccessful || []).forEach(c => {
          const day = c.created_at?.split("T")[0] || "";
          daily[day] = (daily[day] || 0) + Number(c.amount);
        });
        setChartData(
          Object.entries(daily).sort().slice(-14).map(([day, revenue]) => ({
            day: format(new Date(day), "MMM d"),
            revenue,
          }))
        );

        setSetupSteps([
          { key: "kyb", title: "Complete KYB Verification", description: "Submit business documents to go live", icon: ShieldCheck, completed: ["verified", "approved"].includes(String(m.kyb_status || "").toLowerCase()) || ["active", "verified"].includes(String(m.status || "").toLowerCase()), path: "/merchant/kyb" },
          { key: "api_keys", title: "Generate API Keys", description: "Get sandbox keys to integrate", icon: Key, completed: (apiKeysRes.data?.length || 0) > 0, path: "/merchant/api-keys" },
          { key: "webhooks", title: "Configure Webhooks", description: "Real-time payment notifications", icon: Webhook, completed: (webhooksRes.data?.length || 0) > 0, path: "/merchant/webhooks" },
          { key: "settlement", title: "Add Settlement Account", description: "Bank or mobile money for payouts", icon: Building2, completed: (settlementRes.data?.length || 0) > 0, path: "/merchant/settlement-accounts" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!merchant) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 max-w-lg mx-auto text-center px-4">
        <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center">
          <Rocket className="h-10 w-10 text-primary" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome to the Merchant Portal</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Get started in minutes and begin accepting payments across Africa.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate("/merchant-register")} className="gap-2 rounded-2xl h-12 px-6 font-bold">
          Create Your Merchant Account <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const completedSteps = setupSteps.filter(s => s.completed).length;
  const setupProgress = setupSteps.length > 0 ? Math.round((completedSteps / setupSteps.length) * 100) : 0;
  const showSetup = setupProgress < 100;
  const currency = (merchant.metadata as any)?.default_currency || "XAF";

  const statusColor = (s: string) =>
    s === "successful" ? "bg-[hsl(150,40%,92%)] text-[hsl(150,40%,28%)] border-[hsl(150,40%,80%)]"
    : s === "failed" ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-[hsl(40,80%,92%)] text-[hsl(40,60%,28%)] border-[hsl(40,80%,75%)]";

  const quickActions = [
    { label: "Payment Link", icon: Link2, path: "/merchant/payment-links", color: "bg-[hsl(200,80%,94%)] text-[hsl(200,80%,35%)]" },
    { label: "Fund Wallet", icon: Wallet, path: "/merchant/fund-wallet", color: "bg-[hsl(260,60%,94%)] text-[hsl(260,60%,40%)]" },
    { label: "API Keys", icon: Key, path: "/merchant/api-keys", color: "bg-[hsl(40,80%,92%)] text-[hsl(40,70%,35%)]" },
    { label: "Transactions", icon: CreditCard, path: "/merchant/transactions", color: "bg-[hsl(150,50%,92%)] text-[hsl(150,50%,30%)]" },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-primary text-primary-foreground rounded-3xl p-6 sm:p-8"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{merchant.business_name}</h1>
            <p className="text-primary-foreground/70 text-sm mt-1">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {disputeCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/merchant/disputes")}
                className="gap-2 bg-white/10 border-white/20 text-primary-foreground hover:bg-white/20 rounded-xl"
              >
                <AlertCircle className="h-4 w-4" />
                {disputeCount} Dispute{disputeCount > 1 ? "s" : ""}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => navigate("/merchant/analytics")}
              className="gap-2 bg-white/15 text-primary-foreground hover:bg-white/25 border-0 rounded-xl"
            >
              <BarChart3 className="h-4 w-4" strokeWidth={2} /> Analytics
            </Button>
          </div>
        </div>

        {/* Inline Revenue Highlight */}
        <div className="mt-6 flex items-end gap-2">
          <span className="text-4xl sm:text-5xl font-bold tracking-tighter">
            {stats.totalRevenue.toLocaleString()}
          </span>
          <span className="text-primary-foreground/60 text-lg font-medium mb-1">{currency}</span>
        </div>
        <p className="text-primary-foreground/60 text-xs mt-1 uppercase tracking-widest font-bold">Total Revenue</p>
      </motion.div>

      {/* KYB Banner */}
      {merchant.kyb_status !== "verified" && merchant.status !== "active" && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-[hsl(40,80%,75%)] bg-[hsl(40,80%,96%)] dark:bg-[hsl(40,30%,10%)] overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-[hsl(40,80%,88%)] flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-[hsl(40,70%,35%)]" strokeWidth={2} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">KYB Verification</span>
                    <Badge variant="secondary" className="text-[10px] font-bold">{merchant.kyb_status?.replace(/_/g, " ").toUpperCase()}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Complete your KYB to accept live payments.</p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate("/merchant/kyb")} className="rounded-xl font-bold">Complete KYB</Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Setup Checklist */}
      {showSetup && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Getting Started</CardTitle>
                  <CardDescription className="mt-0.5">{completedSteps} of {setupSteps.length} steps completed</CardDescription>
                </div>
                <span className="text-sm font-bold text-primary">{setupProgress}%</span>
              </div>
              <Progress value={setupProgress} className="mt-3 h-2" />
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {setupSteps.map((s, i) => (
                <motion.div
                  key={s.key}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border border-border/60 cursor-pointer transition-all hover:shadow-sm hover:bg-muted/40 ${s.completed ? "opacity-50" : ""}`}
                  onClick={() => navigate(s.path)}
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${s.completed ? "bg-primary/10" : "bg-muted"}`}>
                    {s.completed
                      ? <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={2} />
                      : <s.icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${s.completed ? "line-through" : ""}`}>{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                  </div>
                  {!s.completed && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Transactions",
            value: stats.txCount.toLocaleString(),
            icon: ArrowUpDown,
            iconBg: "bg-[hsl(200,80%,94%)] text-[hsl(200,80%,35%)]",
          },
          {
            title: "Success Rate",
            value: `${stats.successRate}%`,
            icon: TrendingUp,
            iconBg: stats.successRate >= 90
              ? "bg-[hsl(150,50%,92%)] text-[hsl(150,50%,30%)]"
              : "bg-[hsl(40,80%,92%)] text-[hsl(40,70%,35%)]",
            change: stats.successRate >= 90 ? "Healthy" : "Needs attention",
            changeUp: stats.successRate >= 90,
          },
          {
            title: "Pending",
            value: stats.pendingCount.toLocaleString(),
            icon: Clock,
            iconBg: "bg-[hsl(40,80%,92%)] text-[hsl(40,70%,35%)]",
          },
          {
            title: "Failed",
            value: stats.failedCount.toLocaleString(),
            icon: AlertCircle,
            iconBg: "bg-destructive/10 text-destructive",
          },
        ].map((stat, i) => (
          <motion.div key={stat.title} custom={i} variants={fadeUp} initial="hidden" animate="visible">
            <Card className="hover:shadow-md transition-all border-0 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.title}</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                    {stat.change && (
                      <div className={`flex items-center gap-1 text-[11px] font-bold ${stat.changeUp ? "text-[hsl(150,50%,30%)]" : "text-[hsl(40,70%,35%)]"}`}>
                        {stat.changeUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {stat.change}
                      </div>
                    )}
                  </div>
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${stat.iconBg}`}>
                    <stat.icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart + Wallets */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <motion.div className="lg:col-span-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card className="h-full border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Revenue Trend</CardTitle>
                  <CardDescription>Last 14 days</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/merchant/analytics")} className="text-xs gap-1 rounded-xl">
                  Details <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length > 1 ? (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          fontSize: "12px",
                          boxShadow: "var(--shadow-medium)",
                        }}
                        formatter={(value: number) => [`${value.toLocaleString()} ${currency}`, "Revenue"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#revenueGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
                  Not enough data to display chart
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Wallets */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <Card className="h-full border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">Wallets</CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setShowWalletBalances(!showWalletBalances)}>
                  {showWalletBalances ? <Eye className="h-4 w-4 text-muted-foreground" strokeWidth={2} /> : <EyeOff className="h-4 w-4 text-muted-foreground" strokeWidth={2} />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {wallets.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Wallet className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-muted-foreground">No wallet balances yet</p>
                </div>
              ) : (
                wallets.map(w => (
                  <div key={w.id} className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{w.currency} Balance</span>
                      <Badge variant="outline" className="text-[10px] font-bold rounded-lg">Available</Badge>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                      {showWalletBalances ? `${Number(w.available_balance || 0).toLocaleString()}` : '------'}
                      <span className="text-sm font-medium text-muted-foreground ml-1.5">{w.currency}</span>
                    </p>
                    {(Number(w.pending_balance) > 0) && (
                      <p className="text-xs font-bold text-[hsl(40,70%,35%)]">
                        +{Number(w.pending_balance).toLocaleString()} pending
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {quickActions.map((a) => (
            <Card
              key={a.label}
              className="cursor-pointer hover:shadow-md transition-all group border-0 shadow-sm"
              onClick={() => navigate(a.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${a.color} transition-transform duration-300 group-hover:scale-110`}>
                  <a.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{a.label}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Quick action</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold">Recent Transactions</CardTitle>
              <CardDescription>Latest payment activity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/merchant/transactions")} className="gap-1 text-xs rounded-xl">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {charges.length === 0 ? (
              <EmptyState
                icon={<ArrowUpDown className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />}
                title="No transactions yet"
                description="Start integrating with our API to accept your first payment"
                action={{ label: "View API Docs", onClick: () => navigate("/developer/gateway/charges") }}
              />
            ) : (
              <>
                {/* Mobile: Card-based list */}
                <div className="space-y-2 sm:hidden">
                  {charges.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/40 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedTx(c)}
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        c.status === "successful" ? "bg-[hsl(150,50%,92%)] text-[hsl(150,50%,30%)]"
                        : c.status === "failed" ? "bg-destructive/10 text-destructive"
                        : "bg-[hsl(40,80%,92%)] text-[hsl(40,70%,35%)]"
                      }`}>
                        {c.status === "successful" ? <CheckCircle2 className="h-5 w-5" strokeWidth={2} /> 
                         : c.status === "failed" ? <AlertCircle className="h-5 w-5" strokeWidth={2} />
                         : <Clock className="h-5 w-5" strokeWidth={2} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{Number(c.amount).toLocaleString()} {c.currency}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.tx_ref?.slice(0, 16)} · {c.channel || "direct"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className={`text-[10px] font-bold border ${statusColor(c.status)}`}>
                          {c.status}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {c.created_at ? format(new Date(c.created_at), "MMM d") : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table */}
                <div className="overflow-x-auto -mx-6 hidden sm:block">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left py-2.5 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reference</th>
                        <th className="text-left py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Amount</th>
                        <th className="text-left py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                        <th className="text-left py-2.5 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Channel</th>
                        <th className="text-left py-2.5 px-6 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map(c => (
                        <tr
                          key={c.id}
                          className="border-b border-border/40 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setSelectedTx(c)}
                        >
                          <td className="py-3.5 px-6 font-mono text-xs text-foreground/80">{c.tx_ref?.slice(0, 18)}</td>
                          <td className="py-3.5 px-3 font-bold">{Number(c.amount).toLocaleString()} <span className="text-muted-foreground font-normal">{c.currency}</span></td>
                          <td className="py-3.5 px-3">
                            <Badge variant="outline" className={`text-[10px] font-bold border ${statusColor(c.status)}`}>
                              {c.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-3 text-muted-foreground capitalize">{c.channel || "--"}</td>
                          <td className="py-3.5 px-6 text-muted-foreground">{c.created_at ? format(new Date(c.created_at), "MMM d, HH:mm") : "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <TransactionDetailSheet open={!!selectedTx} onOpenChange={o => !o && setSelectedTx(null)} transaction={selectedTx} />
    </div>
  );
}
