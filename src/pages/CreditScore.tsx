import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, FileText, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import CircularScoreDisplay from '@/components/credit/CircularScoreDisplay';
import ScoreBreakdownChart from '@/components/credit/ScoreBreakdownChart';
import ScoreTrendChart from '@/components/credit/ScoreTrendChart';
import AITipsCard from '@/components/credit/AITipsCard';
import ScoreSimulator from '@/components/credit/ScoreSimulator';
import CreditActivityFeed from '@/components/credit/CreditActivityFeed';

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

  // Fetch AI tips
  const { data: tips, refetch: refetchTips } = useQuery({
    queryKey: ['credit-tips'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('credit-score-tips', {
        body: { force_refresh: false },
      });
      if (error) throw error;
      return data?.tips || [];
    },
    enabled: !!scoreData,
  });

  // Fetch inquiries
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

  // Fetch alerts
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
      await refetchTips();
      toast.success('Credit score updated successfully');
    } catch (error) {
      console.error('Error refreshing score:', error);
      toast.error('Failed to refresh credit score');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGenerateTips = async () => {
    try {
      await supabase.functions.invoke('credit-score-tips', {
        body: { force_refresh: true },
      });
      await refetchTips();
      toast.success('AI tips generated successfully');
    } catch (error) {
      console.error('Error generating tips:', error);
      toast.error('Failed to generate tips');
    }
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

  // Build activity feed
  const activities = [
    ...(historyData?.slice(0, 3).map((hist: any) => ({
      id: hist.id,
      type: 'score_change' as const,
      title: 'Score Updated',
      description: `Your credit score changed to ${hist.score}`,
      timestamp: hist.recorded_at,
      impact: hist.score_change > 0 ? 'positive' as const : hist.score_change < 0 ? 'negative' as const : 'neutral' as const,
    })) || []),
    ...(inquiriesData?.slice(0, 2).map((inq: any) => ({
      id: inq.id,
      type: 'inquiry' as const,
      title: `${inq.inquiry_type === 'hard' ? 'Hard' : 'Soft'} Inquiry`,
      description: inq.purpose || 'Credit inquiry performed',
      timestamp: inq.inquiry_date,
      impact: inq.inquiry_type === 'hard' ? 'negative' as const : 'neutral' as const,
    })) || []),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Your Credit Score</h1>
          <p className="text-muted-foreground">
            Last updated: {scoreData?.calculated_at ? new Date(scoreData.calculated_at).toLocaleDateString() : 'Never'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link to="/credit-report">
              <FileText className="mr-2 h-4 w-4" />
              Full Report
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="flex justify-center">
              <CircularScoreDisplay
                score={score}
                previousScore={historyData?.[1]?.score}
                maxScore={850}
                size={280}
              />
            </div>
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">{scoreRange}</h2>
                <p className="text-muted-foreground">
                  Your credit score is {scoreRange.toLowerCase()}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-4">
                <Button onClick={handleGenerateTips} variant="default" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Get AI Tips
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link to="/credit-scores-info">
                    <Target className="h-4 w-4" />
                    Learn More
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
              <CardDescription>Factors contributing to your credit score</CardDescription>
            </CardHeader>
            <CardContent>
              {scoreData?.score_factors?.components ? (
                <ScoreBreakdownChart components={(scoreData.score_factors as any).components} />
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Score Trend</CardTitle>
              <CardDescription>Your score history over time</CardDescription>
            </CardHeader>
            <CardContent>
              {historyData && historyData.length > 0 ? (
                <ScoreTrendChart history={historyData.map(h => ({ 
                  id: h.id, 
                  score: h.score, 
                  calculated_at: h.recorded_at 
                }))} />
              ) : (
                <p className="text-center text-muted-foreground py-8">No history available</p>
              )}
            </CardContent>
          </Card>

          {tips && tips.length > 0 && <AITipsCard tips={tips} onTipComplete={refetchTips} />}
        </div>

        <div className="space-y-6">
          <ScoreSimulator currentScore={score} />
          <CreditActivityFeed activities={activities} />
        </div>
      </div>
      </div>
    </div>
  );
}
