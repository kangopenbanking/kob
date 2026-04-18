import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, Shield, Clock, Loader2, ArrowUpRight, ArrowDownRight, Landmark, ChevronRight, Building2, Banknote, Percent, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCreditScore } from '@/hooks/useBankingData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

function getScoreLabel(score: number): string {
  if (score >= 800) return 'Excellent';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
}

// Customer-only event types that should NOT appear in the Banking App
const CUSTOMER_ONLY_PREFIXES = ['PIGGYBANK_', 'NJANGI_', 'RENT_'];

function isCustomerOnlyEvent(type: string): boolean {
  return CUSTOMER_ONLY_PREFIXES.some(prefix => type.startsWith(prefix));
}

function eventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    LOAN_REPAYMENT_ON_TIME: 'On-time Payment',
    LOAN_REPAYMENT_LATE: 'Late Payment',
    LOAN_INSTALLMENT_MISSED: 'Missed Installment',
    LOAN_CLOSED: 'Loan Closed',
    SAVINGS_DEPOSIT: 'Savings Deposit',
    SAVINGS_WITHDRAWAL: 'Savings Withdrawal',
    LOAN_DEFAULTED: 'Loan Default',
  };
  return map[type] || type.replace(/_/g, ' ');
}

function eventTypeColor(type: string): string {
  if (type.includes('ON_TIME') || type === 'SAVINGS_DEPOSIT' || type === 'LOAN_CLOSED') return 'text-[hsl(var(--bank-mint))]';
  if (type.includes('LATE') || type.includes('MISSED')) return 'text-[hsl(var(--bank-amber))]';
  if (type.includes('DEFAULT')) return 'text-[hsl(var(--bank-coral))]';
  return 'text-muted-foreground';
}

const defaultFactors = [
  { icon: TrendingUp, label: 'Payment History', value: '—', color: 'bg-[hsl(var(--bank-mint))]', fg: 'text-[hsl(var(--bank-mint-fg))]' },
  { icon: BarChart3, label: 'Credit Utilization', value: '—', color: 'bg-[hsl(var(--bank-amber))]', fg: 'text-[hsl(var(--bank-amber-fg))]' },
  { icon: Shield, label: 'Account Age', value: '—', color: 'bg-[hsl(var(--bank-sky))]', fg: 'text-white' },
  { icon: Clock, label: 'Recent Inquiries', value: '—', color: 'bg-[hsl(var(--bank-violet))]', fg: 'text-white' },
];

