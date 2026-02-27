import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PiggyBank, Target, Plus, Loader2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSavingsAccounts, useSavingsDeposit, useSavingsWithdraw } from '@/hooks/useBankingData';
import { toast } from 'sonner';

const savingsColors = [
  { color: 'bg-[hsl(var(--bank-mint))]', fg: 'text-[hsl(var(--bank-mint-fg))]' },
  { color: 'bg-[hsl(var(--bank-amber))]', fg: 'text-[hsl(var(--bank-amber-fg))]' },
  { color: 'bg-[hsl(var(--bank-sky))]', fg: 'text-white' },
  { color: 'bg-[hsl(var(--bank-violet))]', fg: 'text-white' },
];

const BankSavings: React.FC = () => {
  const navigate = useNavigate();
  const { data: savingsAccounts, isLoading } = useSavingsAccounts();
  const deposit = useSavingsDeposit();
  const withdraw = useSavingsWithdraw();
  const [actionAccountId, setActionAccountId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');

  const totalSavings = (savingsAccounts || []).reduce((s, a) => s + (a.current_balance || 0), 0);

  const handleAction = () => {
    if (!actionAccountId || !amount) return;
    const mutation = actionType === 'deposit' ? deposit : withdraw;
    mutation.mutate({ savings_account_id: actionAccountId, amount: Number(amount) }, {
      onSuccess: (data: any) => {
        const creditDelta = data?.credit_score?.delta;
        if (creditDelta && creditDelta > 0) {
          toast.success(`Credit score +${creditDelta}`, { description: 'Your savings behavior improved your score!' });
        }
        setActionAccountId(null);
        setAmount('');
      },
    });
  };

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
        <Button
          size="sm"
          className="gap-1.5 rounded-xl bg-[hsl(var(--bank-mint))] text-[hsl(var(--bank-mint-fg))] hover:bg-[hsl(var(--bank-mint))]/90"
          onClick={() => navigate('new')}
        >
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
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-background/40" />
          ) : (
            `XAF ${totalSavings.toLocaleString()}`
          )}
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (savingsAccounts || []).length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <PiggyBank className="mb-3 h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-lg font-bold text-foreground">No savings goals yet</p>
          <p className="text-sm text-muted-foreground">Create your first savings goal to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(savingsAccounts || []).map((goal, i) => {
            const progress = goal.target_amount ? (goal.current_balance / goal.target_amount) * 100 : 0;
            const colors = savingsColors[i % savingsColors.length];
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl ${colors.color} p-5`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className={`h-5 w-5 ${colors.fg}`} strokeWidth={1.5} />
                    <p className={`text-base font-bold ${colors.fg}`}>{goal.account_name || 'Savings'}</p>
                  </div>
                  {goal.target_amount && (
                    <span className={`text-sm font-bold ${colors.fg}`}>{Math.round(progress)}%</span>
                  )}
                </div>
                {goal.target_amount && (
                  <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-white/30">
                    <div className="h-full rounded-full bg-white/80" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                )}
                <div className="mb-3 flex justify-between text-sm font-semibold">
                  <span className={`${colors.fg} opacity-80`}>XAF {goal.current_balance.toLocaleString()}</span>
                  {goal.target_amount && (
                    <span className={`${colors.fg} opacity-80`}>XAF {goal.target_amount.toLocaleString()}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Dialog open={actionAccountId === goal.id && actionType === 'deposit'} onOpenChange={(o) => !o && setActionAccountId(null)}>
                    <DialogTrigger asChild>
                      <button
                        onClick={() => { setActionAccountId(goal.id); setActionType('deposit'); }}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/30 py-2 text-xs font-bold"
                      >
                        <ArrowUpCircle className={`h-4 w-4 ${colors.fg}`} strokeWidth={1.5} />
                        <span className={colors.fg}>Deposit</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Deposit to {goal.account_name}</DialogTitle></DialogHeader>
                      <div className="flex flex-col gap-4 pt-2">
                        <Input type="number" placeholder="Amount (XAF)" value={amount} onChange={e => setAmount(e.target.value)} className="text-center text-xl font-bold h-14" />
                        <Button onClick={handleAction} disabled={deposit.isPending || !amount}>
                          {deposit.isPending ? 'Processing...' : 'Deposit'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={actionAccountId === goal.id && actionType === 'withdraw'} onOpenChange={(o) => !o && setActionAccountId(null)}>
                    <DialogTrigger asChild>
                      <button
                        onClick={() => { setActionAccountId(goal.id); setActionType('withdraw'); }}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/30 py-2 text-xs font-bold"
                      >
                        <ArrowDownCircle className={`h-4 w-4 ${colors.fg}`} strokeWidth={1.5} />
                        <span className={colors.fg}>Withdraw</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Withdraw from {goal.account_name}</DialogTitle></DialogHeader>
                      <div className="flex flex-col gap-4 pt-2">
                        <Input type="number" placeholder="Amount (XAF)" value={amount} onChange={e => setAmount(e.target.value)} className="text-center text-xl font-bold h-14" />
                        <Button onClick={handleAction} disabled={withdraw.isPending || !amount}>
                          {withdraw.isPending ? 'Processing...' : 'Withdraw'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BankSavings;
