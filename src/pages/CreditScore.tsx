import { useState, useRef } from 'react';
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
import ScoreComponentDetails from '@/components/credit/ScoreComponentDetails';
import ScoreTypeBadge from '@/components/credit/ScoreTypeBadge';
import DataSourceChart from '@/components/credit/DataSourceChart';
import ConfidenceIndicator from '@/components/credit/ConfidenceIndicator';
import ScoreMetadata from '@/components/credit/ScoreMetadata';
import ScoreEducation from '@/components/credit/ScoreEducation';
import QuickStats from '@/components/credit/QuickStats';
import { PostiQVerification } from '@/components/credit/PostiQVerification';
import PostiQFeatureShowcase from '@/components/credit/PostiQFeatureShowcase';
import LinkedAccountsWidget from '@/components/credit/LinkedAccountsWidget';

export default function CreditScore() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const verificationRef = useRef<HTMLDivElement>(null);

  const scrollToVerification = () => {
    verificationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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

  // Fetch PostiQ verification status
  const { data: verification } = useQuery({
    queryKey: ['postiq-verification'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('postiq_address_verifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('verified_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    }
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
  const scoringModel = scoreData?.scoring_model || 'baseline';
  const confidenceLevel = scoreData?.confidence_level || 0.3;
  const scoreFactors = scoreData?.score_factors as any;
  const kycVerified = scoreFactors?.details?.kyc_verified || false;
  const externalDataUsed = scoreFactors?.details?.external_data_used || false;

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
    <div className="space-y-8">
      {/* PostiQ Feature Showcase */}
      <PostiQFeatureShowcase 
        hasVerification={!!verification}
        onVerifyClick={scrollToVerification}
      />

      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Credit Score</h1>
            <p className="text-muted-foreground mt-1">
              Last updated: {scoreData?.calculated_at ? new Date(scoreData.calculated_at).toLocaleDateString() : 'Never'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" className="rounded-full" size="sm">
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button asChild className="rounded-full" size="sm">
              <Link to="/credit-report">
                <FileText className="mr-2 h-4 w-4" />
                Full Report
              </Link>
            </Button>
          </div>
        </div>

        {/* PostiQ Address Verification */}
        <div ref={verificationRef}>
          <PostiQVerification />
        </div>

        {/* Hero Section - Score Display with Type and Confidence */}
        <Card className="overflow-hidden mb-8 rounded-xl border-0 shadow-sm">
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
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold">{scoreRange}</h2>
                    <ScoreTypeBadge 
                      scoringModel={scoringModel} 
                      confidenceLevel={confidenceLevel}
                    />
                  </div>
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

        {/* Core Metrics Row */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <ScoreMetadata
            scoreVersion={scoreData?.score_version}
            calculatedAt={scoreData?.calculated_at}
            nextUpdateDate={scoreData?.next_update_date}
            expiresAt={scoreData?.expires_at}
          />
          <DataSourceChart
            scoringModel={scoringModel}
            externalBureauUsed={externalDataUsed}
          />
          <QuickStats
            totalLoans={scoreFactors?.details?.total_loans}
            totalSavings={scoreFactors?.details?.total_savings}
            kycVerified={kycVerified}
            externalDataUsed={externalDataUsed}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Detailed Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Component Details - Expandable Cards */}
            <Card>
              <CardHeader>
                <CardTitle>Score Components</CardTitle>
                <CardDescription>
                  Detailed breakdown of the 8 factors affecting your score
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scoreFactors?.components ? (
                  <ScoreComponentDetails components={scoreFactors.components} />
                ) : (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Score Breakdown Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Score Breakdown</CardTitle>
                <CardDescription>Visual distribution of scoring components</CardDescription>
              </CardHeader>
              <CardContent>
                {scoreFactors?.components ? (
                  <ScoreBreakdownChart components={scoreFactors.components} />
                ) : (
                  <p className="text-center text-muted-foreground py-8">No data available</p>
                )}
              </CardContent>
            </Card>

            {/* Score Trend */}
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

            {/* Credit-Building Services */}
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 via-violet-500 to-orange-500" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Build Credit with These Services
                </CardTitle>
                <CardDescription>Active participation in these services directly impacts your CrediQ score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <Link to="/piggybank" className="flex items-center gap-4 rounded-xl border p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Piggy Bank</p>
                      <p className="text-xs text-muted-foreground">Savings & rent plans · Up to +10 pts per on-time payment</p>
                    </div>
                    <Badge variant="outline" className="text-xs">+3 to +10</Badge>
                  </Link>
                  <Link to="/njangi" className="flex items-center gap-4 rounded-xl border p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Njangi Groups</p>
                      <p className="text-xs text-muted-foreground">Group savings rotation · Up to +5 pts per contribution</p>
                    </div>
                    <Badge variant="outline" className="text-xs">+3 to +5</Badge>
                  </Link>
                  <Link to="/rent-reporting" className="flex items-center gap-4 rounded-xl border p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-600">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Rent Reporting</p>
                      <p className="text-xs text-muted-foreground">Report rent payments via KRENTS · Up to +10 pts monthly</p>
                    </div>
                    <Badge variant="outline" className="text-xs">+5 to +10</Badge>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Educational Content */}
            <ScoreEducation />

            {/* AI Tips */}
            {tips && tips.length > 0 && <AITipsCard tips={tips} onTipComplete={refetchTips} />}
          </div>

          {/* Right Column - Quick Actions & Info */}
          <div className="space-y-6">
            {/* Confidence Indicator */}
            <ConfidenceIndicator
              confidenceLevel={confidenceLevel}
              scoringModel={scoringModel}
              kycVerified={kycVerified}
              externalDataUsed={externalDataUsed}
            />

            {/* Score Simulator */}
            <ScoreSimulator currentScore={score} />

            {/* Activity Feed */}
            <CreditActivityFeed activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
