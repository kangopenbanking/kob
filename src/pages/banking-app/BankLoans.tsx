import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Landmark, ArrowRight, Loader2, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLoanApplications, useLoanProducts, useApplyForLoan, useLoanRepayment } from '@/hooks/useBankingData';
import { toast } from 'sonner';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

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
  const repayLoan = useLoanRepayment();
  
  const [showApply, setShowApply] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [applyAmount, setApplyAmount] = useState('');
  const [applyTenure, setApplyTenure] = useState('12');
  const [applyPurpose, setApplyPurpose] = useState('');

  // Repayment state
  const [showRepay, setShowRepay] = useState(false);
  const [repayLoanId, setRepayLoanId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('bank_transfer');
  const [showPin, setShowPin] = useState(false);

  const activeLoans = (loanApps || []).filter((l: any) => ['approved', 'disbursed', 'active'].includes(l.status));

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

  const handleRepay = () => {
    if (!repayLoanId || !repayAmount) return;
    setShowPin(true);
  };

  const executeRepay = () => {
    if (!repayLoanId || !repayAmount) return;
    repayLoan.mutate({
      loan_account_id: repayLoanId,
      amount: Number(repayAmount),
      payment_method: repayMethod,
    }, {
      onSuccess: (data: any) => {
        const creditDelta = data?.data?.credit_score?.delta;
        const creditMsg = creditDelta ? ` Credit score ${creditDelta > 0 ? '+' : ''}${creditDelta}` : '';
        toast.success(`Repayment of ${Number(repayAmount).toLocaleString()} XAF processed successfully.${creditMsg}`);
        setShowRepay(false);
        setRepayAmount('');
      },
      onError: (err: any) => {
        toast.error(extractEdgeFunctionError(err, 'Repayment could not be processed. Please ensure you have sufficient funds.'));
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
          {activeLoans.map((loan: any) => (
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
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-4 text-xs opacity-70">
                  <span>{loan.tenure_months} months</span>
                  <span>{loan.repayment_frequency}</span>
                </div>
                {['disbursed', 'active'].includes(loan.status) && (
                  <button
                    onClick={() => { setRepayLoanId(loan.id); setShowRepay(true); }}
                    className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    <CreditCard className="h-3.5 w-3.5" strokeWidth={2} />
                    Pay
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeLoans.length > 0 && (
        <button
          onClick={() => navigate('/app/banking/more/loans/promise')}
          className="mb-6 w-full rounded-2xl border border-primary/40 p-4 text-left transition-colors hover:border-primary"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Promise to Pay</p>
              <p className="text-xs text-muted-foreground">Set a date you'll pay — keep it to protect your credit</p>
            </div>
            <ArrowRight className="h-5 w-5 text-primary" />
          </div>
        </button>
      )}

      {/* All Applications */}
      {(loanApps || []).length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">All Applications</h3>
          {(loanApps || []).map((app: any) => (
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
            {(loanProducts || []).map((loan: any, i: number) => {
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

      {/* Repayment Dialog */}
      <Dialog open={showRepay} onOpenChange={setShowRepay}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Loan Payment</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <Label className="text-sm">Amount (XAF)</Label>
              <Input type="number" placeholder="Enter amount" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} className="mt-1 text-center text-xl font-bold h-14" />
            </div>
            <div>
              <Label className="text-sm">Payment Method</Label>
              <Select value={repayMethod} onValueChange={setRepayMethod}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="card">Card Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleRepay} disabled={repayLoan.isPending || !repayAmount}>
              {repayLoan.isPending ? 'Processing...' : 'Make Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={executeRepay} />
    </div>
  );
};

export default BankLoans;
