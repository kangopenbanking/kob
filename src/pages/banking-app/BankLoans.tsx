import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const BankLoans: React.FC = () => {
  const navigate = useNavigate();

  const loanProducts = [
    { name: 'Personal Loan', rate: '12% p.a.', max: 'XAF 5,000,000', color: 'bg-[hsl(var(--bank-coral))]', fg: 'text-white' },
    { name: 'Business Loan', rate: '10% p.a.', max: 'XAF 25,000,000', color: 'bg-[hsl(var(--bank-violet))]', fg: 'text-white' },
    { name: 'Salary Advance', rate: '8% p.a.', max: 'XAF 1,000,000', color: 'bg-[hsl(var(--bank-teal))]', fg: 'text-white' },
  ];

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back
      </button>

      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Loans</h1>
      <p className="mb-6 text-sm font-medium text-muted-foreground">Apply & manage your loans</p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-col items-center rounded-3xl bg-muted py-10 text-center"
      >
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-[hsl(var(--bank-coral))]/10">
          <Landmark className="h-10 w-10 text-[hsl(var(--bank-coral))]" strokeWidth={1.5} />
        </div>
        <p className="mb-1 text-lg font-bold text-foreground">No active loans</p>
        <p className="mb-5 text-sm text-muted-foreground">Apply for a personal or business loan</p>
        <Button className="gap-2 rounded-xl bg-[hsl(var(--bank-coral))] text-white px-6 hover:bg-[hsl(var(--bank-coral))]/90">
          Apply for a Loan
        </Button>
      </motion.div>

      <div>
        <h3 className="mb-3 text-base font-bold text-foreground">Loan Products</h3>
        <div className="flex flex-col gap-3">
          {loanProducts.map((loan, i) => (
            <motion.div
              key={loan.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center justify-between rounded-2xl ${loan.color} p-5`}
            >
              <div>
                <p className={`text-base font-bold ${loan.fg}`}>{loan.name}</p>
                <p className={`text-sm ${loan.fg} opacity-80`}>{loan.rate} · Up to {loan.max}</p>
              </div>
              <ArrowRight className={`h-5 w-5 ${loan.fg}`} strokeWidth={1.5} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BankLoans;
