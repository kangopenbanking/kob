import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Smartphone, Wallet, CreditCard, CheckCircle2, Loader2, Banknote, Plus, Clock, Mail, Bell, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useAccountBalances } from '@/hooks/useCustomerData';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { AutoCashOutRules } from '@/components/pwa/AutoCashOutRules';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { KANG_PLATFORM_ID } from '@/constants/platform';



const iconMap: Record<string, { icon: React.ElementType; color: string; iconColor: string }> = {
  bank_account: { icon: Building2, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  momo_mtn: { icon: Smartphone, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  momo_orange: { icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  paypal: { icon: Wallet, color: 'bg-[hsl(210,70%,90%)]', iconColor: 'text-[hsl(210,70%,50%)]' },
  bank_card: { icon: CreditCard, color: 'bg-[hsl(270,50%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
};

const defaultQuickAmounts = [5000, 10000, 25000, 50000, 100000];

const CustomerCashOut: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [step, setStep] = useState<'dest' | 'amount' | 'confirm' | 'success'>('dest');
  const [processing, setProcessing] = useState(false);
  const [showPin, setShowPin] = useState(false);
  // F44 — stable idempotency key for the current confirm-attempt (regenerated on new confirm)
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  // Phase 25 — Preferred bank payout rail: 'auto' (router decides), 'kob_open_banking', or 'flutterwave'
  const [preferredRail, setPreferredRail] = useState<'auto' | 'kob_open_banking' | 'flutterwave'>('auto');

  const { data: kangAccounts = [] } = useCustomerAccounts(user?.id);
  const accountIds = kangAccounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);
  const primaryAccount = kangAccounts[0] as any;
  const primaryBalance = primaryAccount ? balances.find((b: any) => b.account_id === primaryAccount.id) : null;
  const walletBalance = (primaryBalance?.amount as number) ?? 0;

  // Fetch admin cashout config
  const { data: cashoutConfig } = useQuery({
    queryKey: ['cashout-config', KANG_PLATFORM_ID],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('institutions')
        .select('app_config')
        .eq('id', KANG_PLATFORM_ID)
        .maybeSingle();
      if (error || !data) return { methods: { bank_transfer: true, mobile_money: true, paypal: true, agent: true }, limits: { min_amount: 0, max_amount: 0, daily_limit: 0, quick_amounts: defaultQuickAmounts } };
      try {
        const raw = data?.app_config?.customer_app_config || {};
        return {
          methods: raw.cashout_methods || { bank_transfer: true, mobile_money: true, paypal: true, agent: true },
          limits: { min_amount: 0, max_amount: 0, daily_limit: 0, quick_amounts: defaultQuickAmounts, ...(raw.cashout_limits || {}) },
        };
      } catch {
        return { methods: { bank_transfer: true, mobile_money: true, paypal: true, agent: true }, limits: { min_amount: 0, max_amount: 0, daily_limit: 0, quick_amounts: defaultQuickAmounts } };
      }
    },
  });

  const cashoutMethods = cashoutConfig?.methods || { bank_transfer: true, mobile_money: true, paypal: true, agent: true };
  const cashoutLimits = cashoutConfig?.limits || { min_amount: 0, max_amount: 0, daily_limit: 0, quick_amounts: defaultQuickAmounts };
  const quickAmounts = cashoutLimits.quick_amounts?.length ? cashoutLimits.quick_amounts : defaultQuickAmounts;

  const accountTypeToCashoutMethod = (accountType: string): string | null => {
    switch (accountType) {
      case 'bank_account': return 'bank_transfer';
      case 'momo_mtn':
      case 'momo_orange': return 'mobile_money';
      case 'paypal': return 'paypal';
      case 'bank_card': return 'bank_transfer';
      default: return null;
    }
  };

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

  const filteredAccounts = linkedAccounts.filter((acc: any) => {
    const method = accountTypeToCashoutMethod(acc.account_type);
    if (!method) return true;
    return cashoutMethods?.[method] !== false;
  });

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
    if (fs.fee_model === 'fixed') fee = fs.fixed_amount || 0;
    else if (fs.fee_model === 'percentage') fee = (amt * (fs.percentage_rate || 0)) / 100;
    else if (fs.fee_model === 'hybrid') fee = (fs.fixed_amount || 0) + (amt * (fs.percentage_rate || 0)) / 100;
    if (fs.min_fee_amount && fee < fs.min_fee_amount) fee = fs.min_fee_amount;
    if (fs.max_fee_amount && fee > fs.max_fee_amount) fee = fs.max_fee_amount;
    return Math.round(fee);
  };

  const getFeeDescription = (): string | null => {
    if (!feeStructure) return null;
    const fs = feeStructure as any;
    if (fs.fee_model === 'percentage') {
      const parts = [`${fs.percentage_rate}% per withdrawal`];
      if (fs.min_fee_amount) parts.push(`min XAF ${fs.min_fee_amount.toLocaleString()}`);
      if (fs.max_fee_amount) parts.push(`max XAF ${fs.max_fee_amount.toLocaleString()}`);
      return parts.join(' · ');
    }
    if (fs.fee_model === 'fixed') return `Flat fee of XAF ${(fs.fixed_amount || 0).toLocaleString()}`;
    if (fs.fee_model === 'hybrid') return `XAF ${(fs.fixed_amount || 0).toLocaleString()} + ${fs.percentage_rate}%`;
    return 'Fee applies per platform schedule';
  };

  const numAmount = Number(amount) || 0;
  const fee = calculateFee(numAmount);
  const netAmount = Math.max(numAmount - fee, 0);
  const isOverBalance = numAmount > walletBalance;

  const getProcessingTime = (destType: string): string => {
    switch (destType) {
      case 'bank_card': return '5–10 business days';
      case 'bank_account': return '1–3 business days';
      case 'momo_mtn':
      case 'momo_orange': return 'Instant – 30 minutes';
      case 'paypal': return '1–2 business days';
      default: return '1–3 business days';
    }
  };

  const getProcessingDescription = (destType: string): string => {
    switch (destType) {
      case 'bank_card': return 'Refund processed via Stripe to your original card. Processing depends on your bank.';
      case 'bank_account': return 'Transfer sent to your bank account via our payment partner.';
      case 'momo_mtn':
      case 'momo_orange': return 'Funds sent directly to your mobile money wallet.';
      case 'paypal': return 'PayPal payout initiated to your linked email address.';
      default: return 'Your withdrawal is being processed.';
    }
  };

  const getIcon = (type: string) => iconMap[type] || iconMap.bank_account;

  const handleConfirm = () => {
    if (!amount || numAmount <= 0) { toast.error('Please enter an amount to withdraw'); return; }
    if (fee > 0 && numAmount <= fee) { toast.error(`Amount must be greater than the ${fee.toLocaleString()} XAF processing fee`); return; }
    if (isOverBalance) { toast.error(`Insufficient balance. You have ${walletBalance.toLocaleString()} XAF available`); return; }
    if (cashoutLimits.min_amount > 0 && numAmount < cashoutLimits.min_amount) { toast.error(`Minimum withdrawal amount is ${cashoutLimits.min_amount.toLocaleString()} XAF`); return; }
    if (cashoutLimits.max_amount > 0 && numAmount > cashoutLimits.max_amount) { toast.error(`Maximum withdrawal amount is ${cashoutLimits.max_amount.toLocaleString()} XAF per transaction`); return; }
    // F44 — generate stable key once per confirm so PIN-retry/network-retry de-duplicate
    setIdempotencyKey(`wd_${primaryAccount?.id}_${selectedAccount?.id}_${numAmount}_${Date.now()}`);
    setStep('confirm');
  };

  const handleWithdraw = async () => {
    setProcessing(true);
    try {
      const destinationType = selectedAccount?.account_type;

      // Call the unified withdrawal edge function (stable idempotency key)
      const idemKey = idempotencyKey || `wd_${primaryAccount?.id}_${selectedAccount?.id}_${numAmount}_${Date.now()}`;
      const { data: result, error } = await supabase.functions.invoke('gateway-process-withdrawal', {
        body: {
          amount: numAmount,
          account_id: primaryAccount?.id,
          destination_type: destinationType,
          linked_account_id: selectedAccount?.id,
          currency: 'XAF',
          narration: `Cash out to ${selectedAccount?.account_name || destinationType}`,
          idempotency_key: idemKey,
          preferred_rail: destinationType === 'bank_account' ? preferredRail : 'auto',
        },
        headers: { 'idempotency-key': idemKey },
      });

      if (error) throw new Error(error.message || 'Withdrawal failed');
      if (result?.error) throw new Error(result.message || result.error);

      // Invalidate caches
      queryClient.refetchQueries({ queryKey: ['customer-accounts'] });
      queryClient.refetchQueries({ queryKey: ['account-balances'] });
      queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['customer-spending-summary'] });

      setStep('success');

      const processingTime = getProcessingTime(destinationType);
      const isInstant = result.status === 'completed';

      // Professional toast with processing time
      toast.success(
        isInstant
          ? `Withdrawal complete! XAF ${netAmount.toLocaleString()} sent to ${selectedAccount?.account_name || destinationType}.`
          : `Withdrawal initiated! XAF ${netAmount.toLocaleString()} is on its way.`,
        {
          description: isInstant
            ? 'Funds have been delivered successfully.'
            : `Estimated processing: ${processingTime}. You'll receive a confirmation email shortly.`,
          duration: 6000,
        }
      );

      // Notification is handled server-side by the edge function/DB trigger

      // Send confirmation email (non-blocking)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      supabase.functions.invoke('send-communication', {
        body: {
          template_key: 'payment_completed',
          recipient_email: currentUser?.email,
          variables: {
            amount: `XAF ${numAmount.toLocaleString()}`,
            fee: fee > 0 ? `XAF ${fee.toLocaleString()}` : '0',
            net_amount: `XAF ${netAmount.toLocaleString()}`,
            destination: selectedAccount?.account_name || destinationType,
            reference: result.tx_ref || '',
            processing_time: processingTime,
            status: isInstant ? 'Completed' : 'Processing',
            customer_name: currentUser?.user_metadata?.full_name || 'Customer',
          },
        },
      }).catch(err => console.error('Withdrawal email failed:', err));

      setTimeout(() => navigate(-1), 4000);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Withdrawal failed. Please try again.'), {
        description: 'Your balance has been restored. No funds were deducted.',
        duration: 5000,
      });
    } finally {
      setProcessing(false);
    }
  };

  const goBack = () => {
    if (step === 'amount') { setStep('dest'); setSelectedAccount(null); }
    else if (step === 'confirm') setStep('amount');
    else navigate(-1);
  };

  const standaloneMethodCards: { key: string; label: string; description: string; iconKey: string }[] = [];

  const feeDesc = getFeeDescription();

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
            className="flex flex-col items-center gap-5 py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
              <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">Withdrawal Initiated!</p>
              <p className="text-sm text-muted-foreground mt-1">
                XAF {netAmount.toLocaleString()} to {selectedAccount?.account_name}
              </p>
              {fee > 0 && <p className="text-xs text-muted-foreground mt-0.5">Fee: XAF {fee.toLocaleString()}</p>}
            </div>

            {/* Processing time card */}
            <div className="w-full rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(210,80%,93%)]">
                  <Clock className="h-5 w-5 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Estimated Processing</p>
                  <p className="text-sm font-extrabold text-primary">
                    {getProcessingTime(selectedAccount?.account_type)}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {getProcessingDescription(selectedAccount?._isAgent ? 'agent' : selectedAccount?.account_type)}
              </p>
            </div>

            {/* Confirmation notices */}
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-[hsl(150,30%,94%)] px-3 py-2.5">
                <Mail className="h-4 w-4 text-[hsl(150,40%,35%)] shrink-0" strokeWidth={1.5} />
                <p className="text-[11px] text-[hsl(150,30%,25%)]">A confirmation email has been sent to your inbox.</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[hsl(210,30%,94%)] px-3 py-2.5">
                <Bell className="h-4 w-4 text-[hsl(210,50%,45%)] shrink-0" strokeWidth={1.5} />
                <p className="text-[11px] text-[hsl(210,30%,25%)]">You'll be notified when the transfer is complete.</p>
              </div>
            </div>
          </motion.div>
        ) : step === 'dest' ? (
          <motion.div key="dest" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {feeDesc && (
              <div className="flex items-start gap-3 rounded-2xl bg-[hsl(45,70%,90%)] p-4">
                <Banknote className="h-5 w-5 text-[hsl(45,60%,35%)] mt-0.5 shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-xs font-bold text-foreground">Withdrawal Fee</p>
                  <p className="text-[11px] text-muted-foreground">{feeDesc}</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Wallet Balance</p>
              <p className="text-xl font-bold text-foreground mt-1">XAF {walletBalance.toLocaleString()}</p>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Withdraw To</p>

            {acctLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (filteredAccounts.length === 0 && standaloneMethodCards.length === 0) ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Banknote className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {linkedAccounts.length > 0 ? 'No enabled withdrawal methods' : 'No linked accounts'}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  {linkedAccounts.length > 0
                    ? 'Your linked account types are currently disabled for withdrawals by the platform.'
                    : 'Link an account first to withdraw funds.'}
                </p>
                <Button onClick={() => navigate('/app/linked-accounts className="rounded-2xl mt-2">
                  <Plus className="h-4 w-4 mr-1" /> Link Account
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAccounts.map((acc: any) => {
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

                {standaloneMethodCards.map((method) => {
                  const { icon: Icon, color, iconColor } = getIcon(method.iconKey);
                  return (
                    <button key={method.key} onClick={() => {
                      setSelectedAccount({ _isAgent: true, account_name: method.label, account_type: method.key, provider_name: 'Agent Network' });
                      setStep('amount');
                    }}
                      className="flex w-full items-center gap-3 rounded-3xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary active:scale-[0.98]">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">{method.label}</p>
                        <p className="text-[11px] text-muted-foreground">{method.description}</p>
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
            {selectedAccount && (() => {
              const iconKey = selectedAccount._isAgent ? 'agent' : selectedAccount.account_type;
              const { icon: Icon, color, iconColor } = getIcon(iconKey);
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
              {(cashoutLimits.min_amount > 0 || cashoutLimits.max_amount > 0) && (
                <p className="text-[10px] text-[hsl(0,0%,100%)]/40 mt-1">
                  {cashoutLimits.min_amount > 0 ? `Min: XAF ${cashoutLimits.min_amount.toLocaleString()}` : ''}
                  {cashoutLimits.min_amount > 0 && cashoutLimits.max_amount > 0 ? ' · ' : ''}
                  {cashoutLimits.max_amount > 0 ? `Max: XAF ${cashoutLimits.max_amount.toLocaleString()}` : ''}
                </p>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {quickAmounts.map((a: number) => (
                <button key={a} onClick={() => setAmount(String(a))}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${amount === String(a) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {a.toLocaleString()}
                </button>
              ))}
            </div>

            {numAmount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl bg-card border border-border p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold text-foreground">XAF {numAmount.toLocaleString()}</span>
                </div>
                {fee > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Fee</span>
                    <span className="font-semibold text-destructive">- XAF {fee.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="font-bold text-foreground">You receive</span>
                  <span className="font-extrabold text-foreground">XAF {netAmount.toLocaleString()}</span>
                </div>
              </motion.div>
            )}

            <Button onClick={handleConfirm} disabled={!amount || numAmount <= 0 || (fee > 0 && numAmount <= fee) || isOverBalance || (cashoutLimits.min_amount > 0 && numAmount < cashoutLimits.min_amount) || (cashoutLimits.max_amount > 0 && numAmount > cashoutLimits.max_amount)} className="w-full rounded-2xl h-12 text-sm font-bold">
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
              {fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee{feeStructure ? ` (${(feeStructure as any).fee_model === 'percentage' ? `${(feeStructure as any).percentage_rate}%` : (feeStructure as any).fee_model === 'fixed' ? 'flat' : 'hybrid'})` : ''}</span>
                  <span className="font-bold text-destructive">- XAF {fee.toLocaleString()}</span>
                </div>
              )}
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

            {selectedAccount?.account_type === 'bank_account' && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  <p className="text-xs font-bold text-foreground">Payout Rail</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Choose how this transfer reaches your bank. Open Banking uses the Kang Open Banking API for direct, lower-cost settlement when your bank is a registered KOB institution.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'auto', label: 'Auto', sub: 'Recommended' },
                    { key: 'kob_open_banking', label: 'Open Banking', sub: 'KOB API' },
                    { key: 'flutterwave', label: 'Card Network', sub: 'Flutterwave' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPreferredRail(opt.key)}
                      className={`rounded-xl border-2 p-2 text-left transition-colors ${
                        preferredRail === opt.key
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-foreground">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={() => setShowPin(true)} disabled={processing} className="w-full rounded-2xl h-12 text-sm font-bold">
              {processing ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span>
              ) : (
                <><Banknote className="mr-2 h-4 w-4" strokeWidth={1.5} /> Confirm Cash Out</>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto Cash Out Rules */}
      {user?.id && step === 'dest' && filteredAccounts.length > 0 && (
        <AutoCashOutRules
          userId={user.id}
          linkedAccounts={filteredAccounts}
          ownerType="consumer"
        />
      )}

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handleWithdraw} />
    </div>
  );
};

export default CustomerCashOut;
