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
  Link2, FileText, CreditCard, BarChart3, ArrowUpRight, ArrowDownRight,
  Clock, Zap, Users, Globe,
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

        // Compute stats from count-based queries (no 1000-row limit)
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

        // Build chart data from recent successful charges (limited to last 14 days for chart)
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
          { key: "kyb", title: "Complete KYB Verification", description: "Submit business documents to go live", icon: ShieldCheck, completed: m.kyb_status === "verified" || m.status === "active", path: "/merchant/kyb" },
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
      <div className="flex flex-col items-center justify-center py-16 space-y-6 max-w-lg mx-auto text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Welcome to the Merchant Portal</h2>
          <p className="text-muted-foreground mt-2">
            Get started in minutes and begin accepting payments across Africa.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate("/merchant-register")} className="gap-2">
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
    s === "successful" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
    : s === "failed" ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";

  const quickActions = [
    { label: "Payment Link", icon: Link2, path: "/merchant/payment-links", color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    { label: "Send Invoice", icon: FileText, path: "/merchant/invoices", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { label: "API Keys", icon: Key, path: "/merchant/api-keys", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    { label: "New Charge", icon: CreditCard, path: "/merchant/charges", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{merchant.business_name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Overview of your payment operations · <span className="text-foreground/70">{format(new Date(), "EEEE, MMMM d")}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {disputeCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => navigate("/merchant/disputes")} className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5">
              <AlertCircle className="h-4 w-4" />
              {disputeCount} Open Dispute{disputeCount > 1 ? "s" : ""}
            </Button>
          )}
          <Button size="sm" onClick={() => navigate("/merchant/analytics")} className="gap-2">
            <BarChart3 className="h-4 w-4" /> Analytics
          </Button>
        </div>
      </motion.div>

      {/* KYB Banner */}
      {merchant.kyb_status !== "verified" && merchant.status !== "active" && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10 overflow-hidden">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    KYB Verification: <Badge variant="secondary" className="ml-1">{merchant.kyb_status?.replace(/_/g, " ").toUpperCase()}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Complete your KYB to accept live payments.</p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate("/merchant/kyb")}>Complete KYB</Button>
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
                  <CardTitle className="text-base">Getting Started</CardTitle>
                  <CardDescription className="mt-0.5">{completedSteps} of {setupSteps.length} steps completed</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">{setupProgress}%</span>
                </div>
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
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm hover:bg-muted/40 ${s.completed ? "opacity-50" : ""}`}
                  onClick={() => navigate(s.path)}
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.completed ? "bg-primary/10" : "bg-muted"}`}>
                    {s.completed
                      ? <CheckCircle2 className="h-4.5 w-4.5 text-primary" />
                      : <s.icon className="h-4.5 w-4.5 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${s.completed ? "line-through" : ""}`}>{s.title}</p>
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
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Total Revenue",
            value: `${stats.totalRevenue.toLocaleString()}`,
            suffix: currency,
            icon: DollarSign,
            iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            change: stats.successRate >= 90 ? "+12%" : undefined,
            changeUp: true,
          },
          {
            title: "Transactions",
            value: stats.txCount.toLocaleString(),
            icon: ArrowUpDown,
            iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
          },
          {
            title: "Success Rate",
            value: `${stats.successRate}%`,
            icon: TrendingUp,
            iconBg: stats.successRate >= 90
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            change: stats.successRate >= 90 ? "Healthy" : "Needs attention",
            changeUp: stats.successRate >= 90,
          },
          {
            title: "Pending",
            value: stats.pendingCount.toLocaleString(),
            icon: Clock,
            iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          },
        ].map((stat, i) => (
          <motion.div key={stat.title} custom={i} variants={fadeUp} initial="hidden" animate="visible">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                      {stat.value}
                      {stat.suffix && <span className="text-sm font-medium text-muted-foreground ml-1">{stat.suffix}</span>}
                    </p>
                    {stat.change && (
                      <div className={`flex items-center gap-1 text-xs font-medium ${stat.changeUp ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {stat.changeUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {stat.change}
                      </div>
                    )}
                  </div>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.iconBg}`}>
                    <stat.icon className="h-5 w-5" />
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
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Revenue Trend</CardTitle>
                  <CardDescription>Last 14 days</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/merchant/analytics")} className="text-xs gap-1">
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
                          borderRadius: "8px",
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
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Wallets</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowWalletBalances(!showWalletBalances)}>
                  {showWalletBalances ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {wallets.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No wallet balances yet</p>
                </div>
              ) : (
                wallets.map(w => (
                  <div key={w.id} className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{w.currency} Balance</span>
                      <Badge variant="outline" className="text-[10px]">Available</Badge>
                    </div>
                    <p className="text-xl font-bold tracking-tight">{Number(w.available_balance || 0).toLocaleString()}<span className="text-sm font-medium text-muted-foreground ml-1">{w.currency}</span></p>
                    {(Number(w.pending_balance) > 0) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
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
          {quickActions.map((a, i) => (
            <Card
              key={a.label}
              className="cursor-pointer hover:shadow-md transition-all group border-border/60"
              onClick={() => navigate(a.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${a.color} transition-transform group-hover:scale-110`}>
                  <a.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{a.label}</p>
                  <p className="text-xs text-muted-foreground">Quick action</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Transactions</CardTitle>
              <CardDescription>Latest payment activity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/merchant/transactions")} className="gap-1 text-xs">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {charges.length === 0 ? (
              <EmptyState
                icon={<ArrowUpDown className="h-6 w-6 text-muted-foreground" />}
                title="No transactions yet"
                description="Start integrating with our API to accept your first payment"
                action={{ label: "View API Docs", onClick: () => navigate("/developer/gateway/charges") }}
              />
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left py-2.5 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channel</th>
                      <th className="text-left py-2.5 px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map(c => (
                      <tr
                        key={c.id}
                        className="border-b border-border/40 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setSelectedTx(c)}
                      >
                        <td className="py-3 px-6 font-mono text-xs text-foreground/80">{c.charge_ref?.slice(0, 18)}</td>
                        <td className="py-3 px-3 font-semibold">{Number(c.amount).toLocaleString()} <span className="text-muted-foreground font-normal">{c.currency}</span></td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className={`text-[11px] font-medium border ${statusColor(c.status)}`}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground capitalize">{c.channel || "—"}</td>
                        <td className="py-3 px-6 text-muted-foreground">{c.created_at ? format(new Date(c.created_at), "MMM d, HH:mm") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <TransactionDetailSheet open={!!selectedTx} onOpenChange={o => !o && setSelectedTx(null)} transaction={selectedTx} />
    </div>
  );
}
