import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Smartphone, Wallet, CreditCard, CheckCircle2, Loader2, ArrowDownLeft, Shield, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useEnsureWalletAccount } from '@/hooks/useEnsureWalletAccount';
import { FundingResult } from '@/components/funding/FundingResult';
import { cn } from '@/lib/utils';

const quickAmounts = [5000, 10000, 25000, 50000, 100000];
const fmt = (n: number) => new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

const paymentMethods = [
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone, desc: 'MTN, Orange' },
  { value: 'card', label: 'Card', icon: CreditCard, desc: 'Visa, Mastercard' },
  { value: 'paypal', label: 'PayPal', icon: Globe, desc: 'PayPal account' },
  { value: 'bank_transfer', label: 'Bank', icon: Building2, desc: 'Wire transfer' },
] as const;

const CustomerFundWallet: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('mobile_money');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'method' | 'amount' | 'processing' | 'result'>('method');
  const [processing, setProcessing] = useState(false);
  const [fundingResult, setFundingResult] = useState<any>(null);

  const { account: primaryAccount, loading: accountLoading } = useEnsureWalletAccount(user?.id);

  const feePercent = method === 'card' ? 0.035 : method === 'paypal' ? 0.035 : method === 'bank_transfer' ? 0.025 : 0.025;
  const numAmount = Number(amount);
  const fee = numAmount > 0 ? Math.round(numAmount * feePercent) : 0;

  const handleSubmit = async () => {
    if (!numAmount || numAmount <= 0) { toast.error('Enter a valid amount'); return; }
    if (method === 'mobile_money' && !phone) { toast.error('Phone number is required'); return; }
    if ((method === 'card' || method === 'paypal') && !email) { toast.error('Email is required'); return; }
    if (!primaryAccount?.id) { toast.error('No wallet account found. Please contact support.'); return; }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gateway-create-funding-intent', {
        body: {
          amount: numAmount,
          currency: 'XAF',
          method,
          funding_scope: 'end_user',
          account_id: primaryAccount.id,
          customer: { phone, email: email || '' },
          return_url: window.location.href,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);

      setFundingResult(data);
      setStep('result');
      toast.success('Payment initiated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['customer-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['account-balances'] });
    queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });
    setTimeout(() => navigate(-1), 2500);
  };

  const goBack = () => {
    if (step === 'amount') setStep('method');
    else if (step === 'result') { setStep('method'); setFundingResult(null); }
    else navigate(-1);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={goBack}>
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Add Money</h1>
      </div>

      <AnimatePresence mode="wait">
        {step === 'result' && fundingResult ? (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <FundingResult result={fundingResult} fmt={fmt} onSuccess={handleSuccess} />
          </motion.div>
        ) : step === 'method' ? (
          <motion.div key="method" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-2xl bg-primary/10 p-4">
              <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-bold text-foreground">Secure Payments</p>
                <p className="text-[11px] text-muted-foreground">All payments are processed securely via Stripe, Flutterwave, or PayPal.</p>
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Choose Payment Method</p>

            <div className="grid grid-cols-2 gap-3">
              {paymentMethods.map((m) => {
                const Icon = m.icon;
                const selected = method === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all',
                      selected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/40'
                    )}
                  >
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                      selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn('text-xs font-bold', selected ? 'text-primary' : 'text-foreground')}>{m.label}</span>
                    <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                  </button>
                );
              })}
            </div>

            <Button onClick={() => setStep('amount')} className="w-full rounded-2xl h-12 text-sm font-bold">
              Continue
            </Button>
          </motion.div>
        ) : step === 'amount' ? (
          <motion.div key="amount" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-5">
            {/* Selected method */}
            {(() => {
              const m = paymentMethods.find(p => p.value === method)!;
              const Icon = m.icon;
              return (
                <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Via: {m.label}</p>
                    <p className="text-[10px] text-muted-foreground">{m.desc}</p>
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

            {/* Conditional fields */}
            {method === 'mobile_money' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Phone Number</Label>
                <Input placeholder="237677123456" value={phone} onChange={e => setPhone(e.target.value)} className="h-11 rounded-xl" />
              </div>
            )}
            {(method === 'card' || method === 'paypal') && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Email</Label>
                <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-xl" />
              </div>
            )}

            {/* Fee summary */}
            {numAmount > 0 && (
              <div className="rounded-2xl bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-foreground">{fmt(numAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Fee ({(feePercent * 100).toFixed(1)}%)</span>
                  <span className="font-bold text-foreground">{fmt(fee)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="font-bold text-foreground">You receive</span>
                  <span className="font-extrabold text-foreground">{fmt(numAmount - fee)}</span>
                </div>
              </div>
            )}

            <Button onClick={handleSubmit} disabled={processing || !numAmount || numAmount <= 0}
              className="w-full rounded-2xl h-12 text-sm font-bold">
              {processing ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span>
              ) : (
                `Pay ${numAmount > 0 ? fmt(numAmount) : ''}`
              )}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" /> End-to-end encrypted
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default CustomerFundWallet;
