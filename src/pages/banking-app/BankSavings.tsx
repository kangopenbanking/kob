import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PiggyBank, Target, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const BankSavings: React.FC = () => {
  const navigate = useNavigate();

  const savingsGoals = [
    { name: 'Emergency Fund', target: 500000, current: 320000, currency: 'XAF', color: 'bg-[hsl(var(--bank-mint))]', fg: 'text-[hsl(var(--bank-mint-fg))]' },
    { name: 'New Phone', target: 150000, current: 90000, currency: 'XAF', color: 'bg-[hsl(var(--bank-amber))]', fg: 'text-[hsl(var(--bank-amber-fg))]' },
  ];

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back
      </button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Savings</h1>
          <p className="text-sm font-medium text-muted-foreground">Goals & deposits</p>
        </div>
        <Button size="sm" className="gap-1.5 rounded-xl bg-[hsl(var(--bank-mint))] text-[hsl(var(--bank-mint-fg))] hover:bg-[hsl(var(--bank-mint))]/90">
          <Plus className="h-4 w-4" strokeWidth={2} />
          New Goal
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-3xl bg-foreground p-6"
      >
        <span className="text-sm font-medium text-background/60">Total Savings</span>
        <p className="mt-2 text-3xl font-bold tracking-tight text-background">
          XAF {(410000).toLocaleString()}
        </p>
        <p className="mt-1 text-sm font-medium text-[hsl(var(--bank-mint))]">+XAF 12,500 this month</p>
      </motion.div>

      <div className="flex flex-col gap-4">
        {savingsGoals.map((goal, i) => {
          const progress = (goal.current / goal.target) * 100;
          return (
            <motion.div
              key={goal.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl ${goal.color} p-5`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className={`h-5 w-5 ${goal.fg}`} strokeWidth={1.5} />
                  <p className={`text-base font-bold ${goal.fg}`}>{goal.name}</p>
                </div>
                <span className={`text-sm font-bold ${goal.fg}`}>{Math.round(progress)}%</span>
              </div>
              <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white/80" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className={`${goal.fg} opacity-80`}>{goal.currency} {goal.current.toLocaleString()}</span>
                <span className={`${goal.fg} opacity-80`}>{goal.currency} {goal.target.toLocaleString()}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default BankSavings;
