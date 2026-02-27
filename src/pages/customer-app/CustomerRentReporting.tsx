import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Home, TrendingUp, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerTransactions, useCustomerCreditScore } from '@/hooks/useCustomerData';
import { format } from 'date-fns';

const CustomerRentReporting: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();

  // Fetch rent-type transactions
  const { data: allTxns = [], isLoading } = useCustomerTransactions(user?.id, institutionId, 50);
  const { data: creditScore } = useCustomerCreditScore(user?.id);

  // Filter rent payments from transactions
  const rentPayments = allTxns.filter((tx: any) =>
    tx.transaction_type === 'rent_payment' ||
    (tx.transaction_information || '').toLowerCase().includes('rent')
  );

  const totalMonths = rentPayments.length;
  const scoreImpact = creditScore?.score ?? 0;

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Rent Reporting</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Impact Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-[hsl(210,80%,93%)] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50">
                <TrendingUp className="h-6 w-6 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Credit Impact</p>
                <p className="text-[11px] text-muted-foreground">
                  {totalMonths > 0 ? `${totalMonths} rent payment${totalMonths > 1 ? 's' : ''} reported` : 'No rent payments reported yet'}
                </p>
              </div>
            </div>
            {totalMonths > 0 && scoreImpact > 0 && (
              <div className="flex items-center gap-2 rounded-2xl bg-background/50 p-3">
                <span className="text-xs font-bold text-[hsl(150,60%,40%)]">Score: {scoreImpact}</span>
                <span className="text-[10px] text-muted-foreground">current credit score</span>
              </div>
            )}
          </motion.div>

          {/* History */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Payment History</p>
          {rentPayments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Home className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
              <p className="text-sm font-semibold text-muted-foreground">No rent payments yet</p>
              <p className="text-xs text-muted-foreground text-center">Report your rent payments to build credit</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rentPayments.map((r: any, i: number) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(150,60%,40%)]" strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">{r.transaction_information || 'Rent Payment'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.booking_datetime ? format(new Date(r.booking_datetime), 'MMM d, yyyy') : ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-foreground">{Math.abs(r.amount || 0).toLocaleString()}</p>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerRentReporting;
