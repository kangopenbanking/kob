import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

const BankCreditScore: React.FC = () => {
  const navigate = useNavigate();
  const score = 720;
  const maxScore = 850;
  const percentage = (score / maxScore) * 100;

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Credit Score</h1>
      <p className="mb-6 text-sm text-muted-foreground">Your CrediQ rating</p>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-6 flex flex-col items-center rounded-2xl border bg-card p-8"
      >
        <div className="relative mb-4 flex h-32 w-32 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              strokeDasharray={`${percentage}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-bold text-foreground">{score}</span>
            <span className="text-xs text-muted-foreground">/ {maxScore}</span>
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Good
        </span>
      </motion.div>

      <div className="flex flex-col gap-3">
        {[
          { icon: TrendingUp, label: 'Payment History', value: 'Excellent', color: 'text-primary' },
          { icon: BarChart3, label: 'Credit Utilization', value: '23%', color: 'text-primary' },
          { icon: Shield, label: 'Account Age', value: '2 years', color: 'text-foreground' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between rounded-xl border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-sm text-foreground">{item.label}</span>
              </div>
              <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default BankCreditScore;