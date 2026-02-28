import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Smartphone, Wallet, CreditCard, CheckCircle2, Loader2, AlertCircle, Banknote, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useAccountBalances } from '@/hooks/useCustomerData';

const KANG_PLATFORM_ID = 'f493095b-037a-40cf-82bc-3a3ab74550dd';

const iconMap: Record<string, { icon: React.ElementType; color: string; iconColor: string }> = {
  bank_account: { icon: Building2, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  momo_mtn: { icon: Smartphone, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  momo_orange: { icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  paypal: { icon: Wallet, color: 'bg-[hsl(210,70%,90%)]', iconColor: 'text-[hsl(210,70%,50%)]' },
  bank_card: { icon: CreditCard, color: 'bg-[hsl(270,50%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
};

const quickAmounts = [5000, 10000, 25000, 50000, 100000];

const CustomerCashOut: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [step, setStep] = useState<'dest' | 'amount' | 'confirm' | 'success'>('dest');
  const [processing, setProcessing] = useState(false);

  // Get user's Kang accounts for balance check
  const { data: kangAccounts = [] } = useCustomerAccounts(user?.id);
  const accountIds = kangAccounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);
  const primaryAccount = kangAccounts[0] as any;
  const primaryBalance = primaryAccount ? balances.find((b: any) => b.account_id === primaryAccount.id) : null;
  const walletBalance = (primaryBalance?.amount as number) ?? 0;

  // Fetch linked accounts
  const { data: linkedAccounts = [], isLoading: acctLoading } = useQuery({
    queryKey: ['customer-linked-accounts', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customer_linked_accounts')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch withdrawal fee structure from admin
  const { data: feeStructure } = useQuery({
    queryKey: ['withdrawal-fee', KANG_PLATFORM_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_structures')
        .select('*')
        .eq('institution_id', KANG_PLATFORM_ID)
        .eq('transaction_type', 'withdrawal')
        .eq('is_active', true)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const calculateFee = (amt: number): number => {
    if (!feeStructure || amt <= 0) return 0;
    const fs = feeStructure as any;
    let fee = 0;
    if (fs.fee_model === 'fixed') {
      fee = fs.fixed_amount || 0;
    } else if (fs.fee_model === 'percentage') {
      fee = (amt * (fs.percentage_rate || 0)) / 100;
    } else if (fs.fee_model === 'hybrid') {
      fee = (fs.fixed_amount || 0) + (amt * (fs.percentage_rate || 0)) / 100;
    }
    if (fs.min_fee_amount && fee < fs.min_fee_amount) fee = fs.min_fee_amount;
    if (fs.max_fee_amount && fee > fs.max_fee_amount) fee = fs.max_fee_amount;
    return Math.round(fee);
  };

  const numAmount = Number(amount) || 0;
  const fee = calculateFee(numAmount);
  const netAmount = Math.max(numAmount - fee, 0);
  const isOverBalance = numAmount > walletBalance;

  const getIcon = (type: string) => iconMap[type] || iconMap.bank_account;

  const handleConfirm = () => {
    if (!amount || numAmount <= 0) { toast.error('Enter a valid amount'); return; }
    if (numAmount <= fee) { toast.error('Amount must be greater than the fee'); return; }
    if (isOverBalance) { toast.error('Insufficient wallet balance'); return; }
    setStep('confirm');
  };

  const handleWithdraw = async () => {
    setProcessing(true);
    try {
      // 1. Create withdrawal transaction
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: user!.id,
        institution_id: KANG_PLATFORM_ID,
        account_id: primaryAccount?.id || null,
        transaction_type: 'withdrawal',
        amount: numAmount,
        currency: 'XAF',
        status: 'completed',
        credit_debit_indicator: 'Debit',
        transaction_information: `Withdrawal to ${selectedAccount?.provider_name || selectedAccount?.account_type} ···${selectedAccount?.last4 || ''}`,
        booking_datetime: new Date().toISOString(),
        value_datetime: new Date().toISOString(),
        metadata: {
          destination_linked_account_id: selectedAccount?.id,
          destination_type: selectedAccount?.account_type,
          destination_provider: selectedAccount?.provider_name,
          fee_amount: fee,
          net_amount: netAmount,
        },
      });
      if (txError) throw txError;

      // 2. Deduct from wallet balance
      if (primaryAccount?.id && primaryBalance) {
        const newAmount = Math.max(walletBalance - numAmount, 0);
        await supabase.from('account_balances')
          .update({ amount: newAmount, balance_datetime: new Date().toISOString() })
          .eq('id', (primaryBalance as any).id);
      }

      // 3. Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['customer-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-balances'] });
      queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });

      setStep('success');
      toast.success(`XAF ${netAmount.toLocaleString()} withdrawal initiated`);
      setTimeout(() => navigate(-1), 2500);
    } catch (err: any) {
      toast.error(err.message || 'Withdrawal failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const goBack = () => {
    if (step === 'amount') { setStep('dest'); setSelectedAccount(null); }
    else if (step === 'confirm') setStep('amount');
    else navigate(-1);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={goBack}>
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Cash Out</h1>
      </div>

      <AnimatePresence mode="wait">
        {step === 'success' ? (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
              <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-bold text-foreground">Withdrawal Initiated!</p>
            <p className="text-sm text-muted-foreground">XAF {netAmount.toLocaleString()} to {selectedAccount?.account_name}</p>
            <p className="text-xs text-muted-foreground">Fee: XAF {fee.toLocaleString()}</p>
          </motion.div>
        ) : step === 'dest' ? (
          <motion.div key="dest" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {/* Fee notice */}
            <div className="flex items-start gap-3 rounded-2xl bg-[hsl(45,70%,90%)] p-4">
              <AlertCircle className="h-5 w-5 text-[hsl(45,60%,35%)] mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-bold text-foreground">Withdrawal Fee Applies</p>
                <p className="text-[11px] text-muted-foreground">
                  {feeStructure ? (
                    (feeStructure as any).fee_model === 'percentage'
                      ? `${(feeStructure as any).percentage_rate}% fee (min XAF ${((feeStructure as any).min_fee_amount || 0).toLocaleString()}, max XAF ${((feeStructure as any).max_fee_amount || 0).toLocaleString()})`
                      : (feeStructure as any).fee_model === 'fixed'
                        ? `Flat fee of XAF ${((feeStructure as any).fixed_amount || 0).toLocaleString()}`
                        : 'Fee applies per admin schedule'
                  ) : 'Fee schedule loading...'}
                </p>
              </div>
            </div>

            {/* Wallet balance */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Wallet Balance</p>
              <p className="text-xl font-bold text-foreground mt-1">XAF {walletBalance.toLocaleString()}</p>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Withdraw To</p>

            {acctLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : linkedAccounts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Banknote className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-foreground">No linked accounts</p>
                <p className="text-xs text-muted-foreground text-center">Link an account first to withdraw funds.</p>
                <Button onClick={() => navigate('/app/linked-accounts')} className="rounded-2xl mt-2">
                  <Plus className="h-4 w-4 mr-1" /> Link Account
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {linkedAccounts.map((acc: any) => {
                  const { icon: Icon, color, iconColor } = getIcon(acc.account_type);
                  return (
                    <button key={acc.id} onClick={() => { setSelectedAccount(acc); setStep('amount'); }}
                      className="flex w-full items-center gap-3 rounded-3xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary active:scale-[0.98]">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">{acc.account_name || acc.account_type}</p>
                        <p className="text-[11px] text-muted-foreground">{acc.provider_name} {acc.last4 ? `•••• ${acc.last4}` : ''}</p>
                      </div>
                      <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" strokeWidth={1.5} />
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : step === 'amount' ? (
          <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-5">
            {/* Destination display */}
            {selectedAccount && (() => {
              const { icon: Icon, color, iconColor } = getIcon(selectedAccount.account_type);
              return (
                <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">To: {selectedAccount.account_name}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedAccount.provider_name} {selectedAccount.last4 ? `•••• ${selectedAccount.last4}` : ''}</p>
                  </div>
                </div>
              );
            })()}

            {/* Amount Input */}
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-[hsl(25,60%,35%)] p-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60">Withdrawal Amount</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-[hsl(0,0%,100%)]/60">XAF</span>
                <input type="text" inputMode="numeric" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0" className="bg-transparent text-4xl font-bold text-[hsl(0,0%,100%)] outline-none w-full text-center placeholder:text-[hsl(0,0%,100%)]/30" />
              </div>
              <p className={`text-xs ${isOverBalance ? 'text-[hsl(0,70%,75%)]' : 'text-[hsl(0,0%,100%)]/40'}`}>
                {isOverBalance ? 'Insufficient balance' : `Available: XAF ${walletBalance.toLocaleString()}`}
              </p>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2 flex-wrap">
              {quickAmounts.map(a => (
                <button key={a} onClick={() => setAmount(String(a))}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${amount === String(a) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {a.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Live fee calculation */}
            {numAmount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl bg-card border border-border p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold text-foreground">XAF {numAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-semibold text-destructive">- XAF {fee.toLocaleString()}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="font-bold text-foreground">You receive</span>
                  <span className="font-extrabold text-foreground">XAF {netAmount.toLocaleString()}</span>
                </div>
              </motion.div>
            )}

            <Button onClick={handleConfirm} disabled={!amount || numAmount <= 0 || numAmount <= fee || isOverBalance} className="w-full rounded-2xl h-12 text-sm font-bold">
              Continue
            </Button>
          </motion.div>
        ) : (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-5">
            <p className="text-center text-sm font-semibold text-muted-foreground">Confirm Withdrawal</p>

            <div className="rounded-3xl bg-card border-2 border-border p-5 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Withdrawal Amount</span>
                <span className="font-bold text-foreground">XAF {numAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fee ({feeStructure ? `${(feeStructure as any).percentage_rate || 0}%` : ''})</span>
                <span className="font-bold text-destructive">- XAF {fee.toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">To</span>
                <span className="font-bold text-foreground">{selectedAccount?.account_name}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{selectedAccount?.provider_name}</span>
                <span>{selectedAccount?.last4 ? `•••• ${selectedAccount.last4}` : ''}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between text-base">
                <span className="font-bold text-foreground">You receive</span>
                <span className="font-extrabold text-foreground">XAF {netAmount.toLocaleString()}</span>
              </div>
            </div>

            <Button onClick={handleWithdraw} disabled={processing} className="w-full rounded-2xl h-12 text-sm font-bold">
              {processing ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span>
              ) : (
                <><Banknote className="mr-2 h-4 w-4" strokeWidth={1.5} /> Confirm Cash Out</>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerCashOut;
