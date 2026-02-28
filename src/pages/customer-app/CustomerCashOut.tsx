import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, MapPin, Smartphone, Building2, CheckCircle2, CreditCard, Wallet, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CashOutMethod {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  fields: { key: string; label: string; placeholder: string; type?: string; optional?: boolean }[];
}

const allMethods: CashOutMethod[] = [
  {
    key: 'bank_transfer', label: 'Bank Transfer', description: 'Withdraw to your bank account',
    icon: Building2, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]',
    fields: [
      { key: 'bankName', label: 'Bank Name', placeholder: 'e.g. Afriland First Bank' },
      { key: 'accountNumber', label: 'Account Number', placeholder: 'Enter account number' },
      { key: 'accountName', label: 'Account Holder Name', placeholder: 'Full name on account' },
    ],
  },
  {
    key: 'mobile_money', label: 'Mobile Money', description: 'Withdraw to MoMo wallet',
    icon: Smartphone, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]',
    fields: [
      { key: 'provider', label: 'Provider', placeholder: 'MTN MoMo / Orange Money' },
      { key: 'phoneNumber', label: 'Phone Number', placeholder: '+237 6XX XXX XXX', type: 'tel' },
      { key: 'accountName', label: 'Account Name', placeholder: 'Name on MoMo account' },
    ],
  },
  {
    key: 'paypal', label: 'PayPal', description: 'Withdraw to PayPal account',
    icon: Wallet, color: 'bg-[hsl(210,70%,90%)]', iconColor: 'text-[hsl(210,70%,50%)]',
    fields: [
      { key: 'paypalEmail', label: 'PayPal Email', placeholder: 'your@email.com', type: 'email' },
      { key: 'confirmEmail', label: 'Confirm Email', placeholder: 'Confirm PayPal email', type: 'email' },
    ],
  },
  {
    key: 'agent', label: 'Agent Cashout', description: 'Withdraw at a nearby agent',
    icon: MapPin, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]',
    fields: [
      { key: 'agentCode', label: 'Agent Code', placeholder: 'Enter agent code (optional)', optional: true },
    ],
  },
];

const CustomerCashOut: React.FC = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<'method' | 'details'>('method');

  // Fetch admin-managed cash out config
  const { data: enabledMethods } = useQuery({
    queryKey: ['cashout-config'],
    queryFn: async () => {
      return allMethods.map(m => m.key);
    },
    },
  });

  const availableMethods = allMethods.filter(m => enabledMethods?.includes(m.key));
  const currentMethod = allMethods.find(m => m.key === selectedMethod);

  const handleSelectMethod = (key: string) => {
    setSelectedMethod(key);
    setFormData({});
    setStep('details');
  };

  const handleCashOut = () => {
    if (!amount || Number(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!currentMethod) return;
    // Validate required fields
    for (const field of currentMethod.fields) {
      if (!field.optional && !formData[field.key]?.trim()) {
        toast.error(`Enter ${field.label.toLowerCase()}`);
        return;
      }
    }
    // PayPal email confirmation
    if (selectedMethod === 'paypal' && formData.paypalEmail !== formData.confirmEmail) {
      toast.error('PayPal emails do not match'); return;
    }
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setDone(true);
      toast.success(`Cash out of XAF ${Number(amount).toLocaleString()} via ${currentMethod.label} initiated`);
      setTimeout(() => {
        setDone(false);
        setAmount('');
        setSelectedMethod(null);
        setFormData({});
        setStep('method');
      }, 2500);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => { if (step === 'details') { setStep('method'); setSelectedMethod(null); } else navigate(-1); }}>
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Cash Out</h1>
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
              <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-bold text-foreground">Cash Out Initiated!</p>
            <p className="text-sm text-muted-foreground">XAF {Number(amount || 0).toLocaleString()} via {currentMethod?.label}</p>
          </motion.div>
        ) : step === 'method' ? (
          <motion.div key="method" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            {/* Amount Input */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 rounded-3xl bg-[hsl(25,60%,35%)] p-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60">Withdrawal Amount</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-[hsl(0,0%,100%)]/60">XAF</span>
                <input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0" className="bg-transparent text-4xl font-bold text-[hsl(0,0%,100%)] outline-none w-full text-center placeholder:text-[hsl(0,0%,100%)]/30" />
              </div>
            </motion.div>

            {/* Methods */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Withdrawal Method</p>

            {availableMethods.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(0,60%,93%)]">
                  <AlertCircle className="h-6 w-6 text-[hsl(0,60%,50%)]" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-bold text-foreground">No Cash Out Methods Available</p>
                <p className="text-xs text-muted-foreground">Cash out is currently disabled by your institution.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableMethods.map((m) => (
                  <button key={m.key} onClick={() => handleSelectMethod(m.key)}
                    className="flex w-full items-center gap-3 rounded-3xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary active:scale-[0.98]">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${m.color}`}>
                      <m.icon className={`h-5 w-5 ${m.iconColor}`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{m.label}</p>
                      <p className="text-[11px] text-muted-foreground">{m.description}</p>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-5">
            {/* Selected method header */}
            {currentMethod && (
              <div className="flex items-center gap-3 rounded-3xl bg-card border-2 border-border p-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${currentMethod.color}`}>
                  <currentMethod.icon className={`h-5 w-5 ${currentMethod.iconColor}`} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{currentMethod.label}</p>
                  <p className="text-[11px] text-muted-foreground">{currentMethod.description}</p>
                </div>
              </div>
            )}

            {/* Amount display */}
            <div className="rounded-2xl bg-muted p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount</p>
              <p className="text-xl font-bold text-foreground">XAF {Number(amount || 0).toLocaleString()}</p>
            </div>

            {/* Form fields */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{currentMethod?.label} Details</p>
              {currentMethod?.fields.map(field => (
                <div key={field.key} className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">{field.label}</label>
                  <Input
                    type={field.type || 'text'}
                    value={formData[field.key] || ''}
                    onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="rounded-xl"
                  />
                </div>
              ))}
            </div>

            {/* Fee notice */}
            <div className="flex items-start gap-2 rounded-2xl bg-[hsl(45,70%,90%)] p-3">
              <AlertCircle className="h-4 w-4 text-[hsl(45,60%,35%)] mt-0.5 shrink-0" strokeWidth={1.5} />
              <p className="text-[11px] text-[hsl(45,60%,35%)]">A processing fee may apply. The exact fee will be shown before confirmation.</p>
            </div>

            <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={!amount || processing} onClick={handleCashOut}>
              {processing ? (
                <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Processing...</span>
              ) : (
                <><Banknote className="mr-2 h-4 w-4" strokeWidth={1.5} /> Confirm Cash Out</>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerCashOut;
