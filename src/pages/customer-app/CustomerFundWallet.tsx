import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, Smartphone, Wallet, CreditCard, CheckCircle2, Loader2, ArrowDownLeft, Shield, Globe, Search, ChevronRight, AlertCircle, LinkIcon, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useEnsureWalletAccount } from '@/hooks/useEnsureWalletAccount';
import { useFeeEstimate } from '@/hooks/useFeeEstimate';
import { FundingResult } from '@/components/funding/FundingResult';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { cn } from '@/lib/utils';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';
import { PayByBankLogo } from '@/components/PayByBankLogo';
import { BankLogo } from '@/components/BankLogo';
import { CM_BANKS } from '@/constants/cameroon-banks';

const quickAmounts = [5000, 10000, 25000, 50000, 100000];
const fmt = (n: number) => new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

const providerTypeToMethod = (providerType: string): string => {
  switch (providerType) {
    case 'mobile_money': return 'mobile_money';
    case 'card': return 'card';
    case 'paypal': return 'paypal';
    case 'bank': return 'bank_transfer';
    default: return 'bank_transfer';
  }
};


const providerTypeIcon = (providerType: string) => {
  switch (providerType) {
    case 'mobile_money': return Smartphone;
    case 'card': return CreditCard;
    case 'paypal': return Globe;
    case 'bank': return Building2;
    default: return Building2;
  }
};

const providerTypeColors = (providerType: string, selected: boolean) => {
  const colors: Record<string, { faded: string; active: string; activeBorder: string; activeText: string }> = {
    mobile_money: { faded: 'bg-[hsl(45,80%,95%)]', active: 'bg-[hsl(45,80%,55%)]', activeBorder: 'border-[hsl(45,80%,55%)]', activeText: 'text-[hsl(45,80%,25%)]' },
    card: { faded: 'bg-[hsl(220,80%,95%)]', active: 'bg-[hsl(220,80%,55%)]', activeBorder: 'border-[hsl(220,80%,55%)]', activeText: 'text-[hsl(220,80%,25%)]' },
    paypal: { faded: 'bg-[hsl(200,80%,95%)]', active: 'bg-[hsl(200,80%,50%)]', activeBorder: 'border-[hsl(200,80%,50%)]', activeText: 'text-[hsl(200,80%,20%)]' },
    bank: { faded: 'bg-[hsl(150,60%,95%)]', active: 'bg-[hsl(150,60%,45%)]', activeBorder: 'border-[hsl(150,60%,45%)]', activeText: 'text-[hsl(150,60%,20%)]' },
  };
  return colors[providerType] || colors.bank;
};

interface BankOption {
  code: string;
  name: string;
  source: 'kob' | 'flutterwave' | 'directory';
  logoUrl?: string | null;
}

