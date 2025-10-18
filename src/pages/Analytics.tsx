import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  TrendingUp, 
  Clock,
  AlertCircle,
  BarChart3,
  Globe,
  CheckCircle2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const Analytics = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  
  // Analytics data
  const [totalRequests, setTotalRequests] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [topEndpoints, setTopEndpoints] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [requestsByDay, setRequestsByDay] = useState<any[]>([]);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      // Get user's institution
      const { data: institution } = await supabase
        .from('institutions')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!institution) {
        toast({
          title: "Access Denied",
          description: "No institution found for your account",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      setInstitutionId(institution.id);
      loadAnalytics(institution.id);
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/');
    }
  };

  const loadAnalytics = async (instId: string) => {
    setLoading(true);
    try {
      // Get total requests
      const { count: total } = await supabase
        .from('api_usage_metrics')
        .select('id', { count: 'exact' })
        .eq('institution_id', instId);
      
      setTotalRequests(total || 0);

      // Get success rate
      const { count: successCount } = await supabase
        .from('api_usage_metrics')
        .select('id', { count: 'exact' })
        .eq('institution_id', instId)
        .gte('status_code', 200)
        .lt('status_code', 300);

      const rate = total ? ((successCount || 0) / total) * 100 : 0;
      setSuccessRate(Math.round(rate));

      // Get average response time
      const { data: metricsData } = await supabase
        .from('api_usage_metrics')
        .select('response_time_ms')
        .eq('institution_id', instId)
        .not('response_time_ms', 'is', null);
      
      if (metricsData && metricsData.length > 0) {
        const sum = metricsData.reduce((acc, m) => acc + (m.response_time_ms || 0), 0);
        const avg = Math.round(sum / metricsData.length);
        setAvgResponseTime(avg);
      } else {
        setAvgResponseTime(0);
      }

      // Get top endpoints
      const { data: endpoints } = await supabase
        .from('api_usage_metrics')
        .select('endpoint')
        .eq('institution_id', instId);

      if (endpoints) {
        const endpointCounts = endpoints.reduce((acc: any, item: any) => {
          acc[item.endpoint] = (acc[item.endpoint] || 0) + 1;
          return acc;
        }, {});

        const sorted = Object.entries(endpointCounts)
          .map(([endpoint, count]) => ({ endpoint, count }))
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 5);

        setTopEndpoints(sorted);
      }

      // Get recent requests
      const { data: recent } = await supabase
        .from('api_usage_metrics')
        .select('*')
        .eq('institution_id', instId)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentRequests(recent || []);

      // Get requests by day (last 7 days)
      const { data: byDay } = await supabase
        .from('api_usage_metrics')
        .select('created_at')
        .eq('institution_id', instId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (byDay) {
        const dayCounts = byDay.reduce((acc: any, item: any) => {
          const day = new Date(item.created_at).toLocaleDateString();
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        }, {});

        const sorted = Object.entries(dayCounts)
          .map(([date, count]) => ({ date, count }))
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setRequestsByDay(sorted);
      }

    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <Badge variant="default" className="flex items-center gap-1 w-fit">
        <CheckCircle2 className="h-3 w-3" />
        {statusCode}
      </Badge>;
    } else if (statusCode >= 400 && statusCode < 500) {
      return <Badge variant="secondary" className="flex items-center gap-1 w-fit">
        <AlertCircle className="h-3 w-3" />
        {statusCode}
      </Badge>;
    } else {
      return <Badge variant="destructive" className="flex items-center gap-1 w-fit">
        <AlertCircle className="h-3 w-3" />
        {statusCode}
      </Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
          <BarChart3 className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-accent">API Analytics</span>
        </div>
        <h1 className="text-4xl font-bold mb-2">Usage Analytics</h1>
        <p className="text-muted-foreground">
          Monitor your API usage, performance, and integration health
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Requests</p>
                <p className="text-3xl font-bold">{totalRequests.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Success Rate</p>
                <p className="text-3xl font-bold">{successRate}%</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">2xx responses</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Avg Response Time</p>
                <p className="text-3xl font-bold">{avgResponseTime}ms</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Across all endpoints</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Endpoints Used</p>
                <p className="text-3xl font-bold">{topEndpoints.length}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-accent" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Unique endpoints</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests">
            <Activity className="h-4 w-4 mr-2" />
            Recent Requests
          </TabsTrigger>
          <TabsTrigger value="endpoints">
            <BarChart3 className="h-4 w-4 mr-2" />
            Top Endpoints
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* Recent Requests */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Recent API Requests</CardTitle>
              <CardDescription>
                Latest requests to your API endpoints
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No API requests recorded yet
                </div>
              ) : (
                <div className="space-y-3">
                  {recentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{request.method}</Badge>
                          <span className="font-mono text-sm">{request.endpoint}</span>
                        </div>
                        {getStatusBadge(request.status_code)}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span>Response Time:</span>
                          <span className="ml-2 font-medium">{request.response_time_ms}ms</span>
                        </div>
                        <div>
                          <span>Time:</span>
                          <span className="ml-2">{formatDate(request.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Endpoints */}
        <TabsContent value="endpoints">
          <Card>
            <CardHeader>
              <CardTitle>Most Used Endpoints</CardTitle>
              <CardDescription>
                Your top 5 API endpoints by request volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topEndpoints.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No endpoint data available
                </div>
              ) : (
                <div className="space-y-4">
                  {topEndpoints.map((endpoint: any, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm">{endpoint.endpoint}</span>
                        <span className="font-semibold">{endpoint.count} requests</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{
                            width: `${(endpoint.count / topEndpoints[0].count) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends */}
        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Request Trends</CardTitle>
              <CardDescription>
                API requests over the last 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requestsByDay.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No trend data available
                </div>
              ) : (
                <div className="space-y-4">
                  {requestsByDay.map((day: any, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{day.date}</span>
                        <span className="font-semibold">{day.count} requests</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-accent rounded-full h-2"
                          style={{
                            width: `${(day.count / Math.max(...requestsByDay.map((d: any) => d.count))) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;