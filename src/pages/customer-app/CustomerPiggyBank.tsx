import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PiggyBank, Plus, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const goals = [
  { name: 'New Laptop', target: 450000, saved: 280000, color: 'bg-[hsl(210,80%,93%)]', barColor: 'bg-[hsl(210,60%,45%)]' },
  { name: 'Emergency Fund', target: 500000, saved: 375000, color: 'bg-[hsl(150,40%,90%)]', barColor: 'bg-[hsl(150,40%,35%)]' },
  { name: 'Holiday Trip', target: 300000, saved: 45000, color: 'bg-[hsl(340,60%,92%)]', barColor: 'bg-[hsl(340,50%,40%)]' },
];

const CustomerPiggyBank: React.FC = () => {
  const navigate = useNavigate();
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Piggy Bank</h1>
      </div>

      {/* Total Savings Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-3xl bg-[hsl(340,60%,92%)] p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/50">
          <PiggyBank className="h-7 w-7 text-[hsl(340,50%,40%)]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Saved</p>
          <p className="text-2xl font-bold text-foreground">{totalSaved.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">XAF</span></p>
        </div>
      </motion.div>

      {/* Goals */}
      <div className="space-y-3">
        {goals.map((goal, i) => {
          const pct = Math.round((goal.saved / goal.target) * 100);
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} className={`rounded-3xl ${goal.color} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-foreground">{goal.name}</p>
                <span className="text-xs font-bold text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-background/50 overflow-hidden">
                <div className={`h-full rounded-full ${goal.barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex justify-between">
                <p className="text-[10px] text-muted-foreground">{goal.saved.toLocaleString()} saved</p>
                <p className="text-[10px] text-muted-foreground">of {goal.target.toLocaleString()}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Button variant="outline" className="w-full rounded-2xl h-12">
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Create New Goal
      </Button>
    </div>
  );
};

export default CustomerPiggyBank;
