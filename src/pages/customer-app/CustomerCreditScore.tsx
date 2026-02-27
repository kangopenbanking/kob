import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, Shield, Clock, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';

const factors = [
  { name: 'Payment History', score: 92, icon: Clock, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]' },
  { name: 'Credit Utilization', score: 78, icon: CreditCard, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  { name: 'Account Age', score: 65, icon: Shield, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
];

const tips = [
  'Pay bills on time to improve your score',
  'Keep credit utilization below 30%',
  'Maintain long-standing accounts',
  'Report rent payments monthly',
];

const CustomerCreditScore: React.FC = () => {
  const navigate = useNavigate();
  const score = 720;
  const maxScore = 850;
  const pct = (score / maxScore) * 100;

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Credit Score</h1>
      </div>

      {/* Score Gauge */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 rounded-3xl bg-[hsl(150,40%,90%)] p-8">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(150,30%,80%)" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(150,40%,35%)" strokeWidth="8"
              strokeDasharray={`${pct * 2.64} 264`} strokeLinecap="round" />
          </svg>
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">{score}</p>
            <p className="text-[10px] font-semibold text-muted-foreground">of {maxScore}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-[hsl(150,40%,35%)]" strokeWidth={2} />
          <p className="text-xs font-bold text-[hsl(150,40%,25%)]">Good Standing</p>
        </div>
      </motion.div>

      {/* Factors */}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Score Factors</p>
      <div className="space-y-2">
        {factors.map((f, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-2xl ${f.color} p-3.5`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/50">
              <f.icon className={`h-4.5 w-4.5 ${f.iconColor}`} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-foreground">{f.name}</p>
              <div className="mt-1 h-1.5 rounded-full bg-background/50 overflow-hidden">
                <div className="h-full rounded-full bg-foreground/60" style={{ width: `${f.score}%` }} />
              </div>
            </div>
            <span className="text-xs font-bold text-foreground">{f.score}%</span>
          </div>
        ))}
      </div>

      {/* Tips */}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Tips to Improve</p>
      <div className="space-y-2">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-2 rounded-2xl bg-card p-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(150,40%,90%)] text-[10px] font-bold text-[hsl(150,40%,35%)]">{i + 1}</span>
            <p className="text-xs text-foreground">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerCreditScore;
