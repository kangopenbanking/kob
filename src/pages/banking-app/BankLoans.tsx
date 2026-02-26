import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const BankLoans: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Loans</h1>
      <p className="mb-6 text-sm text-muted-foreground">Apply & manage your loans</p>

      <div className="flex flex-col items-center py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Landmark className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <p className="mb-2 text-sm font-medium text-foreground">No active loans</p>
        <p className="mb-6 text-xs text-muted-foreground">Apply for a personal or business loan</p>
        <Button className="gap-2">
          Apply for a Loan
        </Button>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Loan Products</h3>
        <div className="flex flex-col gap-2">
          {[
            { name: 'Personal Loan', rate: '12% p.a.', max: 'XAF 5,000,000' },
            { name: 'Business Loan', rate: '10% p.a.', max: 'XAF 25,000,000' },
            { name: 'Salary Advance', rate: '8% p.a.', max: 'XAF 1,000,000' },
          ].map((loan, i) => (
            <motion.div
              key={loan.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between rounded-xl border bg-card p-3.5"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{loan.name}</p>
                <p className="text-xs text-muted-foreground">{loan.rate} · Up to {loan.max}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BankLoans;