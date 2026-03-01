import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Smartphone, Wallet, CreditCard, CheckCircle2, Loader2, ArrowDownLeft, Shield, Globe, Search, ChevronRight } from 'lucide-react';
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
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone, desc: 'MTN, Orange', fadedBg: 'bg-[hsl(45,80%,95%)]', activeBg: 'bg-[hsl(45,80%,55%)]', activeBorder: 'border-[hsl(45,80%,55%)]', activeText: 'text-[hsl(45,80%,25%)]' },
  { value: 'card', label: 'Card', icon: CreditCard, desc: 'Visa, Mastercard', fadedBg: 'bg-[hsl(220,80%,95%)]', activeBg: 'bg-[hsl(220,80%,55%)]', activeBorder: 'border-[hsl(220,80%,55%)]', activeText: 'text-[hsl(220,80%,25%)]' },
  { value: 'paypal', label: 'PayPal', icon: Globe, desc: 'PayPal account', fadedBg: 'bg-[hsl(200,80%,95%)]', activeBg: 'bg-[hsl(200,80%,50%)]', activeBorder: 'border-[hsl(200,80%,50%)]', activeText: 'text-[hsl(200,80%,20%)]' },
  { value: 'bank_transfer', label: 'Bank', icon: Building2, desc: 'Wire transfer', fadedBg: 'bg-[hsl(150,60%,95%)]', activeBg: 'bg-[hsl(150,60%,45%)]', activeBorder: 'border-[hsl(150,60%,45%)]', activeText: 'text-[hsl(150,60%,20%)]' },
] as const;

interface BankOption {
  code: string;
  name: string;
  source: 'kob' | 'flutterwave';
}

