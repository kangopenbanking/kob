import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Sparkles, Target, TrendingUp, ChevronRight, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CircularScoreDisplay from '@/components/credit/CircularScoreDisplay';
import ScoreTrendChart from '@/components/credit/ScoreTrendChart';
import AITipsCard from '@/components/credit/AITipsCard';
import ScoreSimulator from '@/components/credit/ScoreSimulator';
import CreditActivityFeed from '@/components/credit/CreditActivityFeed';
import ScoreComponentDetails from '@/components/credit/ScoreComponentDetails';
import ScoreTypeBadge from '@/components/credit/ScoreTypeBadge';
import ConfidenceIndicator from '@/components/credit/ConfidenceIndicator';
import ScoreEducation from '@/components/credit/ScoreEducation';
import { PostiQVerification } from '@/components/credit/PostiQVerification';
import PostiQFeatureShowcase from '@/components/credit/PostiQFeatureShowcase';
import LinkedAccountsWidget from '@/components/credit/LinkedAccountsWidget';
import CreditInquiriesPanel from '@/components/credit/CreditInquiriesPanel';
import CreditFactorGrid from '@/components/credit/CreditFactorGrid';
import FullReportPaywall from '@/components/credit/FullReportPaywall';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

export default function CreditScore() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const verificationRef = useRef<HTMLDivElement>(null);

  const scrollToVerification = () => {
    verificationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const { data: scoreData, isLoading, refetch } = useQuery({
    queryKey: ['credit-score'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('credit-score-fetch', {
        body: { user_id: user.id, include_report: false },
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
        .limit(12);
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
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.functions.invoke('credit-score-fetch', {
        body: { user_id: user.id, force_refresh: true },
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
      impact: hist.score_change > 0 ? ('positive' as const) : hist.score_change < 0 ? ('negative' as const) : ('neutral' as const),
    })) || []),
    ...(inquiriesData?.slice(0, 2).map((inq: any) => ({
      id: inq.id,
      type: 'inquiry' as const,
      title: `${inq.inquiry_type === 'hard' ? 'Hard' : 'Soft'} Inquiry`,
      description: inq.purpose || 'Credit inquiry performed',
      timestamp: inq.inquiry_date,
      impact: inq.inquiry_type === 'hard' ? ('negative' as const) : ('neutral' as const),
    })) || []),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const totalSavings = scoreFactors?.details?.total_savings || 0;
  const totalLoans = scoreFactors?.details?.total_loans || 0;

  const creditServices = [
    { to: '/piggybank', label: 'Piggy Bank', desc: 'Savings & rent plans', impact: '+3 to +10', color: 'bg-emerald-600' },
    { to: '/njangi', label: 'Njangi Groups', desc: 'Group savings rotation', impact: '+3 to +5', color: 'bg-violet-600' },
    { to: '/rent-reporting', label: 'Rent Reporting', desc: 'Report via KRENTS', impact: '+5 to +10', color: 'bg-rose-600' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ── HERO ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-emerald-600 dark:from-primary dark:via-primary/90 dark:to-emerald-700 rounded-b-[2.5rem] px-4 pt-6 pb-14 md:px-8"
      >
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />

        <div className="relative max-w-5xl mx-auto">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground/50">CrediQ</p>
              <h1 className="text-2xl md:text-3xl font-bold text-primary-foreground tracking-tight">Credit Score</h1>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                size="sm"
                className="rounded-full bg-white/15 text-primary-foreground border-0 hover:bg-white/25 backdrop-blur-sm"
                variant="ghost"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                onClick={handleGenerateTips}
                size="sm"
                className="rounded-full bg-white/15 text-primary-foreground border-0 hover:bg-white/25 backdrop-blur-sm gap-1.5"
                variant="ghost"
              >
                <Sparkles className="h-4 w-4" />
                Tips
              </Button>
            </div>
          </div>

          {/* Score display centered */}
          <div className="flex flex-col items-center">
            <CircularScoreDisplay
              score={score}
              previousScore={historyData?.[1]?.score}
              maxScore={850}
              size={260}
            />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-4 flex items-center gap-3"
            >
              <div className="flex items-center gap-1.5">
                <ScoreTypeBadge scoringModel={scoringModel} confidenceLevel={confidenceLevel} />
              </div>
              {scoreData?.calculated_at && (
                <span className="text-xs text-primary-foreground/50">
                  Updated {new Date(scoreData.calculated_at).toLocaleDateString()}
                </span>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ── QUICK STATS floating cards ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 -mt-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-3"
        >
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <ArrowUpRight className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Total Savings</p>
                <p className="text-lg font-bold text-foreground truncate">
                  {totalSavings > 0 ? `${totalSavings.toLocaleString()} XAF` : '--'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-lg">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <ArrowDownRight className="h-5 w-5 text-rose-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Outstanding Debt</p>
                <p className="text-lg font-bold text-foreground truncate">
                  {totalLoans > 0 ? `${totalLoans.toLocaleString()} XAF` : '--'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 mt-6">
        {/* ── CREDIT FACTOR GRID ── */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-foreground">Credit Factors</h2>
            <p className="text-xs text-muted-foreground">Key factors influencing your score</p>
          </div>
          <CreditFactorGrid components={scoreFactors?.components} />
        </motion.div>

        {/* ── PostiQ ── */}
        <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="mt-6">
          <PostiQFeatureShowcase hasVerification={!!verification} onVerifyClick={scrollToVerification} />
        </motion.div>
        <motion.div custom={2.5} variants={fadeUp} initial="hidden" animate="visible" ref={verificationRef} className="mt-4">
          <PostiQVerification />
        </motion.div>

        {/* ── MAIN CONTENT GRID ── */}
        <div className="grid lg:grid-cols-3 gap-5 mt-6 pb-12">
          {/* Left Column — 2/3 */}
          <div className="lg:col-span-2 space-y-5">
            {/* Score Trend */}
            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Score Trend</CardTitle>
                  <CardDescription className="text-xs">Your score history over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {historyData && historyData.length > 0 ? (
                    <ScoreTrendChart
                      history={historyData.map(h => ({
                        id: h.id,
                        score: h.score,
                        calculated_at: h.recorded_at,
                      }))}
                    />
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">No history available</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Score Components */}
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Score Components</CardTitle>
                  <CardDescription className="text-xs">Detailed breakdown of scoring factors</CardDescription>
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

            {/* Full Report Paywall */}
            <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
              <FullReportPaywall />
            </motion.div>

            {/* Build Your Score */}
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
                    {creditServices.map(svc => (
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

          {/* Right Column — 1/3 */}
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
            <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
              <CreditInquiriesPanel compact />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
