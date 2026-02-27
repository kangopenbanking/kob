import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Landmark, Smartphone, Wallet, Ban, ArrowLeft, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type AccountType = 'bank_account' | 'credit_union' | 'momo_orange' | 'momo_mtn' | 'none';

interface AccountOption {
  id: AccountType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const accountOptions: AccountOption[] = [
  { id: 'bank_account', label: 'Bank Account', description: 'Link your existing bank account', icon: Building2, color: 'bg-[hsl(210,80%,93%)]' },
  { id: 'credit_union', label: 'Credit Union', description: 'Connect your credit union membership', icon: Landmark, color: 'bg-[hsl(150,40%,90%)]' },
  { id: 'momo_orange', label: 'Orange Money', description: 'Link your Orange Mobile Money', icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]' },
  { id: 'momo_mtn', label: 'MTN MoMo', description: 'Link your MTN Mobile Money', icon: Wallet, color: 'bg-[hsl(50,80%,90%)]' },
  { id: 'none', label: 'No Account', description: 'Browse in view-only mode', icon: Ban, color: 'bg-muted' },
];

type Step = 'select' | 'details' | 'confirming';

const CustomerOnboarding: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState<AccountType | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (type: AccountType) => {
    setSelected(type);
    setError(null);
  };

  const handleContinue = () => {
    if (!selected) return;
    if (selected === 'none') {
      handleSubmit();
    } else {
      setStep('details');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setStep('confirming');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update profile with linked account type
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          linked_account_type: selected,
          ...(selected !== 'none' && accountNumber ? {
            linked_account_number: accountNumber,
            linked_account_name: accountName,
          } : {}),
        } as any)
        .eq('id', user.id);

      if (updateError) throw updateError;

      // If not 'none', also insert into customer_linked_accounts
      if (selected !== 'none') {
        await supabase.from('customer_linked_accounts' as any).insert({
          user_id: user.id,
          institution_id: institutionId,
          account_type: selected,
          account_number: accountNumber || null,
          account_name: accountName || null,
          is_primary: true,
        } as any);
      }

      toast.success(selected === 'none' ? 'Browsing in view-only mode' : 'Account linked successfully');
      navigate(`/app/${institutionId}/home`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to complete setup');
      setStep('details');
      toast.error(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'details') {
      setStep('select');
      setAccountNumber('');
      setAccountName('');
    } else {
      // Can't go back from select — maybe go to auth
      navigate(`/app/${institutionId}/auth`);
    }
  };

  const selectedOption = accountOptions.find((o) => o.id === selected);

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-5">
        <button onClick={handleBack} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 px-5">
        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div key="select" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <h1 className="mb-1 text-xl font-bold text-foreground">Link Your Account</h1>
              <p className="mb-6 text-sm text-muted-foreground">Select how you manage your money</p>

              <div className="space-y-3">
                {accountOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selected === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelect(option.id)}
                      className={`flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition-all ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${option.color}`}>
                        <Icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                      {isSelected && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <Check className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 'details' && selectedOption && (
            <motion.div key="details" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selectedOption.color}`}>
                  <selectedOption.icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{selectedOption.label}</p>
                  <p className="text-xs text-muted-foreground">Enter your account details</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {selected === 'momo_orange' || selected === 'momo_mtn' ? 'Phone Number' : 'Account Number'}
                </p>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={selected === 'momo_orange' || selected === 'momo_mtn' ? '+237 6XX XXX XXX' : 'Enter account number'}
                  className="h-14 rounded-2xl text-base"
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Account Holder Name</p>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Full name on account"
                  className="h-14 rounded-2xl text-base"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </motion.div>
          )}

          {step === 'confirming' && (
            <motion.div key="confirming" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="flex flex-col items-center gap-4 pt-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-semibold text-foreground">Setting up your account...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      {step !== 'confirming' && (
        <div className="p-5">
          <Button
            onClick={step === 'select' ? handleContinue : handleSubmit}
            disabled={!selected || loading || (step === 'details' && !accountNumber)}
            className="h-14 w-full rounded-2xl text-base font-semibold"
            size="lg"
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            {step === 'select' && selected === 'none' ? 'Continue in View-Only Mode' : step === 'select' ? 'Continue' : 'Link Account'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CustomerOnboarding;
