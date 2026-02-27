import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Wallet, Loader2, Shield, Sparkles, TrendingUp, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useBankAccounts } from '@/hooks/useBankingData';
import { PaymentMethodSelector } from '@/components/funding/PaymentMethodSelector';
import { AmountInput } from '@/components/funding/AmountInput';
import { FundingResult } from '@/components/funding/FundingResult';
import { FundingHistory } from '@/components/funding/FundingHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

const BankFundAccount: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const { data: accounts, isLoading: accountsLoading } = useBankAccounts();

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [method, setMethod] = useState('mobile_money');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  React.useEffect(() => {
    if (accounts?.length && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const feePercent = method === 'mobile_money' ? 0.035 : method === 'card' ? 0.03 : method === 'paypal' ? 0.035 : 0.015;

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);

  const handleFund = async () => {
    if (!selectedAccountId) { toast.error('Select an account to fund'); return; }
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (method === 'mobile_money' && !phone) { toast.error('Phone number required for Mobile Money'); return; }

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
          return_url: `${window.location.origin}/bank/${institutionId}/fund`,
        },
      });
      if (error) throw error;
      setResult(data);
      toast.success('Funding intent created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create funding intent');
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
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-5 pb-8 pt-6"
      >
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-white/5" />
        <div className="absolute right-12 bottom-4 h-12 w-12 rounded-full bg-white/10" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5 text-primary-foreground" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-primary-foreground">Fund Account</h1>
          <p className="mt-1 text-sm text-primary-foreground/70">Add money via MoMo, Card, PayPal or Transfer</p>

          {/* Selected account mini-card */}
          {selectedAccount && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-5 flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-sm p-3.5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-primary-foreground truncate">
                  {selectedAccount.nickname || selectedAccount.account_holder_name}
                </p>
                <p className="text-xs text-primary-foreground/60 font-mono">{selectedAccount.account_id}</p>
              </div>
              <div className="flex items-center gap-1 text-primary-foreground/50">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Main Content - pulled up with negative margin for overlap effect */}
      <div className="flex-1 px-4 -mt-3">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-6 pt-1"
            >
              <FundingResult result={result} fmt={fmt} onSuccess={handleSuccess} />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-4 pt-1"
            >
              {/* Account Selector Card */}
              {accounts && accounts.length > 1 && (
                <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                    Select Account
                  </Label>
                  <div className="flex flex-col gap-2">
                    {accounts.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
                          selectedAccountId === acc.id
                            ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                            : 'border-border/40 bg-background hover:border-primary/30 hover:bg-muted/30'
                        }`}
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                          selectedAccountId === acc.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          <Wallet className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{acc.nickname || acc.account_holder_name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{acc.account_id}</p>
                        </div>
                        {selectedAccountId === acc.id && (
                          <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Method Card */}
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
                  Payment Method
                </Label>
                <PaymentMethodSelector value={method} onChange={setMethod} />
              </div>

              {/* Amount Card */}
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                <AmountInput value={amount} onChange={setAmount} feePercent={feePercent} fmt={fmt} />
              </div>

              {/* Conditional Inputs Card */}
              <AnimatePresence mode="wait">
                {method === 'mobile_money' && (
                  <motion.div
                    key="phone"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Phone Number
                      </Label>
                      <Input
                        type="tel"
                        placeholder="e.g. 237670000000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-12 rounded-xl border-border/60 bg-background text-base font-medium"
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
                    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                        Email Address
                      </Label>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 rounded-xl border-border/60 bg-background text-base font-medium"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Button
                  onClick={handleFund}
                  disabled={loading || !selectedAccountId || !amount || Number(amount) <= 0}
                  className="w-full h-14 text-base font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
                  size="lg"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Wallet className="h-5 w-5 mr-2" />
                  )}
                  {loading ? 'Processing…' : 'Fund Account'}
                  {!loading && <ChevronRight className="h-4 w-4 ml-auto opacity-60" />}
                </Button>
              </motion.div>

              {/* Security Badge */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground">Secured by Kang Open Banking</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Funding History */}
        <div className="mt-6 pb-8">
          <FundingHistory scope="end_user" accountId={selectedAccountId} fmt={fmt} />
        </div>
      </div>
    </div>
  );
};

export default BankFundAccount;
