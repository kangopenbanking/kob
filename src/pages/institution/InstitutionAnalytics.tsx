import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign,
  Activity,
  ArrowUpRight,
  PieChart
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend
} from "recharts";

interface AnalyticsData {
  totalTransactions: number;
  totalVolume: number;
  activeAccounts: number;
  apiCalls: number;
  transactionsByDay: { date: string; count: number; volume: number }[];
  transactionsByType: { type: string; count: number }[];
  apiUsageByEndpoint: { endpoint: string; count: number }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function InstitutionAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalTransactions: 0,
    totalVolume: 0,
    activeAccounts: 0,
    apiCalls: 0,
    transactionsByDay: [],
    transactionsByType: [],
    apiUsageByEndpoint: []
  });

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: institution } = await supabase
        .from("institutions")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!institution) {
        navigate('/register');
        return;
      }

      setInstitutionId(institution.id);

      const periodDays = parseInt(period);
      const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

      // Get accounts for this institution
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("institution_id", institution.id);

      const accountIds = accounts?.map(a => a.id) || [];

      // Get transactions - use institution_id directly
      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("amount, booking_datetime, credit_debit_indicator, status")
        .eq("institution_id", institution.id)
        .gte("booking_datetime", startDate);

      // Cast to any to avoid type issues
      const transactions: any[] = transactionsData || [];

      // Get API usage
      const { data: apiUsage } = await supabase
        .from("api_usage_metrics")
        .select("endpoint, status_code")
        .eq("institution_id", institution.id)
        .gte("created_at", startDate);

      // Calculate metrics
      const totalVolume = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      
      // Group by day
      const byDay: Record<string, { count: number; volume: number }> = {};
      transactions.forEach((t: any) => {
        const date = t.booking_datetime?.split('T')[0] || 'unknown';
        if (!byDay[date]) byDay[date] = { count: 0, volume: 0 };
        byDay[date].count++;
        byDay[date].volume += Number(t.amount || 0);
      });

      const transactionsByDay = Object.entries(byDay)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Group by type
      const byType: Record<string, number> = {};
      transactions.forEach((t: any) => {
        const type = t.credit_debit_indicator || 'Unknown';
        byType[type] = (byType[type] || 0) + 1;
      });

      const transactionsByType = Object.entries(byType)
        .map(([type, count]) => ({ type, count }));

      // Group API usage by endpoint
      const byEndpoint: Record<string, number> = {};
      (apiUsage || []).forEach((a: any) => {
        const endpoint = a.endpoint?.split('?')[0] || 'unknown';
        byEndpoint[endpoint] = (byEndpoint[endpoint] || 0) + 1;
      });

      const apiUsageByEndpoint = Object.entries(byEndpoint)
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setAnalytics({
        totalTransactions: transactions.length,
        totalVolume,
        activeAccounts: accountIds.length,
        apiCalls: apiUsage?.length || 0,
        transactionsByDay,
        transactionsByType,
        apiUsageByEndpoint
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Performance insights and trends</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalTransactions.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                    Last {period} days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalVolume.toLocaleString()} XAF</div>
                  <p className="text-xs text-muted-foreground">Transaction volume</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.activeAccounts}</div>
                  <p className="text-xs text-muted-foreground">Linked accounts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API Calls</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.apiCalls.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Total API requests</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="volume">Volume</TabsTrigger>
            <TabsTrigger value="api">API Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Transactions Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.transactionsByDay}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          name="Transactions"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Transaction Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[300px] w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={analytics.transactionsByType}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="type"
                          label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                        >
                          {analytics.transactionsByType.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="volume">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Transaction Volume Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={analytics.transactionsByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} XAF`, 'Volume']} />
                      <Bar dataKey="volume" fill="hsl(var(--primary))" name="Volume (XAF)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  API Usage by Endpoint
                </CardTitle>
                <CardDescription>Top 10 most used endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : analytics.apiUsageByEndpoint.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No API usage data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={analytics.apiUsageByEndpoint} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={12} />
                      <YAxis dataKey="endpoint" type="category" width={150} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" name="Calls" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
