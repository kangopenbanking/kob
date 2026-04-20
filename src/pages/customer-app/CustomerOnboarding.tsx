import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, Landmark, Smartphone, Wallet, CreditCard, Globe, Ban,
  ArrowLeft, Check, Loader2, AlertCircle, Eye, Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

/* ─── Account type definitions matching CustomerLinkedAccounts ─── */

type AccountType = 'bank_account' | 'bank_iban' | 'momo_mtn' | 'momo_orange' | 'paypal' | 'bank_card' | 'none';

interface AccountOption {
  id: AccountType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  providerType: string;
}

const accountOptions: AccountOption[] = [
  {
    id: 'bank_account', label: 'Bank Account (RIB)',
    description: 'Link via 23-digit Cameroon RIB',
    icon: Building2, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', providerType: 'bank',
  },
  {
    id: 'bank_iban', label: 'International (IBAN)',
    description: 'Link via IBAN for international transfers',
    icon: Globe, color: 'bg-[hsl(270,50%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]', providerType: 'bank',
  },
  {
    id: 'momo_mtn', label: 'MTN MoMo',
    description: 'Link your MTN Mobile Money account',
    icon: Smartphone, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]', providerType: 'mobile_money',
  },
  {
    id: 'momo_orange', label: 'Orange Money',
    description: 'Link your Orange Mobile Money account',
    icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]', providerType: 'mobile_money',
  },
  {
    id: 'bank_card', label: 'Credit / Debit Card',
    description: 'Link a Visa, Mastercard or Amex card',
    icon: CreditCard, color: 'bg-[hsl(225,70%,92%)]', iconColor: 'text-[hsl(225,60%,50%)]', providerType: 'card',
  },
  {
    id: 'paypal', label: 'PayPal',
    description: 'Link your PayPal account',
    icon: Wallet, color: 'bg-[hsl(210,70%,90%)]', iconColor: 'text-[hsl(210,70%,50%)]', providerType: 'paypal',
  },
  {
    id: 'none', label: 'No Account (View Only)',
    description: 'Browse the app without linking — limited access',
    icon: Eye, color: 'bg-muted', iconColor: 'text-muted-foreground', providerType: 'none',
  },
];

/* ─── Bank list (Cameroon) ─── */
const CM_BANKS = [
  { code: '10005', name: 'Afriland First Bank' },
  { code: '10009', name: 'Atlantic Bank Cameroon' },
  { code: '10017', name: 'Ecobank Cameroon' },
  { code: '10029', name: 'BICEC' },
  { code: '10033', name: 'Société Générale Cameroun' },
  { code: '10038', name: 'UBA Cameroon' },
  { code: '10041', name: 'CBC' },
  { code: '10050', name: 'BGFI Bank Cameroon' },
  { code: '10039', name: 'NFC Bank' },
  { code: '10060', name: 'National Financial Credit Bank' },
];

const CARD_NETWORKS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
];

/* ─── Formatting helpers ─── */
const formatRib = (v: string) => {
  const d = v.replace(/\D/g, '').substring(0, 23);
  if (d.length <= 5) return d;
  if (d.length <= 10) return `${d.substring(0, 5)}-${d.substring(5)}`;
  if (d.length <= 21) return `${d.substring(0, 5)}-${d.substring(5, 10)}-${d.substring(10)}`;
  return `${d.substring(0, 5)}-${d.substring(5, 10)}-${d.substring(10, 21)}-${d.substring(21)}`;
};

const formatIban = (v: string) => {
  const c = v.replace(/\s/g, '').toUpperCase().substring(0, 34);
  return c.match(/.{1,4}/g)?.join(' ') || c;
};

const formatCard = (v: string) => {
  const d = v.replace(/\D/g, '').substring(0, 16);
  return d.match(/.{1,4}/g)?.join(' ') || d;
};

const formatPhone = (v: string) => {
  let c = v.replace(/[^\d+]/g, '');
  if (!c.startsWith('+')) c = '+' + c;
  return c.substring(0, 16);
};

/* ─── Steps ─── */
type Step = 'select' | 'details' | 'confirming';

