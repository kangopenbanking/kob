import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, TrendingUp, CheckCircle2, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const rentHistory = [
  { month: 'February 2026', amount: 75000, status: 'reported', date: 'Feb 3' },
  { month: 'January 2026', amount: 75000, status: 'reported', date: 'Jan 5' },
  { month: 'December 2025', amount: 75000, status: 'reported', date: 'Dec 2' },
  { month: 'November 2025', amount: 75000, status: 'reported', date: 'Nov 4' },
];

const CustomerRentReporting: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Rent Reporting</h1>
      </div>

      {/* Impact Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-[hsl(210,80%,93%)] p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50">
            <TrendingUp className="h-6 w-6 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Credit Impact</p>
            <p className="text-[11px] text-muted-foreground">4 months of on-time payments</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-background/50 p-3">
          <span className="text-xs font-bold text-[hsl(150,60%,40%)]">+45 points</span>
          <span className="text-[10px] text-muted-foreground">estimated credit score impact</span>
        </div>
      </motion.div>

      {/* Landlord */}
      <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(45,70%,90%)]">
          <Home className="h-5 w-5 text-[hsl(45,60%,35%)]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">Ngoh Properties</p>
          <p className="text-[10px] text-muted-foreground">75,000 XAF/month · Douala</p>
        </div>
      </div>

      {/* History */}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Payment History</p>
      <div className="space-y-2">
        {rentHistory.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }} className="flex items-center gap-3 rounded-2xl bg-card p-3">
            <CheckCircle2 className="h-5 w-5 text-[hsl(150,60%,40%)]" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-xs font-bold text-foreground">{r.month}</p>
              <p className="text-[10px] text-muted-foreground">Paid {r.date}</p>
            </div>
            <p className="text-sm font-bold text-foreground">{r.amount.toLocaleString()}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CustomerRentReporting;
