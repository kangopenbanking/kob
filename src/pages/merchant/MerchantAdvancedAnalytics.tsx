import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, ArrowUpRight, Calendar, Download } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

export default function MerchantAdvancedAnalytics() {
  const [period, setPeriod] = useState("30d");
  const [activeTab, setActiveTab] = useState("revenue");

  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;

  const { data: merchant } = useQuery({
    queryKey: ["merchant-analytics-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data } = await (supabase as any)
        .from("gateway_merchants")
        .select("id, business_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: charges = [] } = useQuery({
    queryKey: ["analytics-charges", merchant?.id, period],
    enabled: !!merchant?.id,
    queryFn: async () => {
      const since = subDays(new Date(), periodDays).toISOString();
      const { data, error } = await (supabase as any)
        .from("gateway_charges")
        .select("id, amount, currency, status, created_at, payment_method, customer_email")
        .eq("merchant_id", merchant.id)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["analytics-payouts", merchant?.id, period],
    enabled: !!merchant?.id,
    queryFn: async () => {
      const since = subDays(new Date(), periodDays).toISOString();
      const { data, error } = await (supabase as any)
        .from("gateway_payouts")
        .select("id, amount, status, created_at")
        .eq("merchant_id", merchant.id)
        .gte("created_at", since)
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  // Computed metrics
  const metrics = useMemo(() => {
    const successful = charges.filter((c: any) => c.status === "successful");
    const totalRevenue = successful.reduce((s: number, c: any) => s + (c.amount || 0), 0);
    const totalCharges = charges.length;
    const successRate = totalCharges > 0 ? (successful.length / totalCharges) * 100 : 0;
    const uniqueCustomers = new Set(charges.map((c: any) => c.customer_email).filter(Boolean)).size;
    const avgOrderValue = successful.length > 0 ? totalRevenue / successful.length : 0;
    const totalPayouts = payouts.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + (p.amount || 0), 0);

    return { totalRevenue, totalCharges, successRate, uniqueCustomers, avgOrderValue, totalPayouts };
  }, [charges, payouts]);

  // Daily revenue chart data
  const revenueChartData = useMemo(() => {
    const dailyMap = new Map<string, { revenue: number; count: number }>();
    charges
      .filter((c: any) => c.status === "successful")
      .forEach((c: any) => {
        const day = format(new Date(c.created_at), "MMM dd");
        const existing = dailyMap.get(day) || { revenue: 0, count: 0 };
        dailyMap.set(day, { revenue: existing.revenue + (c.amount || 0), count: existing.count + 1 });
      });
    return Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data }));
  }, [charges]);

  // Payment method breakdown
  const paymentMethodData = useMemo(() => {
    const methodMap = new Map<string, number>();
    charges
      .filter((c: any) => c.status === "successful")
      .forEach((c: any) => {
        const method = c.payment_method || "unknown";
        methodMap.set(method, (methodMap.get(method) || 0) + (c.amount || 0));
      });
    return Array.from(methodMap.entries()).map(([name, value]) => ({ name, value }));
  }, [charges]);

  // Status breakdown
  const statusData = useMemo(() => {
    const statusMap = new Map<string, number>();
    charges.forEach((c: any) => {
      const status = c.status || "unknown";
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    return Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
  }, [charges]);

  const formatCurrency = (val: number) => `XAF ${val.toLocaleString()}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Advanced Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Deep insights into your payment performance and trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: formatCurrency(metrics.totalRevenue), icon: DollarSign, trend: "+12.5%", up: true },
          { label: "Transactions", value: metrics.totalCharges.toLocaleString(), icon: ShoppingCart, trend: "+8.2%", up: true },
          { label: "Success Rate", value: `${metrics.successRate.toFixed(1)}%`, icon: TrendingUp, trend: "+2.1%", up: true },
          { label: "Unique Customers", value: metrics.uniqueCustomers.toLocaleString(), icon: Users, trend: "+15.3%", up: true },
        ].map(({ label, value, icon: Icon, trend, up }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2">
                {up ? (
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={`text-xs font-medium ${up ? "text-green-600" : "text-red-500"}`}>{trend}</span>
                <span className="text-xs text-muted-foreground">vs previous period</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue Trend</TabsTrigger>
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="status">Status Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue Over Time</CardTitle>
              <CardDescription>Daily revenue from successful transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueChartData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No revenue data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      fill="url(#revenueGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Method Distribution</CardTitle>
              <CardDescription>Revenue by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentMethodData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={paymentMethodData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {paymentMethodData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col justify-center space-y-3">
                    {paymentMethodData.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <span className="text-sm capitalize">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transaction Status Breakdown</CardTitle>
              <CardDescription>Distribution of transaction outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No transaction data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs capitalize" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(metrics.avgOrderValue)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Based on {charges.filter((c: any) => c.status === "successful").length} successful transactions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Net Settlement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(metrics.totalRevenue - metrics.totalPayouts)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Revenue minus {formatCurrency(metrics.totalPayouts)} in payouts
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
