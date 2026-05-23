import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, Shield, Clock, CreditCard, Loader2, Zap, Calendar, AlertCircle, MapPin, PiggyBank, Users, Home, ChevronRight, Lightbulb, CheckCircle2, XCircle, Building2, Percent, Banknote, AlertTriangle, RefreshCw, Vault, Coins, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerCreditScore } from '@/hooks/useCustomerData';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { NoCreditScoreCTA } from '@/components/credit/NoCreditScoreCTA';
import { CrediQPremiumCard } from '@/components/credit/CrediQPremiumCard';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

const CustomerCreditScore: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const { data: scoreData, isLoading } = useCustomerCreditScore(user?.id);

  // Recompute mutation
  const recomputeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('credit-recompute', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: (data) => {
      const delta = data?.delta ?? 0;
      const sign = delta > 0 ? '+' : '';
      toast.success(`Score recomputed: ${data?.score} (${sign}${delta} points)`);
      queryClient.invalidateQueries({ queryKey: ['customer-credit-score', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['credit-events', user?.id] });
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not refresh score')),
  });

  // Fetch recent credit events
  const { data: events = [] } = useQuery({
    queryKey: ['credit-events', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('credit_events')
        .select('id, event_type, value_numeric, description, event_time')
        .eq('user_id', user!.id)
        .order('event_time', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // Check what the user has set up
  const { data: hasPostiQ } = useQuery({
    queryKey: ['has-postiq', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('postiq_address_verifications')
        .select('id')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: hasSavings } = useQuery({
    queryKey: ['has-savings', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('piggybank_plans')
        .select('id')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: hasNjangi } = useQuery({
    queryKey: ['has-njangi', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('njangi_members')
        .select('id')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: hasRent } = useQuery({
    queryKey: ['has-rent', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('piggybank_plans')
        .select('id')
        .eq('user_id', user!.id)
        .eq('plan_type', 'rent')
        .limit(1)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: hasBudget } = useQuery({
    queryKey: ['has-budget', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('budgets')
        .select('id')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      return !!data;
    },
  });

  const { data: hasRoundup } = useQuery({
    queryKey: ['has-roundup', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('roundup_settings')
        .select('enabled')
        .eq('consumer_id', user!.id)
        .maybeSingle();
      return !!data?.enabled;
    },
  });

  const score = scoreData?.score ?? 0;
  const maxScore = 850;
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;

  const factors = [
    { name: 'Payment History', score: scoreData?.payment_history_score ?? 0, icon: Clock, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', weight: '35%', tip: 'Pay all contributions and loans on time' },
    { name: 'Credit Utilization', score: scoreData?.amounts_owed_score ?? 0, icon: CreditCard, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', weight: '30%', tip: 'Keep balances low relative to limits' },
    { name: 'Account Age', score: scoreData?.credit_history_length_score ?? 0, icon: Shield, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]', weight: '15%', tip: 'Longer history = higher score' },
    { name: 'New Credit', score: scoreData?.new_credit_score ?? 0, icon: Zap, color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]', weight: '10%', tip: 'Avoid opening too many accounts at once' },
    { name: 'Credit Mix', score: scoreData?.credit_mix_score ?? 0, icon: BarChart3, color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', weight: '10%', tip: 'Diversify with savings, loans & njangi' },
  ];

  const getRating = (s: number) => {
    if (s >= 750) return { label: 'Excellent', color: 'text-[hsl(150,60%,35%)]', bg: 'bg-[hsl(150,40%,90%)]' };
    if (s >= 700) return { label: 'Good', color: 'text-[hsl(150,40%,40%)]', bg: 'bg-[hsl(150,40%,92%)]' };
    if (s >= 600) return { label: 'Fair', color: 'text-[hsl(45,60%,40%)]', bg: 'bg-[hsl(45,70%,90%)]' };
    if (s > 0) return { label: 'Needs Improvement', color: 'text-destructive', bg: 'bg-[hsl(0,60%,95%)]' };
    return { label: 'No Score', color: 'text-muted-foreground', bg: 'bg-muted' };
  };

  const getScoreColor = (s: number) => {
    if (s >= 750) return 'hsl(150,60%,35%)';
    if (s >= 700) return 'hsl(150,40%,40%)';
    if (s >= 600) return 'hsl(45,60%,40%)';
    if (s > 0) return 'hsl(0,60%,50%)';
    return 'hsl(0,0%,70%)';
  };

  const getFactorStatus = (factorScore: number) => {
    if (factorScore >= 75) return { label: 'Strong', icon: CheckCircle2, color: 'text-[hsl(150,60%,35%)]' };
    if (factorScore >= 50) return { label: 'Fair', icon: AlertCircle, color: 'text-[hsl(45,60%,40%)]' };
    if (factorScore > 0) return { label: 'Weak', icon: XCircle, color: 'text-destructive' };
    return { label: 'No Data', icon: AlertCircle, color: 'text-muted-foreground' };
  };

  const eventIcon = (type: string) => {
    if (type.includes('LATE') || type.includes('MISSED')) return { icon: AlertCircle, color: 'text-destructive' };
    if (type.includes('ON_TIME') || type.includes('DEPOSIT')) return { icon: TrendingUp, color: 'text-[hsl(150,60%,40%)]' };
    return { icon: Calendar, color: 'text-muted-foreground' };
  };

  const rating = getRating(score);

  // Build proposals for missing features
  const proposals: { title: string; desc: string; impact: string; icon: React.ElementType; iconBg: string; iconColor: string; route: string }[] = [];

  if (hasPostiQ === false) {
    proposals.push({
      title: 'Verify Your Address',
      desc: 'Add a PostiQ code to boost your score by up to 50 points instantly',
      impact: '+50 pts',
      icon: MapPin,
      iconBg: 'bg-[hsl(0,70%,93%)]',
      iconColor: 'text-[hsl(0,60%,45%)]',
      route: '/app/settings',
    });
  }
  if (hasSavings === false) {
    proposals.push({
      title: 'Start Saving',
      desc: 'Open a Piggy Bank savings plan to earn +3 to +5 points per on-time deposit',
      impact: '+3–5 pts/mo',
      icon: PiggyBank,
      iconBg: 'bg-[hsl(150,40%,90%)]',
      iconColor: 'text-[hsl(150,40%,35%)]',
      route: '/app/piggybank',
    });
  }
  if (hasNjangi === false) {
    proposals.push({
      title: 'Join a Njangi',
      desc: 'Participate in group savings circles — consistent contributions build credit',
      impact: '+5–10 pts/mo',
      icon: Users,
      iconBg: 'bg-[hsl(210,80%,93%)]',
      iconColor: 'text-[hsl(210,60%,45%)]',
      route: '/app/njangi',
    });
  }
  if (hasRent === false) {
    proposals.push({
      title: 'Report Your Rent',
      desc: 'Turn your monthly rent payments into credit-building events',
      impact: '+5–10 pts/mo',
      icon: Home,
      iconBg: 'bg-[hsl(45,70%,90%)]',
      iconColor: 'text-[hsl(45,60%,35%)]',
      route: '/app/rent-reporting',
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">{tr('Credit Score')}</h1>
        </div>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground flex-1">{tr('Credit Score')}</h1>
        <button
          onClick={() => recomputeMutation.mutate()}
          disabled={recomputeMutation.isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card border border-border active:scale-95 transition disabled:opacity-50"
          aria-label={tr('Refresh score')}
        >
          {recomputeMutation.isPending
            ? <Loader2 className="h-4 w-4 animate-spin text-foreground" />
            : <RefreshCw className="h-4 w-4 text-foreground" strokeWidth={1.8} />}
        </button>
      </div>

      {/* Score Gauge Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`flex flex-col items-center gap-4 rounded-3xl ${rating.bg} border border-border p-8`}>
        <div className="relative flex h-40 w-40 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(0,0%,88%)" strokeWidth="7" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none" stroke={getScoreColor(score)} strokeWidth="7"
              strokeDasharray="264" strokeLinecap="round"
              initial={{ strokeDashoffset: 264 }}
              animate={{ strokeDashoffset: 264 - (pct * 2.64) }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <div className="text-center">
            <motion.p
              className="text-4xl font-bold text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {score || '—'}
            </motion.p>
            <p className="text-[10px] font-semibold text-muted-foreground">of {maxScore}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {score >= 600 ? (
            <TrendingUp className="h-4 w-4 text-[hsl(150,40%,35%)]" strokeWidth={2} />
          ) : score > 0 ? (
            <TrendingDown className="h-4 w-4 text-destructive" strokeWidth={2} />
          ) : null}
          <p className={`text-sm font-bold ${rating.color}`}>{rating.label}</p>
        </div>
        {scoreData?.updated_at && (
          <p className="text-[10px] text-muted-foreground">
            Last updated {format(new Date(scoreData.updated_at), 'MMM d, yyyy')}
          </p>
        )}
        {/* Score range legend */}
        <div className="flex w-full items-center gap-1 mt-1">
          {[
            { label: '300', color: 'bg-[hsl(0,60%,50%)]' },
            { label: '', color: 'bg-[hsl(30,60%,50%)]' },
            { label: '600', color: 'bg-[hsl(45,60%,50%)]' },
            { label: '', color: 'bg-[hsl(120,40%,45%)]' },
            { label: '850', color: 'bg-[hsl(150,60%,35%)]' },
          ].map((seg, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className={`h-1.5 w-full rounded-full ${seg.color}`} />
              {seg.label && <span className="text-[8px] text-muted-foreground">{seg.label}</span>}
            </div>
          ))}
        </div>
      </motion.div>

      {/* No-score CTA — shown only when the user hasn't been assessed yet */}
      {score === 0 && (
        <NoCreditScoreCTA
          variant="customer"
          invalidateKeys={[['customer-credit-score', user?.id], ['credit-events', user?.id]]}
        />
      )}

      {/* CrediQ Premium upsell / management */}
      {score > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <CrediQPremiumCard />
        </motion.div>
      )}

      {/* Pre-Approved Loan Offers */}
      <PreApprovedOffersSection score={score} />

      {/* What's Impacting Your Score */}
      {score > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            <p className="text-sm font-bold text-foreground">{tr('What\'s Impacting Your Score')}</p>
          </div>
          <div className="space-y-2">
            {factors.filter(f => f.score > 0).sort((a, b) => a.score - b.score).map((f, i) => {
              const status = getFactorStatus(f.score);
              const StatusIcon = status.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className={`rounded-3xl ${f.color} border border-border p-4`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/60">
                      <f.icon className={`h-4 w-4 ${f.iconColor}`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-foreground">{f.name}</p>
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={`h-3.5 w-3.5 ${status.color}`} strokeWidth={2} />
                          <span className={`text-[10px] font-bold ${status.color}`}>{status.label}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-background/50 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-foreground/60"
                          initial={{ width: 0 }}
                          animate={{ width: `${f.score}%` }}
                          transition={{ duration: 0.8, delay: 0.4 + i * 0.05 }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[10px] text-muted-foreground">{f.tip}</p>
                        <span className="text-[10px] font-semibold text-muted-foreground">{f.weight} weight</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Boost Your Score - Proposals */}
      {proposals.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-[hsl(45,60%,40%)]" strokeWidth={1.5} />
            <p className="text-sm font-bold text-foreground">{tr('Boost Your Score')}</p>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            You're missing out on easy credit-building opportunities. Start any of these to improve your score.
          </p>
          <div className="space-y-2">
            {proposals.map((p, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.06 }}
                onClick={() => navigate(p.route)}
                className="flex w-full items-center gap-3 rounded-3xl bg-card border border-foreground p-4 text-left active:scale-[0.98] transition-transform"
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${p.iconBg}`}>
                  <p.icon className={`h-5 w-5 ${p.iconColor}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{p.desc}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] font-bold text-[hsl(150,60%,35%)]">{p.impact}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Credit Events */}
      {events.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-foreground" strokeWidth={1.5} />
            <p className="text-sm font-bold text-foreground">{tr('Recent Activity')}</p>
          </div>
          <div className="space-y-1.5">
            {events.map((ev: any, i: number) => {
              const { icon: EIcon, color } = eventIcon(ev.event_type);
              const isPositive = ev.event_type.includes('ON_TIME') || ev.event_type.includes('DEPOSIT');
              return (
                <motion.div key={ev.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 + i * 0.03 }} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isPositive ? 'bg-[hsl(150,40%,90%)]' : 'bg-[hsl(0,60%,95%)]'}`}>
                    <EIcon className={`h-3.5 w-3.5 ${color}`} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate">{ev.description || ev.event_type.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {ev.event_time ? format(new Date(ev.event_time), 'MMM d, yyyy') : ''}
                    </p>
                  </div>
                  {ev.value_numeric != null && ev.value_numeric !== 0 && (
                    <span className={`text-[11px] font-bold ${isPositive ? 'text-[hsl(150,60%,40%)]' : 'text-destructive'}`}>
                      {isPositive ? '+' : '−'}{Math.abs(ev.value_numeric)}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Tips */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-foreground" strokeWidth={1.5} />
          <p className="text-sm font-bold text-foreground">{tr('Quick Tips')}</p>
        </div>
        <div className="space-y-2">
          {[
            'Pay Njangi contributions on time',
            'Make regular Piggy Bank deposits',
            'Report rent payments monthly',
            'Repay loans before due dates',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2 rounded-2xl bg-card border border-border p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(150,40%,90%)] text-[10px] font-bold text-[hsl(150,40%,35%)]">{i + 1}</span>
              <p className="text-xs text-foreground">{tip}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

// Inline Pre-Approved Offers for Customer App
function PreApprovedOffersSection({ score }: { score: number }) {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['preapproved-offers-customer', score],
    enabled: score > 0,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('credit-ops', {
        body: { action: 'preapproved-offers', credit_score: score }
      });
      if (error) throw error;
      return (data?.offers || []) as any[];
    },
  });

  const applyMutation = useMutation({
    mutationFn: async ({ offerId, amount }: { offerId: string; amount: number }) => {
      const idempotencyKey = `loan_apply_${offerId}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('credit-ops', {
        body: { action: 'apply-preapproved', offer_id: offerId, requested_amount: amount, idempotency_key: idempotencyKey }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Application submitted! The bank will review your request.');
      queryClient.invalidateQueries({ queryKey: ['preapproved-offers-customer'] });
      setApplyingId(null);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Failed to apply')),
  });

  if (isLoading || !offers.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="flex items-center gap-2 mb-3">
        <Banknote className="h-4 w-4 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
        <p className="text-sm font-bold text-foreground">{tr('Pre-Approved Loans')}</p>
        <span className="ml-auto text-[10px] font-semibold text-muted-foreground">{offers.length} offer{offers.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-2">
        {offers.map((offer: any) => (
          <motion.div
            key={offer.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-3xl bg-card border border-border p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(210,80%,93%)]">
                <Building2 className="h-4 w-4 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">{offer.product_name}</p>
                <p className="text-[10px] text-muted-foreground">{offer.institution_name || 'Financial Institution'}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-0.5">
                    <Banknote className="h-3 w-3" />
                    Up to {Number(offer.max_amount).toLocaleString()} {offer.currency}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-0.5">
                    <Percent className="h-3 w-3" />
                    {offer.interest_rate_annual}% p.a.
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {offer.already_applied ? (
                <div className="flex-1 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
                  <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    You have already applied
                  </p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    {offer.existing_application?.status === 'approved'
                      ? 'Approved — awaiting disbursement'
                      : offer.existing_application?.status === 'disbursed'
                      ? 'Disbursed'
                      : offer.existing_application?.status === 'hard_check_initiated'
                      ? 'Credit check in progress'
                      : 'Pending bank review'}
                    {offer.existing_application?.reference ? ` · Ref ${offer.existing_application.reference}` : ''}
                  </p>
                </div>
              ) : offer.requires_existing_account ? (
                <button
                  onClick={() => navigate('/app/linked-accounts')}
                  className="flex-1 rounded-xl bg-muted py-2 text-[11px] font-bold text-foreground text-center active:scale-[0.98] transition-transform"
                >
                  Open Account & Apply
                </button>
              ) : (
                <button
                  onClick={() => {
                    setApplyingId(offer.id);
                    applyMutation.mutate({ offerId: offer.id, amount: Number(offer.max_amount) });
                  }}
                  disabled={applyMutation.isPending}
                  className="flex-1 rounded-xl bg-foreground py-2 text-[11px] font-bold text-background text-center active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {applyMutation.isPending && applyingId === offer.id ? 'Applying...' : 'Apply Now'}
                </button>
              )}
            </div>
            {!offer.already_applied && (
              <p className="text-[9px] text-muted-foreground mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Applying triggers a hard credit check that may impact your score
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default CustomerCreditScore;
