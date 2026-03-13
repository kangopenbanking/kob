import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw, Target, TrendingUp, ChevronRight, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CircularScoreDisplay from '@/components/credit/CircularScoreDisplay';
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

  const { data: activePurchase } = useQuery({
    queryKey: ['credit-report-purchase'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('credit_report_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('expires_at', new Date().toISOString())
        .order('purchased_at', { ascending: false })
        .limit(1)
        .maybeSingle();
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
        className="px-4 pt-8 pb-6 md:px-8"
      >
        <div className="max-w-5xl mx-auto">
          {/* Greeting */}
          <div className="text-center mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Here is your credit rate
            </h1>
          </div>

          {/* Score type badges */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-2 mb-6"
          >
            <ScoreTypeBadge scoringModel={scoringModel} confidenceLevel={confidenceLevel} />
            {scoreData?.calculated_at && (
              <span className="text-xs text-muted-foreground">
                Updated {new Date(scoreData.calculated_at).toLocaleDateString()}
              </span>
            )}
          </motion.div>

          {/* Score display centered */}
          <div className="flex flex-col items-center">
            <CircularScoreDisplay
              score={score}
              previousScore={historyData?.[1]?.score}
              maxScore={850}
              size={320}
            />
          </div>

          {/* Action row */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <span
              onClick={handleRefresh}
              className={`text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors flex items-center gap-1.5 ${isRefreshing ? 'pointer-events-none opacity-50' : ''}`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Update score
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── QUICK STATS ── */}
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="rounded-2xl bg-muted/40 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-crediq-green/10 flex items-center justify-center shrink-0">
              <ArrowUpRight className="h-5 w-5 text-crediq-green" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Total Savings</p>
              <p className="text-lg font-bold text-foreground truncate">
                {totalSavings > 0 ? `${totalSavings.toLocaleString()} XAF` : '--'}
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-crediq-red/10 flex items-center justify-center shrink-0">
              <ArrowDownRight className="h-5 w-5 text-crediq-red" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Outstanding Debt</p>
              <p className="text-lg font-bold text-foreground truncate">
                {totalLoans > 0 ? `${totalLoans.toLocaleString()} XAF` : '--'}
              </p>
            </div>
          </div>
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
            {/* Full Report Paywall */}
            <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible">
              <FullReportPaywall />
            </motion.div>

            {/* Score Components — behind paywall */}
            {activePurchase && (
              <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
                <div className="rounded-2xl bg-muted/40 p-5">
                  <h3 className="text-lg font-bold text-foreground">Score Components</h3>
                  <p className="text-xs text-muted-foreground mb-3">Detailed breakdown of scoring factors</p>
                  {scoreFactors?.components ? (
                    <ScoreComponentDetails components={scoreFactors.components} />
                  ) : (
                    <p className="text-center text-muted-foreground py-8 text-sm">No data available</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Build Your Score */}
            <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
              <div className="rounded-2xl bg-muted/40 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Build Your Score</h3>
                    <p className="text-xs text-muted-foreground">Active participation impacts your CrediQ score</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {creditServices.map(svc => (
                    <Link
                      key={svc.to}
                      to={svc.to}
                      className="flex items-center gap-3 rounded-2xl bg-background/60 p-3.5 hover:bg-accent/50 transition-colors group"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${svc.color}`}>
                        <Target className="h-4 w-4 text-white" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">{svc.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{svc.desc}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0 font-bold">{svc.impact}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Educational Content */}
            <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
              <ScoreEducation />
            </motion.div>

            {/* Tips — behind paywall */}
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
