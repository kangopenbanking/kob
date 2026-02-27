import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Wallet, Loader2, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
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

  // Auto-select first account
  React.useEffect(() => {
    if (accounts?.length && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const feePercent = method === 'mobile_money' ? 0.035 : method === 'card' ? 0.03 : method === 'paypal' ? 0.035 : 0.015;

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
    <div className="flex flex-col px-4 py-6 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Fund Account</h1>
          <p className="text-sm text-muted-foreground">Add money via MoMo, Card, PayPal or Bank Transfer</p>
        </div>
      </div>

      {result ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <FundingResult result={result} fmt={fmt} onSuccess={handleSuccess} />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Account Selector */}
          {accounts && accounts.length > 1 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Select Account</Label>
              <div className="flex flex-col gap-2">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                      selectedAccountId === acc.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--bank-mint))]">
                      <Wallet className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{acc.nickname || acc.account_holder_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{acc.account_id}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Payment Method</Label>
            <PaymentMethodSelector value={method} onChange={setMethod} />
          </div>

          {/* Amount */}
          <AmountInput value={amount} onChange={setAmount} feePercent={feePercent} fmt={fmt} />

          {/* Conditional Inputs */}
          {method === 'mobile_money' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Phone Number</Label>
              <Input
                type="tel"
                placeholder="e.g. 237670000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12"
              />
            </div>
          )}

          {(method === 'card' || method === 'paypal') && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Email Address</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleFund}
            disabled={loading || !selectedAccountId || !amount || Number(amount) <= 0}
            className="w-full h-13 text-base font-bold rounded-2xl"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Wallet className="h-5 w-5 mr-2" />
            )}
            {loading ? 'Processing…' : 'Fund Account'}
          </Button>

          {/* Security Note */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Secured by Kang Open Banking</span>
          </div>
        </motion.div>
      )}

      {/* Funding History */}
      <div className="mt-8">
        <FundingHistory scope="end_user" accountId={selectedAccountId} fmt={fmt} />
      </div>
    </div>
  );
};

export default BankFundAccount;
