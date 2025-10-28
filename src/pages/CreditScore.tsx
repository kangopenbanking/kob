import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function CreditScore() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch current credit score
  const { data: scoreData, isLoading, refetch } = useQuery({
    queryKey: ['credit-score'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('credit-score-fetch', {
        body: { user_id: user.id, include_report: false }
      });

      if (error) throw error;
      return data;
    },
  });

  // Fetch score history
  const { data: historyData } = useQuery({
    queryKey: ['credit-score-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('credit_score_history')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  // Fetch recent inquiries
  const { data: inquiriesData } = useQuery({
    queryKey: ['credit-inquiries'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('credit_inquiries')
        .select('*')
        .eq('user_id', user.id)
        .order('inquiry_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  // Fetch monitoring alerts
  const { data: alertsData } = useQuery({
    queryKey: ['credit-alerts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('credit_monitoring_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'unread')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.functions.invoke('credit-score-fetch', {
        body: { user_id: user.id, force_refresh: true }
      });

      await refetch();
      toast.success('Credit score updated successfully');
    } catch (error) {
      console.error('Error refreshing score:', error);
      toast.error('Failed to refresh credit score');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 800) return 'text-green-600';
    if (score >= 740) return 'text-blue-600';
    if (score >= 670) return 'text-yellow-600';
    if (score >= 580) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 800) return 'from-green-500 to-green-700';
    if (score >= 740) return 'from-blue-500 to-blue-700';
    if (score >= 670) return 'from-yellow-500 to-yellow-700';
    if (score >= 580) return 'from-orange-500 to-orange-700';
    return 'from-red-500 to-red-700';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const score = scoreData?.score || 0;
  const scoreRange = scoreData?.score_range || 'Unknown';

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Credit Score</h1>
          <p className="text-muted-foreground">Monitor your creditworthiness and financial health</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Score
          </Button>
          <Button asChild>
            <Link to="/credit-report">
              <Eye className="h-4 w-4 mr-2" />
              View Full Report
            </Link>
          </Button>
        </div>
      </div>

      {/* Unread Alerts */}
      {alertsData && alertsData.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have {alertsData.length} new credit alert{alertsData.length > 1 ? 's' : ''}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Score Display */}
      <Card>
        <CardHeader>
          <CardTitle>Your Credit Score</CardTitle>
          <CardDescription>
            Last updated: {scoreData?.calculated_at ? new Date(scoreData.calculated_at).toLocaleDateString() : 'Never'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="relative">
              <div className={`text-8xl font-bold bg-gradient-to-br ${getScoreGradient(score)} bg-clip-text text-transparent`}>
                {score}
              </div>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <Badge variant={score >= 670 ? 'default' : 'destructive'}>
                  {scoreRange}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Score Range</span>
              <span className="text-sm font-medium">300 - 850</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${getScoreGradient(score)} transition-all duration-500`}
                style={{ width: `${((score - 300) / 550) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="history">Score History</TabsTrigger>
          <TabsTrigger value="inquiries">Credit Inquiries</TabsTrigger>
          <TabsTrigger value="alerts">Monitoring Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Score History</CardTitle>
              <CardDescription>Track your credit score changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              {historyData && historyData.length > 0 ? (
                <div className="space-y-4">
                  {historyData.map((record) => (
                    <div key={record.id} className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-semibold">{record.score}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(record.recorded_at).toLocaleDateString()}
                        </p>
                      </div>
                      {record.score_change && (
                        <div className="flex items-center gap-2">
                          {record.score_change > 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={record.score_change > 0 ? 'text-green-600' : 'text-red-600'}>
                            {record.score_change > 0 ? '+' : ''}{record.score_change}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No history available yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inquiries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Credit Inquiries</CardTitle>
              <CardDescription>Recent checks on your credit report</CardDescription>
            </CardHeader>
            <CardContent>
              {inquiriesData && inquiriesData.length > 0 ? (
                <div className="space-y-4">
                  {inquiriesData.map((inquiry) => (
                    <div key={inquiry.id} className="flex justify-between items-start p-4 border rounded-lg">
                      <div>
                        <p className="font-semibold">{inquiry.inquirer_name}</p>
                        <p className="text-sm text-muted-foreground">{inquiry.purpose}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(inquiry.inquiry_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={inquiry.inquiry_type === 'hard' ? 'destructive' : 'secondary'}>
                        {inquiry.inquiry_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No inquiries yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring Alerts</CardTitle>
              <CardDescription>Important updates about your credit</CardDescription>
            </CardHeader>
            <CardContent>
              {alertsData && alertsData.length > 0 ? (
                <div className="space-y-4">
                  {alertsData.map((alert) => (
                    <Alert key={alert.id}>
                      <AlertCircle className="h-4 w-4" />
                      <div className="ml-4">
                        <p className="font-semibold">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(alert.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </Alert>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No new alerts</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
