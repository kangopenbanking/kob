import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users, DollarSign, Activity, PieChart } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { subDays, startOfDay, endOfDay } from "date-fns";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#f59e0b", "#ef4444", "#8b5cf6"];

const resolveInstitutionId = async (userId: string): Promise<string | null> => {
  const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", userId).maybeSingle();
  if (inst) return inst.id;
  const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: userId });
  return staffInst || null;
};

interface AnalyticsData {
  totalTransactions: number; totalVolume: number; activeAccounts: number; apiCalls: number;
  transactionsByDay: { date: string; count: number; volume: number }[];
  transactionsByType: { type: string; count: number }[];
  apiUsageByEndpoint: { endpoint: string; count: number }[];
}

export default function InstitutionAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) });
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalTransactions: 0, totalVolume: 0, activeAccounts: 0, apiCalls: 0,
    transactionsByDay: [], transactionsByType: [], apiUsageByEndpoint: []
  });

  useEffect(() => { loadAnalytics(); }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const institutionId = await resolveInstitutionId(user.id);
      if (!institutionId) { navigate('/register'); return; }

      const { data: accounts } = await supabase.from("accounts").select("id").eq("institution_id", institutionId);
      const accountIds = accounts?.map(a => a.id) || [];

      const [transactionsRes, apiUsageRes] = await Promise.all([
        supabase.from("transactions").select("amount, booking_datetime, credit_debit_indicator, status").eq("institution_id", institutionId).gte("booking_datetime", dateRange.from.toISOString()).lte("booking_datetime", dateRange.to.toISOString()),
        supabase.from("api_usage_metrics").select("endpoint, status_code").eq("institution_id", institutionId).gte("created_at", dateRange.from.toISOString()).lte("created_at", dateRange.to.toISOString()),
      ]);

      const transactions: any[] = transactionsRes.data || [];
      const apiUsage = apiUsageRes.data || [];
      const totalVolume = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const byDay: Record<string, { count: number; volume: number }> = {};
      transactions.forEach((t: any) => { const date = t.booking_datetime?.split('T')[0] || 'unknown'; if (!byDay[date]) byDay[date] = { count: 0, volume: 0 }; byDay[date].count++; byDay[date].volume += Number(t.amount || 0); });
      const transactionsByDay = Object.entries(byDay).map(([date, data]) => ({ date: date.slice(5), ...data })).sort((a, b) => a.date.localeCompare(b.date));

      const byType: Record<string, number> = {};
      transactions.forEach((t: any) => { const type = t.credit_debit_indicator || 'Unknown'; byType[type] = (byType[type] || 0) + 1; });
      const transactionsByType = Object.entries(byType).map(([type, count]) => ({ type, count }));

      const byEndpoint: Record<string, number> = {};
      apiUsage.forEach((a: any) => { const ep = a.endpoint?.split('?')[0] || 'unknown'; byEndpoint[ep] = (byEndpoint[ep] || 0) + 1; });
      const apiUsageByEndpoint = Object.entries(byEndpoint).map(([endpoint, count]) => ({ endpoint, count })).sort((a, b) => b.count - a.count).slice(0, 10);

      setAnalytics({ totalTransactions: transactions.length, totalVolume, activeAccounts: accountIds.length, apiCalls: apiUsage.length, transactionsByDay, transactionsByType, apiUsageByEndpoint });
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-indigo/10 border border-fi-indigo/20"><BarChart3 className="h-5 w-5 text-fi-indigo" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground">Performance insights and trends</p>
          </div>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />) : [
          { label: "Total Transactions", value: analytics.totalTransactions.toLocaleString(), icon: Activity, color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20" },
          { label: "Total Volume", value: `${analytics.totalVolume.toLocaleString()} XAF`, icon: DollarSign, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Active Accounts", value: analytics.activeAccounts.toLocaleString(), icon: Users, color: "text-fi-purple bg-fi-purple/10 border-fi-purple/20" },
          { label: "API Calls", value: analytics.apiCalls.toLocaleString(), icon: TrendingUp, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
            <TabsTrigger value="transactions" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Transactions</TabsTrigger>
            <TabsTrigger value="volume" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Volume</TabsTrigger>
            <TabsTrigger value="api" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">API Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-border/60">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-fi-blue" />Transactions Over Time</CardTitle></CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-[280px] w-full" /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={analytics.transactionsByDay}>
                        <defs><linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#txGrad)" strokeWidth={2} name="Transactions" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><PieChart className="h-4 w-4 text-fi-purple" />Transaction Types</CardTitle></CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-[280px] w-full" /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <RechartsPie>
                        <Pie data={analytics.transactionsByType} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="count" nameKey="type" label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}>
                          {analytics.transactionsByType.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="volume">
            <Card className="border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4 text-fi-green" />Transaction Volume Over Time</CardTitle></CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-[350px] w-full" /> : (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={analytics.transactionsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} XAF`, 'Volume']} />
                      <Bar dataKey="volume" fill="hsl(var(--primary))" name="Volume (XAF)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card className="border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-fi-amber" />API Usage by Endpoint</CardTitle><CardDescription className="text-xs">Top 10 most used endpoints</CardDescription></CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-[350px] w-full" /> : analytics.apiUsageByEndpoint.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground"><Activity className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No API usage data available</p></div>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={analytics.apiUsageByEndpoint} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis dataKey="endpoint" type="category" width={150} fontSize={10} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" name="Calls" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
