import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Clock, AlertTriangle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeveloperLayout } from "@/components/developer/DeveloperLayout";
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
} from "recharts";

export default function SandboxUsage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [usage, setUsage] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Fetch sandbox account
      const { data: accountData } = await supabase
        .from('developer_sandbox_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!accountData) {
        navigate('/developer/sandbox');
        return;
      }

      setAccount(accountData);

      // Fetch API keys
      const { data: keysData } = await supabase
        .from('sandbox_api_keys')
        .select('id')
        .eq('sandbox_account_id', accountData.id)
        .eq('is_active', true);

      if (!keysData || keysData.length === 0) {
        setLoading(false);
        return;
      }

      const keyIds = keysData.map(k => k.id);

      // Fetch usage data (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: usageData } = await supabase
        .from('sandbox_api_usage')
        .select('*')
        .in('api_key_id', keyIds)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      setUsage(usageData || []);

      // Calculate stats
      const total = usageData?.length || 0;
      const successful = usageData?.filter(u => u.status_code < 400).length || 0;
      const failed = total - successful;
      const avgResponseTime = usageData?.reduce((sum, u) => sum + (u.response_time_ms || 0), 0) / total || 0;

      setStats({
        total,
        successful,
        failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : 0,
        avgResponseTime: avgResponseTime.toFixed(0),
      });

    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate usage by day
  const dailyUsage = usage.reduce((acc: any[], item) => {
    const date = new Date(item.created_at).toLocaleDateString();
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.requests++;
      if (item.status_code >= 400) existing.errors++;
    } else {
      acc.push({
        date,
        requests: 1,
        errors: item.status_code >= 400 ? 1 : 0,
      });
    }
    return acc;
  }, []);

  // Top endpoints
  const endpointStats = usage.reduce((acc: Record<string, any>, item) => {
    if (!acc[item.endpoint]) {
      acc[item.endpoint] = { endpoint: item.endpoint, count: 0, errors: 0 };
    }
    acc[item.endpoint].count++;
    if (item.status_code >= 400) acc[item.endpoint].errors++;
    return acc;
  }, {});

  const topEndpoints = Object.values(endpointStats)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  if (loading) {
    return (
      <DeveloperLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DeveloperLayout>
    );
  }

  return (
    <DeveloperLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Usage & Analytics</h1>
          <p className="text-muted-foreground">
            Monitor your sandbox API usage and performance metrics
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold">{stats?.total || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-2xl font-bold">{stats?.successRate || 0}%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Failed Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-2xl font-bold">{stats?.failed || 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Response Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold">{stats?.avgResponseTime || 0}ms</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Request Volume</CardTitle>
            <CardDescription>API requests over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Requests"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="errors" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    name="Errors"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No usage data yet. Start making API calls to see analytics.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>Top Endpoints</CardTitle>
            <CardDescription>Most frequently accessed API endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            {topEndpoints.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topEndpoints}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No endpoint data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rate Limit Info */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Limits</CardTitle>
            <CardDescription>
              Your current tier: <Badge>{account?.tier?.toUpperCase()}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Per Minute:</span>
              <span className="font-medium">
                {account?.tier === 'pro' ? '1,000' : account?.tier === 'basic' ? '300' : '60'} requests
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Per Day:</span>
              <span className="font-medium">
                {account?.tier === 'pro' ? '100,000' : account?.tier === 'basic' ? '10,000' : '1,000'} requests
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DeveloperLayout>
  );
}