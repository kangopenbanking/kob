import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, XCircle, RefreshCw, TrendingUp, Activity, HeartPulse} from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface HealthMetric {
  id: string;
  status: "operational" | "degraded" | "down";
  response_time: number;
  uptime: number;
  checked_at: string;
  error_message: string | null;
}

interface ChartDataPoint {
  time: string;
  responseTime: number;
  uptime: number;
}

export default function ApiHealthDashboard() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<"operational" | "degraded" | "down">("operational");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("api_health_metrics")
        .select("*")
        .order("checked_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        setMetrics(data as HealthMetric[]);
        setCurrentStatus(data[0].status as "operational" | "degraded" | "down");

        // Transform data for charts
        const chartPoints = data
          .slice(0, 50)
          .reverse()
          .map((metric) => ({
            time: new Date(metric.checked_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            responseTime: metric.response_time,
            uptime: parseFloat(metric.uptime.toString()),
          }));

        setChartData(chartPoints);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
      toast({
        title: "Error",
        description: "Failed to fetch health metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerHealthCheck = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-health-collector`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!response.ok) throw new Error("Health check failed");

      toast({
        title: "Health Check Complete",
        description: "New metrics have been collected",
      });

      // Refresh metrics after a short delay
      setTimeout(() => fetchMetrics(), 1000);
    } catch (error) {
      console.error("Error triggering health check:", error);
      toast({
        title: "Error",
        description: "Failed to trigger health check",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Set up realtime subscription
    const channel = supabase
      .channel("health-metrics")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "api_health_metrics",
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const getStatusIcon = () => {
    switch (currentStatus) {
      case "operational":
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case "degraded":
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case "down":
        return <XCircle className="h-6 w-6 text-red-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (currentStatus) {
      case "operational":
        return <Badge className="bg-green-500">All Systems Operational</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500">Degraded Performance</Badge>;
      case "down":
        return <Badge className="bg-red-500">Service Disruption</Badge>;
    }
  };

  const calculateStats = () => {
    if (metrics.length === 0) return { avgResponse: 0, uptime: 99.9, totalChecks: 0 };

    const last24h = metrics.filter(
      (m) => new Date(m.checked_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const avgResponse =
      last24h.reduce((sum, m) => sum + m.response_time, 0) / last24h.length;

    const operationalCount = last24h.filter((m) => m.status === "operational").length;
    const uptime = (operationalCount / last24h.length) * 100;

    return {
      avgResponse: Math.round(avgResponse),
      uptime: uptime.toFixed(2),
      totalChecks: last24h.length,
    };
  };

  const stats = calculateStats();

  if (loading && metrics.length === 0) {
    return (
      <div className="space-y-6">
      <AdminPageHeader icon={HeartPulse} title="API Health Dashboard" description="Monitor real-time API health metrics and historical uptime data" />
        <div className="flex items-center justify-center min-h-[300px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground"  />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Page Header */}

        {/* Header with Current Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getStatusIcon()}
            <div>
              <h2 className="text-2xl font-bold">Current Status</h2>
              {getStatusBadge()}
            </div>
          </div>
          <Button onClick={triggerHealthCheck} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Run Health Check
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time (24h)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgResponse}ms</div>
              <p className="text-xs text-muted-foreground">Last {stats.totalChecks} checks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uptime (24h)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uptime}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics.filter((m) => m.status === "operational").length} / {stats.totalChecks}{" "}
                operational
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Checks</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.length}</div>
              <p className="text-xs text-muted-foreground">All time recorded</p>
            </CardContent>
          </Card>
        </div>

        {/* Response Time Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: "Response Time (ms)", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="responseTime"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Uptime Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Uptime Percentage</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} label={{ value: "Uptime (%)", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="uptime"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Checks Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Health Checks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.slice(0, 10).map((metric) => (
                <div
                  key={metric.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {metric.status === "operational" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : metric.status === "degraded" ? (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium capitalize">{metric.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(metric.checked_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{metric.response_time}ms</p>
                    <p className="text-xs text-muted-foreground">{metric.uptime}% uptime</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
