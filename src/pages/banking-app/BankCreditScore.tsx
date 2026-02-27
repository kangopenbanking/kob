import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, Shield, Clock, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCreditScore } from '@/hooks/useBankingData';

function getScoreLabel(score: number): string {
  if (score >= 800) return 'Excellent';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
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
  const { data: creditData, isLoading } = useCreditScore();

  const score = creditData?.score || 0;
  const maxScore = 850;
  const percentage = score > 0 ? (score / maxScore) * 100 : 0;
  const scoreRange = creditData?.score_range || (score > 0 ? getScoreLabel(score) : '—');
  const scoreBand = creditData?.score_band;

  // Use event-sourced factors if available, otherwise legacy
  const apiFactors = creditData?.score_factors;
  const isEventSourced = creditData?.source === 'event_sourced';

  // Event-sourced factors from credit-score-engine
  const eventFactors = isEventSourced && Array.isArray(apiFactors) ? apiFactors : null;

  // Legacy factors
  const legacyFactors = !isEventSourced && apiFactors ? [
    { icon: TrendingUp, label: 'Payment History', value: apiFactors.payment_history || '—', color: 'bg-[hsl(var(--bank-mint))]', fg: 'text-[hsl(var(--bank-mint-fg))]' },
    { icon: BarChart3, label: 'Credit Utilization', value: apiFactors.credit_utilization || '—', color: 'bg-[hsl(var(--bank-amber))]', fg: 'text-[hsl(var(--bank-amber-fg))]' },
    { icon: Shield, label: 'Account Age', value: apiFactors.account_age || '—', color: 'bg-[hsl(var(--bank-sky))]', fg: 'text-white' },
    { icon: Clock, label: 'Recent Inquiries', value: apiFactors.inquiries?.toString() || '—', color: 'bg-[hsl(var(--bank-violet))]', fg: 'text-white' },
  ] : null;

  const factors = legacyFactors || defaultFactors;
  const recentEvents = creditData?.recent_events || [];

  const factorColors = [
    { color: 'bg-[hsl(var(--bank-mint))]', fg: 'text-[hsl(var(--bank-mint-fg))]' },
    { color: 'bg-[hsl(var(--bank-amber))]', fg: 'text-[hsl(var(--bank-amber-fg))]' },
    { color: 'bg-[hsl(var(--bank-sky))]', fg: 'text-white' },
    { color: 'bg-[hsl(var(--bank-violet))]', fg: 'text-white' },
    { color: 'bg-[hsl(var(--bank-coral))]', fg: 'text-white' },
  ];

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back
      </button>

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
                      {event.source === 'loans_service' ? 'Loan' : event.source === 'savings_service' ? 'Savings' : 'System'}
                    </span>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default BankCreditScore;