const BankCreditScore: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: creditData, isLoading } = useCreditScore();
  const [overdraftLoading, setOverdraftLoading] = useState(false);
  const [overdraftResult, setOverdraftResult] = useState<any>(null);

  const recomputeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('credit-recompute', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: (data: any) => {
      const delta = data?.delta ?? 0;
      const sign = delta > 0 ? '+' : '';
      toast.success(`Score recomputed: ${data?.score} (${sign}${delta} points)`);
      queryClient.invalidateQueries({ queryKey: ['credit-score'] });
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Could not refresh score')),
  });

  const score = creditData?.score || 0;
  const maxScore = 850;
  const percentage = score > 0 ? (score / maxScore) * 100 : 0;
  const scoreRange = creditData?.score_range || (score > 0 ? getScoreLabel(score) : '—');
  const scoreBand = creditData?.score_band;

  const handleCheckOverdraft = async () => {
    setOverdraftLoading(true);
    try {
      // Get user's accounts to find their primary account
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: accounts } = await supabase.from('accounts').select('id, institution_id, account_holder_name')
        .eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle();

      if (!accounts) {
        toast.error('No active account found');
        return;
      }

      const { data, error } = await supabase.functions.invoke('overdraft-ops', {
        body: { action: 'recalculate', account_id: accounts.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOverdraftResult(data);
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e, 'Failed to check overdraft eligibility'));
    } finally {
      setOverdraftLoading(false);
    }
  };

  // Use event-sourced factors if available, otherwise legacy
  const apiFactors = creditData?.score_factors;
  const isEventSourced = creditData?.source === 'event_sourced';

  // Event-sourced factors from credit-score-engine
  const eventFactors = isEventSourced && Array.isArray(apiFactors) ? apiFactors.filter((f: any) => !isCustomerOnlyEvent(f.event_type || '')) : null;

  // Legacy factors
  const legacyFactors = !isEventSourced && apiFactors ? [
    { icon: TrendingUp, label: 'Payment History', value: apiFactors.payment_history || '—', color: 'bg-[hsl(var(--bank-mint))]', fg: 'text-[hsl(var(--bank-mint-fg))]' },
    { icon: BarChart3, label: 'Credit Utilization', value: apiFactors.credit_utilization || '—', color: 'bg-[hsl(var(--bank-amber))]', fg: 'text-[hsl(var(--bank-amber-fg))]' },
    { icon: Shield, label: 'Account Age', value: apiFactors.account_age || '—', color: 'bg-[hsl(var(--bank-sky))]', fg: 'text-white' },
    { icon: Clock, label: 'Recent Inquiries', value: apiFactors.inquiries?.toString() || '—', color: 'bg-[hsl(var(--bank-violet))]', fg: 'text-white' },
  ] : null;

  const factors = legacyFactors || defaultFactors;
  const recentEvents = (creditData?.recent_events || []).filter((e: any) => !isCustomerOnlyEvent(e.event_type || ''));

  const factorColors = [
    { color: 'bg-[hsl(var(--bank-mint))]', fg: 'text-[hsl(var(--bank-mint-fg))]' },
    { color: 'bg-[hsl(var(--bank-amber))]', fg: 'text-[hsl(var(--bank-amber-fg))]' },
    { color: 'bg-[hsl(var(--bank-sky))]', fg: 'text-white' },
    { color: 'bg-[hsl(var(--bank-violet))]', fg: 'text-white' },
    { color: 'bg-[hsl(var(--bank-coral))]', fg: 'text-white' },
  ];

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back
        </button>
        <button
          onClick={() => recomputeMutation.mutate()}
          disabled={recomputeMutation.isPending}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground active:scale-95 transition disabled:opacity-50"
        >
          {recomputeMutation.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
          Recompute
        </button>
      </div>

      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Credit Score</h1>
      <p className="mb-6 text-sm font-medium text-muted-foreground">
        Your CrediQ rating {scoreBand ? `· Band ${scoreBand}` : ''}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 flex flex-col items-center rounded-3xl bg-[hsl(var(--bank-violet))] p-8"
          >
            <div className="relative mb-5 flex h-36 w-36 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeDasharray={`${percentage}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-bold text-white">{score || '—'}</span>
                <span className="text-sm font-medium text-white/60">/ {maxScore}</span>
              </div>
            </div>
            <span className="rounded-xl bg-white/20 px-4 py-1.5 text-sm font-bold text-white">
              {scoreRange}
            </span>
            {creditData?.calculated_at && (
              <span className="mt-2 text-xs text-white/40">
                Last updated: {new Date(creditData.calculated_at).toLocaleDateString()}
              </span>
            )}
          </motion.div>

          {/* Pre-Approved Loan Offers */}
          <BankPreApprovedOffers score={score} />

          {/* Event-sourced factors */}
          {eventFactors && eventFactors.length > 0 ? (
            <>
              <h3 className="mb-3 text-base font-bold text-foreground">Score Factors</h3>
              <div className="mb-6 flex flex-col gap-2">
                {eventFactors.map((factor: any, i: number) => {
                  const colors = factorColors[i % factorColors.length];
                  const isPositive = factor.total_impact > 0;
                  return (
                    <motion.div
                      key={factor.event_type}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-center justify-between rounded-2xl ${colors.color} p-4`}
                    >
                      <div className="flex items-center gap-3">
                        {isPositive ? (
                          <ArrowUpRight className={`h-5 w-5 ${colors.fg}`} strokeWidth={2} />
                        ) : (
                          <ArrowDownRight className={`h-5 w-5 ${colors.fg}`} strokeWidth={2} />
                        )}
                        <div>
                          <p className={`text-sm font-bold ${colors.fg}`}>
                            {eventTypeLabel(factor.event_type)}
                          </p>
                          <p className={`text-xs ${colors.fg} opacity-70`}>
                            {factor.count} event{factor.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <span className={`text-lg font-bold ${colors.fg}`}>
                        {isPositive ? '+' : ''}{factor.total_impact}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h3 className="mb-3 text-base font-bold text-foreground">Score Factors</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {factors.map((item: any, i: number) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex flex-col items-center gap-2 rounded-2xl ${item.color} p-5`}
                    >
                      <Icon className={`h-6 w-6 ${item.fg}`} strokeWidth={1.5} />
                      <span className={`text-xs font-bold ${item.fg} opacity-70`}>{item.label}</span>
                      <span className={`text-lg font-bold ${item.fg}`}>{item.value}</span>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {/* Recent Credit Events Timeline */}
          {recentEvents.length > 0 && (
            <>
              <h3 className="mb-3 text-base font-bold text-foreground">Recent Activity</h3>
              <div className="flex flex-col gap-2">
                {recentEvents.slice(0, 10).map((event: any, i: number) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between rounded-xl bg-muted px-4 py-3"
                  >
                    <div>
                      <p className={`text-sm font-semibold ${eventTypeColor(event.event_type)}`}>
                        {eventTypeLabel(event.event_type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.event_time).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {event.event_type?.startsWith('LOAN_') ? 'Loan' :
                       event.event_type?.startsWith('SAVINGS_') ? 'Savings' :
                       event.source === 'loans_service' ? 'Loan' :
                       event.source === 'savings_service' ? 'Savings' : 'System'}
                    </span>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* Overdraft Eligibility Section */}
          {score > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6"
            >
              <h3 className="mb-3 text-base font-bold text-foreground">Overdraft Eligibility</h3>
              {!overdraftResult ? (
                <button
                  onClick={handleCheckOverdraft}
                  disabled={overdraftLoading}
                  className="flex w-full items-center justify-between rounded-2xl bg-[hsl(var(--bank-sky))] p-5 transition-transform active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    {overdraftLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : (
                      <Landmark className="h-5 w-5 text-white" strokeWidth={2} />
                    )}
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">
                        {overdraftLoading ? 'Analyzing your profile...' : 'Check Overdraft Eligibility'}
                      </p>
                      <p className="text-xs text-white/70">
                        Based on your credit score and banking activity
                      </p>
                    </div>
                  </div>
                  {!overdraftLoading && <ChevronRight className="h-5 w-5 text-white/60" />}
                </button>
              ) : (
                <div className="rounded-2xl bg-muted p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Eligibility</span>
                    <span className={`text-sm font-bold ${overdraftResult.overdraft_profile?.eligible ? 'text-[hsl(var(--bank-mint))]' : 'text-[hsl(var(--bank-coral))]'}`}>
                      {overdraftResult.overdraft_profile?.eligible ? 'Eligible' : 'Not Eligible'}
                    </span>
                  </div>
                  {overdraftResult.overdraft_profile?.eligible && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Risk Band</span>
                        <span className="text-sm font-bold text-foreground">
                          {overdraftResult.overdraft_profile?.risk_band || overdraftResult.score_factors?.factor_summary?.risk_band || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Recommended Limit</span>
                        <span className="text-sm font-bold text-foreground">
                          {overdraftResult.overdraft_profile?.recommended_limit?.toLocaleString() || '—'} XAF
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Status</span>
                        <span className="text-xs font-semibold rounded-full bg-primary/10 text-primary px-3 py-1">
                          {overdraftResult.auto_approved ? 'Auto-Approved' : 'Pending Review'}
                        </span>
                      </div>
                    </>
                  )}
                  {overdraftResult.score_factors && (
                    <div className="pt-2 border-t border-border space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground">Score Breakdown ({overdraftResult.score_factors.final_score}/100)</p>
                      {[
                        { label: 'Salary Pattern', value: overdraftResult.score_factors.factor_summary?.salary_pattern },
                        { label: 'Savings Health', value: overdraftResult.score_factors.factor_summary?.savings_health },
                        { label: 'Balance Stability', value: overdraftResult.score_factors.factor_summary?.balance_stability },
                        { label: 'Account Tenure', value: overdraftResult.score_factors.factor_summary?.account_tenure },
                        { label: 'Transaction Activity', value: overdraftResult.score_factors.factor_summary?.transaction_activity },
                        { label: 'Repayment History', value: overdraftResult.score_factors.factor_summary?.repayment_history },
                        { label: 'Credit Profile', value: overdraftResult.score_factors.factor_summary?.credit_profile },
                      ].map((f) => (
                        <div key={f.label} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{f.label}</span>
                          <span className={`font-medium capitalize ${
                            f.value === 'strong' || f.value === 'excellent' || f.value === 'high' || f.value === 'established'
                              ? 'text-[hsl(var(--bank-mint))]'
                              : f.value === 'weak' || f.value === 'limited' || f.value === 'low' || f.value === 'new'
                              ? 'text-[hsl(var(--bank-coral))]'
                              : 'text-[hsl(var(--bank-amber))]'
                          }`}>
                            {f.value || '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setOverdraftResult(null)}
                    className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground pt-1"
                  >
                    Check again
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
};

// Pre-Approved Offers for Banking App
function BankPreApprovedOffers({ score }: { score: number }) {
  const navigate = useNavigate();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['preapproved-offers-bank', score],
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
      const { data, error } = await supabase.functions.invoke('credit-ops', {
        body: { action: 'apply-preapproved', offer_id: offerId, requested_amount: amount }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Application submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['preapproved-offers-bank'] });
      setApplyingId(null);
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err, 'Failed to apply')),
  });

  if (isLoading || !offers.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6">
      <h3 className="mb-3 text-base font-bold text-foreground">Pre-Approved Loans</h3>
      <div className="flex flex-col gap-2">
        {offers.map((offer: any, i: number) => (
          <motion.div
            key={offer.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl bg-muted p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--bank-sky))]">
                <Building2 className="h-4 w-4 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{offer.product_name}</p>
                <p className="text-xs text-muted-foreground">{offer.institution_name || 'Financial Institution'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" />
                Up to {Number(offer.max_amount).toLocaleString()} {offer.currency}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" />
                {offer.interest_rate_annual}% p.a.
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {offer.requires_existing_account ? (
                <button
                  onClick={() => navigate('/banking/accounts')}
                  className="flex-1 rounded-xl bg-[hsl(var(--bank-sky))] py-2.5 text-xs font-bold text-white text-center active:scale-[0.98] transition-transform"
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
                  className="flex-1 rounded-xl bg-[hsl(var(--bank-violet))] py-2.5 text-xs font-bold text-white text-center active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  {applyMutation.isPending && applyingId === offer.id ? 'Applying...' : 'Apply Now'}
                </button>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Applying triggers a hard credit check
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default BankCreditScore;