const CustomerFundWallet: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'source' | 'bank_select' | 'amount' | 'pay_by_bank' | 'processing' | 'result'>('source');
  const [processing, setProcessing] = useState(false);
  const [fundingResult, setFundingResult] = useState<any>(null);
  const [showPin, setShowPin] = useState(false);
  const [pbbAmount, setPbbAmount] = useState('');
  const [pbbStep, setPbbStep] = useState<'tile' | 'bank' | 'amount' | 'redirecting'>('tile');
  const [pbbProcessing, setPbbProcessing] = useState(false);
  const [selectedPbbBank, setSelectedPbbBank] = useState<BankOption | null>(null);
  const [pbbBankSearch, setPbbBankSearch] = useState('');

  // Bank selection state (for bank_transfer method)
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [bankSearch, setBankSearch] = useState('');

  // Invalidate caches on redirect return (e.g. after Flutterwave/PayPal redirect)
  useEffect(() => {
    const status = searchParams.get('status') || searchParams.get('transaction_status');
    if (status) {
      queryClient.refetchQueries({ queryKey: ['customer-accounts'] });
      queryClient.refetchQueries({ queryKey: ['account-balances'] });
      queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });
      toast.info('Checking payment status...');
    }
  }, [searchParams, queryClient]);

  const { account: primaryAccount, loading: accountLoading } = useEnsureWalletAccount(user?.id);

  // Fetch user's active linked accounts
  const { data: linkedAccounts = [], isLoading: accountsLoading } = useQuery({
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

  const selectedAccount = linkedAccounts.find((a: any) => a.id === selectedAccountId);
  const method = selectedAccount ? providerTypeToMethod(selectedAccount.provider_type) : 'mobile_money';
  const selectedInstitutionId = selectedAccount?.institution_id;

  const numAmount = Number(amount);

  // Dynamic fee estimation from fee_structures table — scoped to selected account's institution
  const { fee: feeEstimateData } = useFeeEstimate({
    channel: method,
    amount: numAmount,
    scope: selectedInstitutionId ? "institution" : "platform",
    institutionId: selectedInstitutionId ?? undefined,
  });

  const fee = numAmount > 0 ? feeEstimateData.totalFee : 0;

  // Fetch banks for bank_transfer method
  const fetchBanks = useCallback(async () => {
    setBanksLoading(true);
    const allBanks: BankOption[] = [];

    try {
      const { data: kobInstitutions } = await supabase
        .from('institutions' as any)
        .select('id, institution_name, institution_type, swift_bic_code, logo_url')
        .eq('is_active', true)
        .order('institution_name');

      if (kobInstitutions?.length) {
        kobInstitutions.forEach((inst: any) => {
          allBanks.push({
            code: inst.swift_bic_code || inst.id,
            name: inst.institution_name,
            source: 'kob',
            logoUrl: inst.logo_url ?? null,
          });
        });
      }
    } catch (err) {
      console.warn('[FundWallet] KOB institutions fetch failed:', err);
    }

    try {
      const { data: fwData, error: fwError } = await supabase.functions.invoke('flutterwave-list-banks', {
        body: { country: 'CM' },
      });
      if (!fwError && fwData?.banks?.length) {
        fwData.banks.forEach((bank: any) => {
          const isDuplicate = allBanks.some(b => b.name.toLowerCase().includes(bank.name?.toLowerCase()?.slice(0, 10)));
          if (!isDuplicate) {
            allBanks.push({
              code: bank.code,
              name: bank.name,
              source: 'flutterwave',
              logoUrl: bank.logo || bank.logo_url || null,
            });
          }
        });
      }
    } catch (err) {
      console.warn('[FundWallet] Flutterwave banks fetch failed:', err);
    }

    CM_BANKS.forEach((bank) => {
      const exists = allBanks.some((b) => b.code === bank.code || b.name.toLowerCase() === bank.name.toLowerCase());
      if (!exists) allBanks.push({ code: bank.code, name: bank.name, source: 'directory', logoUrl: null });
    });

    setBanks(allBanks);
    setBanksLoading(false);
  }, []);

  const handleSourceContinue = () => {
    if (!selectedAccountId) { toast.error('Select a linked account'); return; }
    const derivedMethod = providerTypeToMethod(selectedAccount?.provider_type);
    if (derivedMethod === 'bank_transfer') {
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

  const handlePayByBankStart = () => {
    if (!primaryAccount?.id) { toast.error('No wallet account found. Please contact support.'); return; }
    fetchBanks();
    setPbbStep('bank');
    setStep('pay_by_bank');
  };

  const handlePayByBankSubmit = async () => {
    const amt = Number(pbbAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!primaryAccount?.id) { toast.error('No wallet account found.'); return; }
    if (!selectedPbbBank) { toast.error('Please select your bank'); return; }
    setPbbProcessing(true);
    try {
      const state = crypto.randomUUID();
      const returnUrl = `${window.location.origin}/app/fund-wallet?source=pay_by_bank`;
      const { data, error } = await supabase.functions.invoke('pay-by-bank', {
        body: {
          action: 'create_intent',
          target_type: 'consumer_wallet',
          target_account_id: primaryAccount.id,
          amount: amt,
          currency: 'XAF',
          redirect_uri: returnUrl,
          state,
          description: 'KANG Wallet top-up',
          source_bank: {
            code: selectedPbbBank.code,
            name: selectedPbbBank.name,
            network: selectedPbbBank.source,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      if (!data?.authorization_url || !data?.intent_id) throw new Error('Invalid response from server');
      setPbbStep('redirecting');
      // Persist state so /pay/authorize can validate when user returns
      try { sessionStorage.setItem(`pbb_state_${data.intent_id}`, state); } catch {}
      window.location.assign(data.authorization_url);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Could not start Pay-by-Bank'));
      setPbbStep(selectedPbbBank ? 'amount' : 'bank');
    } finally {
      setPbbProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (!numAmount || numAmount <= 0) { toast.error('Enter a valid amount'); return; }
    if (method === 'mobile_money' && !phone) { toast.error('Phone number is required'); return; }
    if ((method === 'card' || method === 'paypal') && !email) { toast.error('Email is required'); return; }
    if (method === 'bank_transfer' && !selectedBank) { toast.error('Please select a bank'); return; }
    if (!primaryAccount?.id) { toast.error('No wallet account found. Please contact support.'); return; }

    setProcessing(true);
    try {
      const idempotencyKey = `funding_${primaryAccount.id}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('gateway-create-funding-intent', {
        body: {
          amount: numAmount,
          currency: 'XAF',
          method,
          funding_scope: 'end_user',
          account_id: primaryAccount.id,
          linked_account_id: selectedAccountId,
          linked_account_ref: selectedAccount ? {
            id: selectedAccount.id,
            provider_type: selectedAccount.provider_type,
            provider_name: selectedAccount.provider_name,
            last4: selectedAccount.last4,
          } : undefined,
          customer: { phone: phone || selectedAccount?.account_number, email: email || '' },
          return_url: window.location.href,
          idempotency_key: idempotencyKey,
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
      toast.error(extractEdgeFunctionError(err, 'Failed to initiate payment'));
    } finally {
      setProcessing(false);
    }
  };

  const handleSuccess = () => {
    queryClient.refetchQueries({ queryKey: ['customer-accounts'] });
    queryClient.refetchQueries({ queryKey: ['account-balances'] });
    queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['spending-summary'] });
    queryClient.invalidateQueries({ queryKey: ['customer-bill-payments'] });
    setTimeout(() => navigate(-1), 2500);
  };

  const goBack = () => {
    if (step === 'bank_select') setStep('source');
    else if (step === 'amount') {
      if (method === 'bank_transfer') { setStep('bank_select'); setSelectedBank(null); }
      else setStep('source');
    }
    else if (step === 'pay_by_bank') { setStep('source'); setPbbStep('tile'); setPbbAmount(''); setSelectedPbbBank(null); }
    else if (step === 'result') { setStep('source'); setFundingResult(null); setSelectedBank(null); }
    else navigate(-1);
  };

  const filteredBanks = banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));
  const filteredPbbBanks = banks.filter(b => b.name.toLowerCase().includes(pbbBankSearch.toLowerCase()));

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={goBack}>
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">{tr('Add Money')}</h1>
      </div>

      <AnimatePresence mode="wait">
        {step === 'result' && fundingResult ? (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <FundingResult result={fundingResult} fmt={fmt} onSuccess={handleSuccess} />
          </motion.div>
        ) : step === 'source' ? (
          <motion.div key="source" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-2xl bg-primary/10 p-4">
              <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-xs font-bold text-foreground">{tr('Fund from Linked Accounts')}</p>
                <p className="text-[11px] text-muted-foreground">{tr('Select one of your linked accounts as the funding source. All payments are processed securely.')}</p>
              </div>
            </div>

            {/* Pay by Bank (Instant) tile — PISP wallet top-up */}
            <button
              onClick={handlePayByBankStart}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-primary/40 bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/30 bg-white">
                <PayByBankLogo className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{tr('Pay by Bank (Instant)')}</p>
                <p className="text-[11px] text-muted-foreground">{tr('Top up directly from your bank — no card needed. Open Banking secured.')}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>


            {accountsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : linkedAccounts.length === 0 ? (
              /* No linked accounts — prompt to link */
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <LinkIcon className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{tr('No Linked Accounts')}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    You need at least one linked account (bank, mobile money, card, or PayPal) to add funds to your wallet.
                  </p>
                </div>
                <Button asChild className="rounded-2xl">
                  <Link to="/app/linked-accounts">
                    <LinkIcon className="h-4 w-4 mr-2" /> Link an Account
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Choose Funding Source')}</p>

                <div className="space-y-2">
                  {linkedAccounts.map((acc: any) => {
                    const Icon = providerTypeIcon(acc.provider_type);
                    const colors = providerTypeColors(acc.provider_type, selectedAccountId === acc.id);
                    const selected = selectedAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border-2 p-4 transition-all text-left',
                          selected
                            ? `${colors.activeBorder} ${colors.faded} ring-2 ring-current/20 shadow-md scale-[1.01]`
                            : `border-transparent ${colors.faded} opacity-70 hover:opacity-100`
                        )}
                      >
                        <div className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                          selected ? `${colors.active} text-white` : 'bg-white/60 text-muted-foreground'
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={cn('text-sm', selected ? `font-extrabold ${colors.activeText}` : 'font-medium text-foreground')}>
                            {acc.account_name || acc.provider_name}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {acc.provider_name} {acc.last4 ? `•••• ${acc.last4}` : ''}
                          </p>
                        </div>
                        {acc.is_primary && (
                          <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{tr('Primary')}</span>
                        )}
                        {selected && (
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <Button onClick={handleSourceContinue} disabled={!selectedAccountId} className="w-full rounded-2xl h-12 text-sm font-bold">
                  Continue
                </Button>
              </>
            )}
          </motion.div>
        ) : step === 'bank_select' ? (
          <motion.div key="bank_select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{tr('Select Your Bank')}</p>
                <p className="text-[10px] text-muted-foreground">{tr('Choose from KOB partner banks & financial institutions')}</p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={tr('Search banks...')} value={bankSearch} onChange={(e) => setBankSearch(e.target.value)} className="h-11 rounded-xl pl-9" />
            </div>

            <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
              {banksLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">{tr('Fetching banks...')}</p>
                </div>
              ) : filteredBanks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">{tr('No banks found')}</p>
                </div>
              ) : (
                <>
                  {filteredBanks.some(b => b.source === 'kob') && (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-primary mt-2 mb-1 px-1">{tr('KOB Partner Banks')}</p>
                  )}
                  {filteredBanks.filter(b => b.source === 'kob').map((bank) => (
                    <button key={`kob-${bank.code}`} onClick={() => handleBankSelect(bank)}
                      className={cn('flex items-center gap-3 rounded-xl border p-3 transition-all text-left',
                        selectedBank?.code === bank.code ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary/30'
                      )}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                        <BankLogo logoUrl={bank.logoUrl} name={bank.name} iconClassName="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{bank.name}</p>
                        <p className="text-[10px] text-primary font-medium">{tr('Instant • KOB Network')}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}

                  {filteredBanks.some(b => b.source === 'flutterwave') && (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-3 mb-1 px-1">{tr('Other Banks via Flutterwave')}</p>
                  )}
                  {filteredBanks.filter(b => b.source === 'flutterwave').map((bank) => (
                    <button key={`fw-${bank.code}`} onClick={() => handleBankSelect(bank)}
                      className={cn('flex items-center gap-3 rounded-xl border p-3 transition-all text-left',
                        selectedBank?.code === bank.code ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary/30'
                      )}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                        <BankLogo logoUrl={bank.logoUrl} name={bank.name} iconClassName="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{bank.name}</p>
                        <p className="text-[10px] text-muted-foreground">{tr('Standard • Flutterwave')}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}

                  {filteredBanks.some(b => b.source === 'directory') && (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-3 mb-1 px-1">{tr('Listed Banks')}</p>
                  )}
                  {filteredBanks.filter(b => b.source === 'directory').map((bank) => (
                    <button key={`directory-${bank.code}`} onClick={() => handleBankSelect(bank)}
                      className={cn('flex items-center gap-3 rounded-xl border p-3 transition-all text-left',
                        selectedBank?.code === bank.code ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary/30'
                      )}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{bank.name}</p>
                        <p className="text-[10px] text-muted-foreground">{tr('Listed bank directory')}</p>
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
            {/* Selected source account */}
            {selectedAccount && (() => {
              const Icon = providerTypeIcon(selectedAccount.provider_type);
              return (
                <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">From: {selectedAccount.account_name || selectedAccount.provider_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedAccount.provider_name} {selectedAccount.last4 ? `•••• ${selectedAccount.last4}` : ''}
                      {method === 'bank_transfer' && selectedBank ? ` → ${selectedBank.name}` : ''}
                    </p>
                  </div>
                  <button onClick={() => setStep('source')} className="text-[10px] font-bold text-primary">{tr('Change')}</button>
                </div>
              );
            })()}

            {/* Amount Input */}
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-primary p-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/60">{tr('Deposit Amount')}</p>
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
                <Label className="text-xs font-bold">{tr('Phone Number')}</Label>
                <Input placeholder="237677123456" value={phone || selectedAccount?.account_number || ''} onChange={e => setPhone(e.target.value)} className="h-11 rounded-xl" />
              </div>
            )}
            {(method === 'card' || method === 'paypal') && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">{tr('Email')}</Label>
                <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-11 rounded-xl" />
              </div>
            )}

            {/* Fee summary */}
            {numAmount > 0 && (
              <div className="rounded-2xl bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{tr('Amount')}</span>
                  <span className="font-bold text-foreground">{fmt(numAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Fee ({(feeEstimateData.feePercent * 100).toFixed(1)}%)</span>
                  <span className="font-bold text-foreground">{fmt(fee)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="font-bold text-foreground">{tr('You receive')}</span>
                  <span className="font-extrabold text-foreground">{fmt(numAmount - fee)}</span>
                </div>
              </div>
            )}

            <Button onClick={() => setShowPin(true)} disabled={processing || !numAmount || numAmount <= 0}
              className="w-full rounded-2xl h-12 text-sm font-bold">
              {processing ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {tr('Processing...')}</span>
              ) : (
                `Pay ${numAmount > 0 ? fmt(numAmount) : ''}`
              )}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" /> End-to-end encrypted
            </p>
          </motion.div>
        ) : step === 'pay_by_bank' ? (
          <motion.div key="pay_by_bank" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/30 bg-white">
                <PayByBankLogo className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{tr('Pay by Bank — Instant Top-up')}</p>
                <p className="text-[10px] text-muted-foreground">{tr('You will be redirected to your bank to confirm.')}</p>
              </div>
            </div>

            {pbbStep === 'bank' ? (
              <>
                <div className="rounded-2xl bg-muted/50 p-4 space-y-1">
                  <p className="text-xs font-semibold text-foreground">{tr('Choose your bank')}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {tr('Search the listed banks below. If your bank is not listed, use Link an Account so support can validate availability before transfer initiation.')}
                  </p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={tr('Search listed banks...')} value={pbbBankSearch} onChange={(e) => setPbbBankSearch(e.target.value)} className="h-11 rounded-xl pl-9" />
                </div>

                <div className="flex flex-col gap-1.5 max-h-[44vh] overflow-y-auto">
                  {banksLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">{tr('Fetching listed banks...')}</p>
                    </div>
                  ) : filteredPbbBanks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 rounded-2xl border border-dashed border-border bg-muted/30">
                      <Building2 className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-xs font-semibold text-foreground">{tr('Bank not listed')}</p>
                      <p className="max-w-xs text-center text-[11px] text-muted-foreground">{tr('Check the spelling or connect the account from Linked Accounts so the bank can be reviewed.')}</p>
                      <Button asChild variant="outline" className="mt-2 rounded-xl h-9 text-xs">
                        <Link to="/app/linked-accounts">{tr('Open Linked Accounts')}</Link>
                      </Button>
                    </div>
                  ) : (
                    filteredPbbBanks.map((bank) => (
                      <button key={`pbb-${bank.source}-${bank.code}`} onClick={() => { setSelectedPbbBank(bank); setPbbStep('amount'); }}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/30">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{bank.name}</p>
                          <p className="text-[10px] text-muted-foreground">{bank.source === 'kob' ? tr('KOB Network') : bank.source === 'flutterwave' ? tr('Partner network') : tr('Listed bank directory')}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
            {selectedPbbBank && (
              <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{selectedPbbBank.name}</p>
                  <p className="text-[10px] text-muted-foreground">{tr('Selected funding bank')}</p>
                </div>
                <button onClick={() => setPbbStep('bank')} className="text-[10px] font-bold text-primary">{tr('Change')}</button>
              </div>
            )}

            <div className="flex flex-col items-center gap-2 rounded-3xl bg-primary p-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/60">{tr('Top-up Amount')}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-primary-foreground/60">XAF</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pbbAmount}
                  onChange={(e) => setPbbAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="bg-transparent text-4xl font-bold text-primary-foreground outline-none w-full text-center placeholder:text-primary-foreground/30"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {quickAmounts.map(a => (
                <button
                  key={a}
                  onClick={() => setPbbAmount(String(a))}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${pbbAmount === String(a) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
                >
                  {a.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-muted/50 p-4 space-y-1">
              <p className="text-[11px] text-muted-foreground">
                {tr('Funds are credited to your KANG wallet after your bank confirms the transfer. No fees from KOB on Pay-by-Bank top-ups.')}
              </p>
            </div>

            <Button
              onClick={handlePayByBankSubmit}
              disabled={pbbProcessing || pbbStep === 'redirecting' || !Number(pbbAmount)}
              className="w-full rounded-2xl h-12 text-sm font-bold"
            >
              {pbbProcessing || pbbStep === 'redirecting' ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {tr('Redirecting to your bank...')}</span>
              ) : (
                <span className="flex items-center gap-2"><Zap className="h-4 w-4" /> {tr('Continue to Bank')}</span>
              )}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" /> {tr('PSD2 SCA · Open Banking')}
            </p>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handleSubmit} />
    </div>
  );
};

export default CustomerFundWallet;
