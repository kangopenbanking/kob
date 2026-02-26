import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PiggyBank, Target, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const BankSavings: React.FC = () => {
  const navigate = useNavigate();

  const savingsGoals = [
    { name: 'Emergency Fund', target: 500000, current: 320000, currency: 'XAF' },
    { name: 'New Phone', target: 150000, current: 90000, currency: 'XAF' },
  ];

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Savings</h1>
          <p className="text-sm text-muted-foreground">Goals & deposits</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Target className="h-4 w-4" strokeWidth={1.5} />
          New Goal
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-2xl bg-primary p-5"
      >
        <span className="text-sm text-primary-foreground/70">Total Savings</span>
        <p className="mt-1 text-2xl font-bold tracking-tight text-primary-foreground">
          XAF {(410000).toLocaleString()}
        </p>
      </motion.div>

      <div className="flex flex-col gap-3">
        {savingsGoals.map((goal, i) => {
          const progress = (goal.current / goal.target) * 100;
          return (
            <motion.div
              key={goal.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border bg-card p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{goal.name}</p>
                <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{goal.currency} {goal.current.toLocaleString()}</span>
                <span>{goal.currency} {goal.target.toLocaleString()}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default BankSavings;