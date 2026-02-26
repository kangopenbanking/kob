import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLoanApplications, useLoanProducts, useApplyForLoan } from '@/hooks/useBankingData';

const loanColorMap: Record<string, { color: string; fg: string }> = {
  personal_loan: { color: 'bg-[hsl(var(--bank-coral))]', fg: 'text-white' },
  business_loan: { color: 'bg-[hsl(var(--bank-violet))]', fg: 'text-white' },
  salary_advance: { color: 'bg-[hsl(var(--bank-teal))]', fg: 'text-white' },
};

const BankLoans: React.FC = () => {
  const navigate = useNavigate();
  const { data: loanApps, isLoading: appsLoading } = useLoanApplications();
  const { data: loanProducts, isLoading: productsLoading } = useLoanProducts();
  const applyLoan = useApplyForLoan();
  
  const [showApply, setShowApply] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [applyAmount, setApplyAmount] = useState('');
  const [applyTenure, setApplyTenure] = useState('12');
  const [applyPurpose, setApplyPurpose] = useState('');

  const activeLoans = (loanApps || []).filter(l => ['approved', 'disbursed', 'active'].includes(l.status));

  const handleApply = () => {
    if (!selectedProduct || !applyAmount || !applyPurpose) return;
    applyLoan.mutate({
      loan_product_id: selectedProduct.id,
      requested_amount: Number(applyAmount),
      tenure_months: Number(applyTenure),
      purpose: applyPurpose,
      submit: true,
    }, {
      onSuccess: () => {
        setShowApply(false);
        setApplyAmount('');
        setApplyPurpose('');
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back
      </button>

      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Loans</h1>
      <p className="mb-6 text-sm font-medium text-muted-foreground">Apply & manage your loans</p>

      {/* Active Loans */}
      {appsLoading ? (
        <div className="mb-6 flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activeLoans.length === 0 ? (
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
        </motion.div>
      ) : (
        <div className="mb-6 flex flex-col gap-3">
          {activeLoans.map((loan) => (
            <div key={loan.id} className="rounded-2xl bg-foreground p-5 text-background">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium opacity-60">{loan.loan_product?.product_name || 'Loan'}</p>
                  <p className="text-xl font-bold">XAF {loan.requested_amount.toLocaleString()}</p>
                </div>
                <span className={`self-start rounded-lg px-2 py-1 text-xs font-bold ${
                  loan.status === 'approved' ? 'bg-[hsl(var(--bank-mint))]/20 text-[hsl(var(--bank-mint))]'
                  : loan.status === 'submitted' ? 'bg-[hsl(var(--bank-amber))]/20 text-[hsl(var(--bank-amber))]'
                  : 'bg-white/10 text-white/70'
                }`}>{loan.status}</span>
              </div>
              <div className="mt-2 flex gap-4 text-xs opacity-70">
                <span>{loan.tenure_months} months</span>
                <span>{loan.repayment_frequency}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Applications */}
      {(loanApps || []).length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">All Applications</h3>
          {(loanApps || []).map((app) => (
            <div key={app.id} className="flex items-center justify-between rounded-xl px-1 py-2.5">
              <div>
                <p className="text-sm font-semibold text-foreground">{app.application_number}</p>
                <p className="text-xs text-muted-foreground">XAF {app.requested_amount.toLocaleString()} · {app.status}</p>
              </div>
              <span className={`rounded-lg px-2 py-1 text-xs font-bold ${
                app.status === 'approved' ? 'bg-[hsl(var(--bank-mint))]/15 text-[hsl(var(--bank-teal))]'
                : app.status === 'rejected' ? 'bg-[hsl(var(--bank-coral))]/15 text-[hsl(var(--bank-coral))]'
                : 'bg-muted text-muted-foreground'
              }`}>{app.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Loan Products */}
      <div>
        <h3 className="mb-3 text-base font-bold text-foreground">Loan Products</h3>
        {productsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(loanProducts || []).map((loan, i) => {
              const colors = loanColorMap[loan.loan_type] || { color: 'bg-[hsl(var(--bank-coral))]', fg: 'text-white' };
              return (
                <motion.button
                  key={loan.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => { setSelectedProduct(loan); setShowApply(true); }}
                  className={`flex items-center justify-between rounded-2xl ${colors.color} p-5`}
                >
                  <div className="text-left">
                    <p className={`text-base font-bold ${colors.fg}`}>{loan.product_name}</p>
                    <p className={`text-sm ${colors.fg} opacity-80`}>
                      {loan.interest_rate}% p.a. · Up to XAF {loan.max_amount.toLocaleString()}
                    </p>
                  </div>
                  <ArrowRight className={`h-5 w-5 ${colors.fg}`} strokeWidth={1.5} />
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Apply Dialog */}
      <Dialog open={showApply} onOpenChange={setShowApply}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for {selectedProduct?.product_name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <Label className="text-sm">Amount (XAF)</Label>
              <Input type="number" placeholder={`${selectedProduct?.min_amount || 0} - ${selectedProduct?.max_amount || 0}`} value={applyAmount} onChange={e => setApplyAmount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Tenure (months)</Label>
              <Input type="number" value={applyTenure} onChange={e => setApplyTenure(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Purpose</Label>
              <Input placeholder="e.g. Business expansion" value={applyPurpose} onChange={e => setApplyPurpose(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={handleApply} disabled={applyLoan.isPending || !applyAmount || !applyPurpose}>
              {applyLoan.isPending ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankLoans;
