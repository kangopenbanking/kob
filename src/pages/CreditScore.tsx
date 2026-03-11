import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, FileText, Sparkles, Target, TrendingUp, Shield, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import PreApprovedOffersCard from '@/components/credit/PreApprovedOffersCard';
import CreditInquiriesPanel from '@/components/credit/CreditInquiriesPanel';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } }),
};

export default function CreditScore() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const verificationRef = useRef<HTMLDivElement>(null);

  const scrollToVerification = () => {
    verificationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  const creditServices = [
    {
      to: '/piggybank',
      label: 'Piggy Bank',
      desc: 'Savings & rent plans',
      impact: '+3 to +10',
      color: 'bg-emerald-600',
    },
    {
      to: '/njangi',
      label: 'Njangi Groups',
      desc: 'Group savings rotation',
      impact: '+3 to +5',
      color: 'bg-violet-600',
    },
    {
      to: '/rent-reporting',
      label: 'Rent Reporting',
      desc: 'Report via KRENTS',
      impact: '+5 to +10',
      color: 'bg-rose-600',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-primary rounded-b-[2rem] px-4 pt-6 pb-10 md:px-8"
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary-foreground/60">CrediQ</p>
              <h1 className="text-2xl md:text-3xl font-bold text-primary-foreground tracking-tight">Your Credit Score</h1>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="secondary"
                size="sm"
                className="rounded-full bg-primary-foreground/15 text-primary-foreground border-0 hover:bg-primary-foreground/25"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button asChild size="sm" variant="secondary" className="rounded-full bg-primary-foreground/15 text-primary-foreground border-0 hover:bg-primary-foreground/25">
                <Link to="/credit-report">
                  <FileText className="h-4 w-4 mr-1.5" />
                  Report
                </Link>
              </Button>
            </div>
          </div>

          {/* Score Hero Card */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 md:p-8">
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="flex justify-center">
                  <CircularScoreDisplay
                    score={score}
                    previousScore={historyData?.[1]?.score}
                    maxScore={850}
                    size={240}
                  />
                </div>
                <div className="space-y-4 text-center md:text-left">
                  <div>
                    <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                      <h2 className="text-2xl font-bold text-foreground">{scoreRange}</h2>
                      <ScoreTypeBadge scoringModel={scoringModel} confidenceLevel={confidenceLevel} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {scoreData?.calculated_at
                        ? `Updated ${new Date(scoreData.calculated_at).toLocaleDateString()}`
                        : 'Not yet calculated'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <Button onClick={handleGenerateTips} size="sm" className="rounded-full gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Get AI Tips
                    </Button>
                    <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                      <Link to="/credit-scores-info">
                        <Target className="h-3.5 w-3.5" />
                        Learn More
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-2">
        {/* PostiQ Feature Showcase */}
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="mt-6">
          <PostiQFeatureShowcase hasVerification={!!verification} onVerifyClick={scrollToVerification} />
        </motion.div>

        {/* PostiQ Address Verification */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible" ref={verificationRef} className="mt-6">
          <PostiQVerification />
        </motion.div>

        {/* Core Metrics Row */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="grid md:grid-cols-3 gap-4 mt-6">
          <ScoreMetadata
            scoreVersion={scoreData?.score_version}
            calculatedAt={scoreData?.calculated_at}
            nextUpdateDate={scoreData?.next_update_date}
            expiresAt={scoreData?.expires_at}
          />
          <DataSourceChart scoringModel={scoringModel} externalBureauUsed={externalDataUsed} />
          <QuickStats
            totalLoans={scoreFactors?.details?.total_loans}
            totalSavings={scoreFactors?.details?.total_savings}
            kycVerified={kycVerified}
            externalDataUsed={externalDataUsed}
          />
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-5 mt-6 pb-12">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Score Components */}
            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Score Components</CardTitle>
                  <CardDescription className="text-xs">8 factors affecting your score</CardDescription>
                </CardHeader>
                <CardContent>
                  {scoreFactors?.components ? (
                    <ScoreComponentDetails components={scoreFactors.components} />
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">No data available</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Score Breakdown Chart */}
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Score Breakdown</CardTitle>
                  <CardDescription className="text-xs">Visual distribution of scoring components</CardDescription>
                </CardHeader>
                <CardContent>
                  {scoreFactors?.components ? (
                    <ScoreBreakdownChart components={scoreFactors.components} />
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">No data available</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Score Trend */}
            <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Score Trend</CardTitle>
                  <CardDescription className="text-xs">Your score history over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {historyData && historyData.length > 0 ? (
                    <ScoreTrendChart history={historyData.map(h => ({
                      id: h.id,
                      score: h.score,
                      calculated_at: h.recorded_at
                    }))} />
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">No history available</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Credit-Building Services */}
            <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Build Your Score</CardTitle>
                      <CardDescription className="text-xs">Active participation impacts your CrediQ score</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {creditServices.map((svc) => (
                      <Link
                        key={svc.to}
                        to={svc.to}
                        className="flex items-center gap-3 rounded-2xl border border-border/50 p-3.5 hover:bg-accent/50 transition-colors group"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${svc.color}`}>
                          <Target className="h-4 w-4 text-white" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">{svc.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{svc.desc}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 font-bold">{svc.impact}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Educational Content */}
            <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
              <ScoreEducation />
            </motion.div>

            {/* AI Tips */}
            {tips && tips.length > 0 && (
              <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible">
                <AITipsCard tips={tips} onTipComplete={refetchTips} />
              </motion.div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
              <LinkedAccountsWidget />
            </motion.div>
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
              <ConfidenceIndicator
                confidenceLevel={confidenceLevel}
                scoringModel={scoringModel}
                kycVerified={kycVerified}
                externalDataUsed={externalDataUsed}
              />
            </motion.div>
            <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
              <ScoreSimulator currentScore={score} />
            </motion.div>
            <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
              <CreditActivityFeed activities={activities} />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