const CustomerFundWallet: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('mobile_money');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'method' | 'bank_select' | 'amount' | 'processing' | 'result'>('method');
  const [processing, setProcessing] = useState(false);
  const [fundingResult, setFundingResult] = useState<any>(null);

  // Bank selection state
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [bankSearch, setBankSearch] = useState('');

  const { account: primaryAccount, loading: accountLoading } = useEnsureWalletAccount(user?.id);

  const feePercent = method === 'card' ? 0.035 : method === 'paypal' ? 0.035 : method === 'bank_transfer' ? 0.025 : 0.025;
  const numAmount = Number(amount);
  const fee = numAmount > 0 ? Math.round(numAmount * feePercent) : 0;

  // Fetch banks from both KOB institutions and Flutterwave
  const fetchBanks = useCallback(async () => {
    setBanksLoading(true);
    const allBanks: BankOption[] = [];

    try {
      // 1. Fetch KOB-connected institutions (banks/FIs on the platform)
      const { data: kobInstitutions } = await supabase
        .from('institutions' as any)
        .select('id, institution_name, institution_type, swift_bic_code')
        .eq('is_active', true)
        .order('institution_name');

      if (kobInstitutions?.length) {
        kobInstitutions.forEach((inst: any) => {
          allBanks.push({
            code: inst.swift_bic_code || inst.id,
            name: `${inst.institution_name}`,
            source: 'kob',
          });
        });
      }
    } catch (err) {
      console.warn('[FundWallet] KOB institutions fetch failed:', err);
    }

    try {
      // 2. Fetch Flutterwave banks for Cameroon
      const { data: fwData, error: fwError } = await supabase.functions.invoke('flutterwave-list-banks', {
        body: { country: 'CM' },
      });

      if (!fwError && fwData?.banks?.length) {
        fwData.banks.forEach((bank: any) => {
          // Avoid duplicates with KOB banks by checking name similarity
          const isDuplicate = allBanks.some(
            (b) => b.name.toLowerCase().includes(bank.name?.toLowerCase()?.slice(0, 10))
          );
          if (!isDuplicate) {
            allBanks.push({
              code: bank.code,
              name: bank.name,
              source: 'flutterwave',
            });
          }
        });
      }
    } catch (err) {
      console.warn('[FundWallet] Flutterwave banks fetch failed:', err);
    }

    setBanks(allBanks);
    setBanksLoading(false);
  }, []);

  const handleMethodContinue = () => {
    if (method === 'bank_transfer') {
      fetchBanks();
      setStep('bank_select');
    } else {
      setStep('amount');
    }
  };

  const handleBankSelect = (bank: BankOption) => {
    setSelectedBank(bank);
    setStep('amount');
  };

  const handleSubmit = async () => {
    if (!numAmount || numAmount <= 0) { toast.error('Enter a valid amount'); return; }
    if (method === 'mobile_money' && !phone) { toast.error('Phone number is required'); return; }
    if ((method === 'card' || method === 'paypal') && !email) { toast.error('Email is required'); return; }
    if (method === 'bank_transfer' && !selectedBank) { toast.error('Please select a bank'); return; }
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
          ...(method === 'bank_transfer' && selectedBank ? {
            bank_code: selectedBank.code,
            bank_name: selectedBank.name,
            bank_source: selectedBank.source,
          } : {}),
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
    queryClient.invalidateQueries({ queryKey: ['spending-summary'] });
    queryClient.invalidateQueries({ queryKey: ['customer-bill-payments'] });
    setTimeout(() => navigate(-1), 2500);
  };

  const goBack = () => {
    if (step === 'bank_select') setStep('method');
    else if (step === 'amount') {
      if (method === 'bank_transfer') { setStep('bank_select'); setSelectedBank(null); }
      else setStep('method');
    }
    else if (step === 'result') { setStep('method'); setFundingResult(null); setSelectedBank(null); }
    else navigate(-1);
  };

  const filteredBanks = banks.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

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
                        ? `${m.activeBorder} ${m.fadedBg} ring-2 ring-current/20 shadow-md scale-[1.02]`
                        : `border-transparent ${m.fadedBg} opacity-70 hover:opacity-100`
                    )}
                  >
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                      selected ? `${m.activeBg} text-white` : 'bg-white/60 text-muted-foreground'
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn('text-xs', selected ? `font-extrabold ${m.activeText}` : 'font-medium text-foreground')}>{m.label}</span>
                    <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                  </button>
                );
              })}
            </div>

            <Button onClick={handleMethodContinue} className="w-full rounded-2xl h-12 text-sm font-bold">
              Continue
            </Button>
          </motion.div>
        ) : step === 'bank_select' ? (
          <motion.div key="bank_select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Select Your Bank</p>
                <p className="text-[10px] text-muted-foreground">Choose from KOB partner banks & financial institutions</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search banks..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="h-11 rounded-xl pl-9"
              />
            </div>

            {/* Bank list */}
            <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
              {banksLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Fetching banks from KOB & Flutterwave...</p>
                </div>
              ) : filteredBanks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No banks found</p>
                </div>
              ) : (
                <>
                  {/* KOB Partner Banks */}
                  {filteredBanks.some(b => b.source === 'kob') && (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-primary mt-2 mb-1 px-1">
                      🏦 KOB Partner Banks
                    </p>
                  )}
                  {filteredBanks.filter(b => b.source === 'kob').map((bank) => (
                    <button
                      key={`kob-${bank.code}`}
                      onClick={() => handleBankSelect(bank)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 transition-all text-left',
                        selectedBank?.code === bank.code
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/30'
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{bank.name}</p>
                        <p className="text-[10px] text-primary font-medium">Instant • KOB Network</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}

                  {/* Flutterwave Banks */}
                  {filteredBanks.some(b => b.source === 'flutterwave') && (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-3 mb-1 px-1">
                      🌍 Other Banks via Flutterwave
                    </p>
                  )}
                  {filteredBanks.filter(b => b.source === 'flutterwave').map((bank) => (
                    <button
                      key={`fw-${bank.code}`}
                      onClick={() => handleBankSelect(bank)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3 transition-all text-left',
                        selectedBank?.code === bank.code
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/30'
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{bank.name}</p>
                        <p className="text-[10px] text-muted-foreground">Standard • Flutterwave</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </>
              )}
            </div>

            <p className="text-center text-[10px] text-muted-foreground">
              {banks.length} banks available • KOB + Flutterwave networks
            </p>
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
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">Via: {m.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {method === 'bank_transfer' && selectedBank
                        ? `${selectedBank.name} (${selectedBank.source === 'kob' ? 'KOB Network' : 'Flutterwave'})`
                        : m.desc}
                    </p>
                  </div>
                  {method === 'bank_transfer' && selectedBank && (
                    <button onClick={() => setStep('bank_select')} className="text-[10px] font-bold text-primary">
                      Change
                    </button>
                  )}
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
