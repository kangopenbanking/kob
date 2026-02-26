import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, Shield, Clock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCreditScore } from '@/hooks/useBankingData';

function getScoreLabel(score: number): string {
  if (score >= 800) return 'Excellent';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
}

function getScoreColor(score: number): string {
  if (score >= 740) return 'bg-[hsl(var(--bank-mint))]';
  if (score >= 670) return 'bg-[hsl(var(--bank-teal))]';
  if (score >= 580) return 'bg-[hsl(var(--bank-amber))]';
  return 'bg-[hsl(var(--bank-coral))]';
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

  // Map score_factors from API to display
  const apiFactors = creditData?.score_factors;
  const factors = apiFactors ? [
    { icon: TrendingUp, label: 'Payment History', value: apiFactors.payment_history || '—', color: 'bg-[hsl(var(--bank-mint))]', fg: 'text-[hsl(var(--bank-mint-fg))]' },
    { icon: BarChart3, label: 'Credit Utilization', value: apiFactors.credit_utilization || '—', color: 'bg-[hsl(var(--bank-amber))]', fg: 'text-[hsl(var(--bank-amber-fg))]' },
    { icon: Shield, label: 'Account Age', value: apiFactors.account_age || '—', color: 'bg-[hsl(var(--bank-sky))]', fg: 'text-white' },
    { icon: Clock, label: 'Recent Inquiries', value: apiFactors.inquiries?.toString() || '—', color: 'bg-[hsl(var(--bank-violet))]', fg: 'text-white' },
  ] : defaultFactors;

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back
      </button>

      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Credit Score</h1>
      <p className="mb-6 text-sm font-medium text-muted-foreground">Your CrediQ rating</p>

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

          <h3 className="mb-3 text-base font-bold text-foreground">Score Factors</h3>
          <div className="grid grid-cols-2 gap-3">
            {factors.map((item, i) => {
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
    </div>
  );
};

export default BankCreditScore;
