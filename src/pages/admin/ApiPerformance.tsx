import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Activity, AlertCircle, Clock, Zap, BarChart3} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function ApiPerformance() {
  const [timeRange, setTimeRange] = useState("24h");

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["api-performance", timeRange],
    queryFn: async () => {
      const hoursAgo = timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hoursAgo);

      const { data, error } = await supabase
        .from("api_usage_metrics")
        .select("*")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Calculate statistics
  const stats = {
    totalRequests: metrics?.length || 0,
    avgResponseTime: metrics?.reduce((sum, m) => sum + (m.response_time_ms || 0), 0) / (metrics?.length || 1),
    errorRate: ((metrics?.filter(m => m.status_code >= 400).length || 0) / (metrics?.length || 1)) * 100,
    successRate: ((metrics?.filter(m => m.status_code < 400).length || 0) / (metrics?.length || 1)) * 100,
  };

  // Group by endpoint
  const endpointStats = metrics?.reduce((acc: any, metric) => {
    const endpoint = metric.endpoint || "unknown";
    if (!acc[endpoint]) {
      acc[endpoint] = {
        endpoint,
        count: 0,
        totalTime: 0,
        errors: 0,
      };
    }
    acc[endpoint].count++;
    acc[endpoint].totalTime += metric.response_time_ms || 0;
    if (metric.status_code >= 400) acc[endpoint].errors++;
    return acc;
  }, {});

  const endpointData = Object.values(endpointStats || {}).map((stat: any) => ({
    ...stat,
    avgTime: stat.totalTime / stat.count,
    errorRate: (stat.errors / stat.count) * 100,
  })).sort((a: any, b: any) => b.count - a.count);

  // Response time over time (last 24 hours grouped by hour)
  const timeSeriesData = metrics?.reduce((acc: any, metric) => {
    const hour = new Date(metric.created_at).getHours();
    if (!acc[hour]) {
      acc[hour] = { hour: `${hour}:00`, totalTime: 0, count: 0 };
    }
    acc[hour].totalTime += metric.response_time_ms || 0;
    acc[hour].count++;
    return acc;
  }, {});

  const chartData = Object.values(timeSeriesData || {}).map((data: any) => ({
    hour: data.hour,
    avgResponseTime: data.totalTime / data.count,
  }));

  // Status code distribution
  const statusCodeData = metrics?.reduce((acc: any, metric) => {
    const code = Math.floor(metric.status_code / 100) * 100;
    const key = `${code}s`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusCodeData || {}).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminPageHeader icon={BarChart3} title="API Performance Analytics" description="Monitor response times, error rates, and endpoint usage" />

      <div className="flex items-center justify-between">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Total Requests</span>
          </div>
          <div className="text-2xl font-bold mt-2">{stats.totalRequests.toLocaleString()}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Avg Response Time</span>
          </div>
          <div className="text-2xl font-bold mt-2">{stats.avgResponseTime.toFixed(0)}ms</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">Success Rate</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-green-600">
            {stats.successRate.toFixed(1)}%
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-muted-foreground">Error Rate</span>
          </div>
          <div className="text-2xl font-bold mt-2 text-red-600">
            {stats.errorRate.toFixed(1)}%
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Response Time Chart */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Response Time Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="avgResponseTime" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Status Code Distribution */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Status Code Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Top Endpoints */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Top Endpoints by Usage</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Endpoint</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Avg Response Time</TableHead>
              <TableHead>Error Rate</TableHead>
              <TableHead>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : endpointData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No data available</TableCell>
              </TableRow>
            ) : (
              endpointData.slice(0, 10).map((endpoint: any) => (
                <TableRow key={endpoint.endpoint}>
                  <TableCell className="font-mono text-sm">{endpoint.endpoint}</TableCell>
                  <TableCell>{endpoint.count.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={endpoint.avgTime < 200 ? "secondary" : endpoint.avgTime < 500 ? "default" : "destructive"}>
                      {endpoint.avgTime.toFixed(0)}ms
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={endpoint.errorRate < 1 ? "secondary" : endpoint.errorRate < 5 ? "default" : "destructive"}>
                      {endpoint.errorRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {endpoint.avgTime < 200 ? (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-red-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Slowest Endpoints */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Slowest Endpoints</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={endpointData.sort((a: any, b: any) => b.avgTime - a.avgTime).slice(0, 10)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="endpoint" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avgTime" fill="#ff8042" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
