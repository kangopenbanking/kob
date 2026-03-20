import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Wallet, Loader2, Shield, Smartphone, CreditCard, Globe, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useBankAccounts } from '@/hooks/useBankingData';
import { useFeeEstimate } from '@/hooks/useFeeEstimate';
import { AmountInput } from '@/components/funding/AmountInput';
import { FundingResult } from '@/components/funding/FundingResult';
import { FundingHistory } from '@/components/funding/FundingHistory';
import { BankSelector } from '@/components/funding/BankSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { API_CONFIG } from '@/config/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

const paymentMethods = [
  {
    value: 'mobile_money',
    label: 'Mobile Money',
    subtitle: 'MTN · Orange',
    icon: Smartphone,
    bg: 'bg-amber-500',
    shadow: 'shadow-amber-500/25',
  },
  {
    value: 'card',
    label: 'Card',
    subtitle: 'Visa · Mastercard',
    icon: CreditCard,
    bg: 'bg-emerald-500',
    shadow: 'shadow-emerald-500/25',
  },
  {
    value: 'paypal',
    label: 'PayPal',
    subtitle: 'PayPal Account',
    icon: Globe,
    bg: 'bg-sky-500',
    shadow: 'shadow-sky-500/25',
  },
  {
    value: 'bank_transfer',
    label: 'Transfer',
    subtitle: 'Wire Transfer',
    icon: Building2,
    bg: 'bg-violet-500',
    shadow: 'shadow-violet-500/25',
  },
] as const;

const BankFundAccount: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const { data: accounts } = useBankAccounts();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [method, setMethod] = useState('mobile_money');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [selectedBankName, setSelectedBankName] = useState('');
  const [selectedBankSource, setSelectedBankSource] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [showPin, setShowPin] = useState(false);

  React.useEffect(() => {
    if (accounts?.length && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const { fee: feeData, isLoading: feeLoading } = useFeeEstimate({ channel: method, amount: Number(amount), scope: "institution", institutionId });
  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);
  const selectedMethod = paymentMethods.find(m => m.value === method)!;

  const handleFund = () => {
    if (!selectedAccountId) { toast.error('Please select an account to receive the funds'); return; }
    if (!amount || Number(amount) <= 0) { toast.error('Please enter an amount greater than 0 XAF'); return; }
    if (method === 'mobile_money' && !phone) { toast.error('Enter your Mobile Money phone number to continue'); return; }
    setShowPin(true);
  };

  const executeFund = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('gateway-create-funding-intent', {
        body: {
          amount: Number(amount),
          currency: 'XAF',
          method,
          funding_scope: 'end_user',
          account_id: selectedAccountId,
          customer: { phone, email },
          return_url: `${API_CONFIG.SITE_URL}/bank/${institutionId}/fund`,
        },
      });
      if (error) throw error;
      setResult(data);
      toast.success(`${Number(amount).toLocaleString()} XAF funding request initiated. Follow the payment instructions to complete.`);
    } catch (err: any) {
      toast.error(err.message || 'Could not initiate funding. Please try again later.');
    }
    setLoading(false);
  };

  const handleSuccess = () => {
    setResult(null);
    setAmount('');
    setPhone('');
    setEmail('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted transition-colors hover:bg-muted/80"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Fund Account</h1>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="px-4 space-y-6 pt-2 pb-28"
          >
            <FundingResult result={result} fmt={fmt} onSuccess={handleSuccess} />
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 pb-28"
          >
            {/* Payment Method Slider */}
            <div className="px-4 mb-1">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Payment Method
              </Label>
            </div>
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-none snap-x snap-mandatory"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
            >
              {paymentMethods.map((m) => {
                const Icon = m.icon;
                const active = method === m.value;
                return (
                  <motion.button
                    key={m.value}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setMethod(m.value)}
                    className={`snap-start shrink-0 flex flex-col items-start justify-between rounded-3xl p-5 w-[150px] h-[180px] transition-all duration-300 ${
                      active
                        ? `${m.bg} text-white shadow-xl ${m.shadow} scale-[1.02]`
                        : `${m.bg}/15 text-foreground hover:${m.bg}/25`
                    }`}
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      active ? 'bg-white/20' : `${m.bg}/20`
                    }`}>
                      <Icon className={`h-6 w-6 ${active ? 'text-white' : ''}`} style={!active ? { opacity: 0.7 } : {}} />
                    </div>
                    <div className="text-left mt-auto">
                      <p className={`text-sm font-extrabold leading-tight ${active ? 'text-white' : ''}`}>
                        {m.label}
                      </p>
                      <p className={`text-[10px] mt-1 leading-tight font-medium ${active ? 'text-white/70' : 'text-muted-foreground'}`}>
                        {m.subtitle}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="px-4 space-y-4 mt-2">
              {/* Account Dropdown */}
              {accounts && accounts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Account
                  </Label>
                  <div className="relative">
                    <button
                      onClick={() => setAccountOpen(!accountOpen)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-left transition-all hover:border-primary/40"
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selectedMethod.bg}`}>
                        <Wallet className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {selectedAccount?.nickname || selectedAccount?.account_holder_name || 'Select account'}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {selectedAccount?.account_id || '—'}
                        </p>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {accountOpen && accounts.length > 1 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -4, height: 0 }}
                          className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl"
                        >
                          {accounts.map((acc) => (
                            <button
                              key={acc.id}
                              onClick={() => { setSelectedAccountId(acc.id); setAccountOpen(false); }}
                              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                                selectedAccountId === acc.id
                                  ? 'bg-primary/5'
                                  : 'hover:bg-muted/50'
                              }`}
                            >
                              <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {acc.nickname || acc.account_holder_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">{acc.account_id}</p>
                              </div>
                              {selectedAccountId === acc.id && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <AmountInput value={amount} onChange={setAmount} feeData={feeData} feeLoading={feeLoading} fmt={fmt} />
              </div>

              {/* Conditional Fields */}
              <AnimatePresence mode="wait">
                {method === 'mobile_money' && (
                  <motion.div
                    key="phone"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Phone Number
                      </Label>
                      <Input
                        type="tel"
                        placeholder="e.g. 237670000000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-13 rounded-2xl border-border/60 bg-card text-base font-bold placeholder:font-normal"
                      />
                    </div>
                  </motion.div>
                )}
                {(method === 'card' || method === 'paypal') && (
                  <motion.div
                    key="email"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Email Address
                      </Label>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-13 rounded-2xl border-border/60 bg-card text-base font-bold placeholder:font-normal"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <Button
                onClick={handleFund}
                disabled={loading || !selectedAccountId || !amount || Number(amount) <= 0}
                className="w-full h-14 text-base font-extrabold rounded-2xl shadow-lg shadow-primary/20"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Wallet className="h-5 w-5 mr-2" />
                )}
                {loading ? 'Processing…' : `Fund ${amount ? fmt(Number(amount)) : 'Account'}`}
                {!loading && <ChevronRight className="h-4 w-4 ml-auto opacity-60" />}
              </Button>

              {/* Security */}
              <div className="flex justify-center py-1">
                <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground">Secured by Kang Open Banking</span>
                </div>
              </div>
            </div>

            {/* History */}
            <div className="px-4 mt-6">
              <FundingHistory scope="end_user" accountId={selectedAccountId} fmt={fmt} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={executeFund} />
    </div>
  );
};

export default BankFundAccount;
