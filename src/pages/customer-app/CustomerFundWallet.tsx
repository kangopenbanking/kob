import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Smartphone, Wallet, CreditCard, CheckCircle2, Loader2, ArrowDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

const iconMap: Record<string, { icon: React.ElementType; color: string; iconColor: string }> = {
  bank_account: { icon: Building2, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  momo_mtn: { icon: Smartphone, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  momo_orange: { icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  paypal: { icon: Wallet, color: 'bg-[hsl(210,70%,90%)]', iconColor: 'text-[hsl(210,70%,50%)]' },
  bank_card: { icon: CreditCard, color: 'bg-[hsl(270,50%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
};

const quickAmounts = [5000, 10000, 25000, 50000, 100000];

const CustomerFundWallet: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [amount, setAmount] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [step, setStep] = useState<'source' | 'amount' | 'confirm' | 'success'>('source');
  const [processing, setProcessing] = useState(false);

  const { data: linkedAccounts = [], isLoading } = useQuery({
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

  const getIcon = (type: string) => iconMap[type] || iconMap.bank_account;

  const handleConfirm = () => {
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setStep('confirm');
  };

  const handleDeposit = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep('success');
      toast.success(`XAF ${Number(amount).toLocaleString()} deposited to your wallet`);
      setTimeout(() => navigate(-1), 2500);
    }, 1800);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => {
          if (step === 'amount') { setStep('source'); setSelectedAccount(null); }
          else if (step === 'confirm') setStep('amount');
          else navigate(-1);
        }}>
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Add Money</h1>
      </div>

      <AnimatePresence mode="wait">
        {step === 'success' ? (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
              <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-bold text-foreground">Deposit Successful!</p>
            <p className="text-sm text-muted-foreground">XAF {Number(amount).toLocaleString()} added to your wallet</p>
            <p className="text-xs text-[hsl(150,40%,35%)] font-semibold">No fees charged ✓</p>
          </motion.div>
        ) : step === 'source' ? (
          <motion.div key="source" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {/* Free deposit banner */}
            <div className="flex items-start gap-3 rounded-2xl bg-[hsl(150,40%,90%)] p-4">
              <ArrowDownLeft className="h-5 w-5 text-[hsl(150,40%,35%)] mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-bold text-foreground">Free Deposits</p>
                <p className="text-[11px] text-muted-foreground">Adding money from your linked accounts is always free. No hidden charges.</p>
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Source Account</p>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : linkedAccounts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-sm font-semibold text-foreground">No linked accounts</p>
                <p className="text-xs text-muted-foreground text-center">Link an account first to add money to your wallet.</p>
                <Button onClick={() => navigate('/app/linked-accounts')} className="rounded-2xl mt-2">Link Account</Button>
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
            {/* Source display */}
            {selectedAccount && (() => {
              const { icon: Icon, color, iconColor } = getIcon(selectedAccount.account_type);
              return (
                <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">From: {selectedAccount.account_name}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedAccount.provider_name} {selectedAccount.last4 ? `•••• ${selectedAccount.last4}` : ''}</p>
                  </div>
                </div>
              );
            })()}

            {/* Amount Input */}
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-primary p-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/60">Deposit Amount</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-primary-foreground/60">XAF</span>
                <input type="text" inputMode="numeric" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0" className="bg-transparent text-4xl font-bold text-primary-foreground outline-none w-full text-center placeholder:text-primary-foreground/30" />
              </div>
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

            {/* Fee notice */}
            <div className="rounded-2xl bg-[hsl(150,40%,90%)] p-3 text-center">
              <p className="text-xs font-bold text-[hsl(150,40%,35%)]">No fee applies ✓</p>
              <p className="text-[11px] text-muted-foreground">Deposits into your Kang wallet are always free</p>
            </div>

            <Button onClick={handleConfirm} disabled={!amount || Number(amount) <= 0} className="w-full rounded-2xl h-12 text-sm font-bold">
              Continue
            </Button>
          </motion.div>
        ) : (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-5">
            <p className="text-center text-sm font-semibold text-muted-foreground">Confirm Deposit</p>

            <div className="rounded-3xl bg-card border-2 border-border p-5 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-foreground">XAF {Number(amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-bold text-[hsl(150,40%,35%)]">Free</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">From</span>
                <span className="font-bold text-foreground">{selectedAccount?.account_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">To</span>
                <span className="font-bold text-foreground">Kang Wallet</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between text-base">
                <span className="font-bold text-foreground">You receive</span>
                <span className="font-extrabold text-foreground">XAF {Number(amount).toLocaleString()}</span>
              </div>
            </div>

            <Button onClick={handleDeposit} disabled={processing} className="w-full rounded-2xl h-12 text-sm font-bold">
              {processing ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span>
              ) : (
                'Confirm Deposit'
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerFundWallet;
