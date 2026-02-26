import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { Loader2, DollarSign, TrendingUp, RotateCcw, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { subDays, startOfDay, endOfDay } from "date-fns";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#8b5cf6"];

export default function MerchantAnalytics() {
  const [loading, setLoading] = useState(true);
  const [channelData, setChannelData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ volume: 0, avgTx: 0, refundRate: 0, chargebackRate: 0, txCount: 0 });
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });

  useEffect(() => { loadData(); }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (!m) { setLoading(false); return; }

    const [chargesRes, refundsRes, disputesRes] = await Promise.all([
      supabase.from("gateway_charges").select("amount, status, channel, created_at, currency").eq("merchant_id", m.id).gte("created_at", dateRange.from.toISOString()).lte("created_at", dateRange.to.toISOString()),
      supabase.from("gateway_refunds").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).gte("created_at", dateRange.from.toISOString()).lte("created_at", dateRange.to.toISOString()),
      supabase.from("gateway_disputes").select("id", { count: "exact", head: true }).eq("merchant_id", m.id).gte("created_at", dateRange.from.toISOString()).lte("created_at", dateRange.to.toISOString()),
    ]);

    const charges = chargesRes.data || [];
    const successful = charges.filter(c => c.status === "successful");
    const volume = successful.reduce((s, c) => s + Number(c.amount), 0);
    const avgTx = successful.length > 0 ? Math.round(volume / successful.length) : 0;
    const refundRate = charges.length > 0 ? Math.round(((refundsRes.count || 0) / charges.length) * 100 * 10) / 10 : 0;
    const chargebackRate = charges.length > 0 ? Math.round(((disputesRes.count || 0) / charges.length) * 100 * 10) / 10 : 0;

    setKpis({ volume, avgTx, refundRate, chargebackRate, txCount: charges.length });

    // Channel breakdown
    const channelMap: Record<string, number> = {};
    successful.forEach(c => { channelMap[c.channel || "unknown"] = (channelMap[c.channel || "unknown"] || 0) + Number(c.amount); });
    setChannelData(Object.entries(channelMap).map(([name, value]) => ({ name, value })));

    // Status breakdown (donut)
    const statusMap: Record<string, number> = {};
    charges.forEach(c => { statusMap[c.status || "unknown"] = (statusMap[c.status || "unknown"] || 0) + 1; });
    setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

    // Daily revenue
    const daily: Record<string, number> = {};
    successful.forEach(c => {
      const day = c.created_at?.split("T")[0] || "";
      daily[day] = (daily[day] || 0) + Number(c.amount);
    });
    setDailyData(Object.entries(daily).sort().map(([date, revenue]) => ({ date: date.slice(5), revenue })));

    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const currency = "XAF";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Analytics</h1><p className="text-muted-foreground">Revenue trends and payment insights</p></div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Volume" value={`${kpis.volume.toLocaleString()} ${currency}`} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Avg Transaction" value={`${kpis.avgTx.toLocaleString()} ${currency}`} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Refund Rate" value={`${kpis.refundRate}%`} icon={<RotateCcw className="h-5 w-5" />} trend={kpis.refundRate > 5 ? { value: kpis.refundRate, label: "of charges" } : undefined} />
        <StatCard title="Chargeback Rate" value={`${kpis.chargebackRate}%`} icon={<AlertTriangle className="h-5 w-5" />} trend={kpis.chargebackRate > 1 ? { value: kpis.chargebackRate, label: "of charges" } : undefined} />
      </div>

      {/* Revenue Trend (Area) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
        <CardContent>
          {dailyData.length === 0 ? <p className="text-center text-muted-foreground py-8">No data for selected period</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Channel Pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue by Channel</CardTitle></CardHeader>
          <CardContent>
            {channelData.length === 0 ? <p className="text-center text-muted-foreground py-8">No data</p> : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart><Pie data={channelData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                  {channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Donut */}
        <Card>
          <CardHeader><CardTitle className="text-base">Transaction Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? <p className="text-center text-muted-foreground py-8">No data</p> : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={false}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusData.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="capitalize">{s.name}</span>
                      <span className="text-muted-foreground ml-auto">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