const CustomerOnboarding: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shared fields
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  // Bank-specific
  const [bankCode, setBankCode] = useState('');
  // Card-specific
  const [cardNetwork, setCardNetwork] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');

  const resetFields = () => {
    setAccountName('');
    setAccountNumber('');
    setBankCode('');
    setCardNetwork('');
    setCardExpMonth('');
    setCardExpYear('');
    setError(null);
  };

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

  const handleBack = () => {
    if (step === 'details') {
      setStep('select');
      resetFields();
    } else {
      navigate('/app/auth');
    }
  };

  const isDetailsValid = () => {
    if (!accountNumber.trim()) return false;
    if (selected === 'bank_account' && !bankCode) return false;
    if (selected === 'bank_card' && (!cardNetwork || !cardExpMonth || !cardExpYear)) return false;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setStep('confirming');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update profile
      await supabase
        .from('profiles')
        .update({ linked_account_type: selected } as any)
        .eq('id', user.id);

      // Insert linked account record
      if (selected !== 'none') {
        const raw = accountNumber.replace(/[\s\-]/g, '');
        const last4 = raw.slice(-4);
        const option = accountOptions.find(o => o.id === selected)!;
        const bankName = selected === 'bank_account' ? CM_BANKS.find(b => b.code === bankCode)?.name : undefined;

        const metadata: Record<string, any> = {};
        if (selected === 'bank_account') {
          metadata.rib_bank_code = bankCode;
          metadata.rib_branch_code = raw.substring(5, 10);
          metadata.rib_account = raw.substring(10, 21);
          metadata.rib_key = raw.substring(21, 23);
          metadata.identifier_type = 'RIB';
        }
        if (selected === 'bank_iban') {
          metadata.identifier_type = 'IBAN';
        }
        if (selected === 'bank_card') {
          metadata.card_network = cardNetwork;
          metadata.card_exp_month = parseInt(cardExpMonth, 10);
          metadata.card_exp_year = parseInt(cardExpYear, 10) < 100 ? 2000 + parseInt(cardExpYear, 10) : parseInt(cardExpYear, 10);
          metadata.card_type = 'debit';
        }

        const providerName =
          selected === 'bank_account' ? (bankName || 'Bank') :
          selected === 'bank_iban' ? 'International Bank' :
          selected === 'momo_mtn' ? 'MTN Mobile Money' :
          selected === 'momo_orange' ? 'Orange Money' :
          selected === 'bank_card' ? (CARD_NETWORKS.find(n => n.value === cardNetwork)?.label || 'Card') :
          selected === 'paypal' ? 'PayPal' : 'Unknown';

        const validDocTypes = ['bank_account', 'bank_iban', 'momo_mtn', 'momo_orange', 'bank_card', 'paypal'];
        if (!validDocTypes.includes(selected)) throw new Error('Invalid account type');

        await supabase.from('customer_linked_accounts' as any).insert({
          user_id: user.id,
          account_type: selected,
          account_number: selected === 'bank_card' ? last4 : raw,
          account_name: accountName || null,
          provider_name: providerName,
          provider_type: option.providerType,
          last4,
          is_primary: true,
          is_active: true,
          status: 'active',
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        } as any);
      }

      toast.success(selected === 'none' ? 'Browsing in view-only mode' : 'Account linked successfully!');
      navigate('/app/home', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to complete setup');
      setStep(selected === 'none' ? 'select' : 'details');
      toast.error(extractEdgeFunctionError(err, 'Setup failed'));
    } finally {
      setLoading(false);
    }
  };

  const selectedOption = accountOptions.find(o => o.id === selected);

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  /* ─── Render the detail fields per type ─── */
  const renderFields = () => {
    switch (selected) {
      case 'bank_account':
        return (
          <>
            <Field label="Account Holder Name">
              <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Full name on account" className="h-14 rounded-2xl text-base" />
            </Field>
            <Field label="Bank">
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger className="h-14 rounded-2xl text-base"><SelectValue placeholder="Select your bank" /></SelectTrigger>
                <SelectContent>
                  {CM_BANKS.map(b => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="RIB Number (23 digits)">
              <Input value={accountNumber} onChange={e => setAccountNumber(formatRib(e.target.value))} placeholder="10005-00100-01234567890-23" className="h-14 rounded-2xl text-base font-mono" />
            </Field>
          </>
        );
      case 'bank_iban':
        return (
          <>
            <Field label="Account Holder Name">
              <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Full name on account" className="h-14 rounded-2xl text-base" />
            </Field>
            <Field label="IBAN">
              <Input value={accountNumber} onChange={e => setAccountNumber(formatIban(e.target.value))} placeholder="CM21 1000 5001 0001 2345 6789 023" className="h-14 rounded-2xl text-base font-mono" />
            </Field>
          </>
        );
      case 'momo_mtn':
      case 'momo_orange':
        return (
          <>
            <Field label="Account Name">
              <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Name on MoMo account" className="h-14 rounded-2xl text-base" />
            </Field>
            <Field label="Phone Number">
              <Input value={accountNumber} onChange={e => setAccountNumber(formatPhone(e.target.value))} placeholder="+237 6XX XXX XXX" type="tel" className="h-14 rounded-2xl text-base" />
            </Field>
          </>
        );
      case 'bank_card':
        return (
          <>
            <Field label="Cardholder Name">
              <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Name on card" className="h-14 rounded-2xl text-base" />
            </Field>
            <Field label="Card Number">
              <Input value={accountNumber} onChange={e => setAccountNumber(formatCard(e.target.value))} placeholder="4242 4242 4242 4242" className="h-14 rounded-2xl text-base font-mono" />
            </Field>
            <Field label="Card Network">
              <Select value={cardNetwork} onValueChange={setCardNetwork}>
                <SelectTrigger className="h-14 rounded-2xl text-base"><SelectValue placeholder="Select network" /></SelectTrigger>
                <SelectContent>
                  {CARD_NETWORKS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex gap-3">
              <Field label="Exp Month" className="flex-1">
                <Input value={cardExpMonth} onChange={e => setCardExpMonth(e.target.value.replace(/\D/g, '').substring(0, 2))} placeholder="MM" className="h-14 rounded-2xl text-base text-center" maxLength={2} />
              </Field>
              <Field label="Exp Year" className="flex-1">
                <Input value={cardExpYear} onChange={e => setCardExpYear(e.target.value.replace(/\D/g, '').substring(0, 2))} placeholder="YY" className="h-14 rounded-2xl text-base text-center" maxLength={2} />
              </Field>
            </div>
          </>
        );
      case 'paypal':
        return (
          <>
            <Field label="PayPal Name">
              <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Full name on PayPal" className="h-14 rounded-2xl text-base" />
            </Field>
            <Field label="PayPal Email">
              <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="your@email.com" type="email" className="h-14 rounded-2xl text-base" />
            </Field>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-5">
        <button onClick={handleBack} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 px-5 pb-28">
        <AnimatePresence mode="wait">
          {/* ─── Step 1: Select Account Type ─── */}
          {step === 'select' && (
            <motion.div key="select" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
              <h1 className="mb-1 text-xl font-bold text-foreground">Link Your Account</h1>
              <p className="mb-6 text-sm text-muted-foreground">Choose how you'd like to manage your money on Kang</p>

              <div className="space-y-2.5">
                {accountOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selected === option.id;
                  const isViewOnly = option.id === 'none';
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelect(option.id)}
                      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? isViewOnly
                            ? 'border-amber-500/60 bg-amber-50/50 dark:bg-amber-950/20'
                            : 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${option.color}`}>
                        <Icon className={`h-5 w-5 ${option.iconColor}`} strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{option.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                      </div>
                      {isSelected && (
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isViewOnly ? 'bg-amber-500' : 'bg-primary'}`}>
                          <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* View-only notice */}
              {selected === 'none' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 p-4"
                >
                  <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">View-Only Mode</p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">
                      You can browse your dashboard but sending money, funding your wallet, and other financial features will be disabled until you link a payment account from <span className="font-semibold">Accounts</span>.
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ─── Step 2: Account Details ─── */}
          {step === 'details' && selectedOption && (
            <motion.div key="details" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${selectedOption.color}`}>
                  <selectedOption.icon className={`h-6 w-6 ${selectedOption.iconColor}`} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{selectedOption.label}</p>
                  <p className="text-xs text-muted-foreground">Enter your account details</p>
                </div>
              </div>

              {renderFields()}

              {error && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Step 3: Confirming ─── */}
          {step === 'confirming' && (
            <motion.div key="confirming" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="flex flex-col items-center gap-4 pt-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-semibold text-foreground">Setting up your account…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      {step !== 'confirming' && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border p-5">
          <Button
            onClick={step === 'select' ? handleContinue : handleSubmit}
            disabled={
              !selected || loading ||
              (step === 'details' && !isDetailsValid())
            }
            className="h-14 w-full rounded-2xl text-base font-semibold"
            size="lg"
            variant={selected === 'none' ? 'outline' : 'default'}
          >
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {step === 'select' && selected === 'none'
              ? 'Continue Without Account'
              : step === 'select'
                ? 'Continue'
                : 'Link Account'}
          </Button>
        </div>
      )}
    </div>
  );
};

/* ─── Tiny label wrapper ─── */
const Field = ({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
    {children}
  </div>
);

export default CustomerOnboarding;
