import React, { useState } from 'react';
import { Zap, Droplets, Wifi, Tv, ArrowRight, Loader2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { BankBackButton } from '@/components/banking-app/BankBackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const billCategories = [
  {
    icon: Zap,
    label: 'Electricity',
    color: 'bg-[hsl(var(--bank-amber))]',
    fg: 'text-[hsl(var(--bank-amber-fg))]',
    providers: [
      { id: 'eneo', name: 'ENEO' },
      { id: 'aes-sonel', name: 'AES-SONEL' },
    ],
  },
  {
    icon: Droplets,
    label: 'Water',
    color: 'bg-[hsl(var(--bank-sky))]',
    fg: 'text-white',
    providers: [
      { id: 'camwater', name: 'Camwater' },
      { id: 'cde', name: 'CDE' },
    ],
  },
  {
    icon: Wifi,
    label: 'Internet',
    color: 'bg-[hsl(var(--bank-violet))]',
    fg: 'text-white',
    providers: [
      { id: 'camtel', name: 'Camtel' },
      { id: 'mtn-data', name: 'MTN Data' },
      { id: 'orange-data', name: 'Orange Data' },
    ],
  },
  {
    icon: Tv,
    label: 'TV & Cable',
    color: 'bg-[hsl(var(--bank-coral))]',
    fg: 'text-white',
    providers: [
      { id: 'canalplus', name: 'Canal+' },
      { id: 'dstv', name: 'DStv' },
    ],
  },
];

type Step = 'categories' | 'form' | 'confirm' | 'success';

const BankBills: React.FC = () => {
  const [step, setStep] = useState<Step>('categories');
  const [selectedCategory, setSelectedCategory] = useState<typeof billCategories[0] | null>(null);
  const [provider, setProvider] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');

  const handleSelectCategory = (cat: typeof billCategories[0]) => {
    setSelectedCategory(cat);
    setProvider('');
    setMeterNumber('');
    setAmount('');
    setStep('form');
  };

  const handlePayBill = async () => {
    if (!selectedCategory || !provider || !meterNumber || !amount) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-bills', {
        body: {
          category: selectedCategory.label.toLowerCase(),
          provider,
          account_number: meterNumber,
          amount: Number(amount),
          currency: 'XAF',
        },
      });
      if (error) throw error;
      setPaymentRef(data?.reference || `BIL-${Date.now()}`);
      setStep('success');
      toast.success('Bill payment successful!');
    } catch (err: any) {
      toast.error(err.message || 'Bill payment failed');
    } finally {
      setPaying(false);
    }
  };

  const reset = () => {
    setStep('categories');
    setSelectedCategory(null);
    setProvider('');
    setMeterNumber('');
    setAmount('');
    setPaymentRef('');
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <BankBackButton />
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Pay Bills</h1>
      <p className="mb-6 text-sm font-medium text-muted-foreground">Electricity, water, internet & more</p>

      {/* Step 1: Categories */}
      {step === 'categories' && (
        <div className="flex flex-col gap-3">
          {billCategories.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <motion.button
                key={cat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectCategory(cat)}
                className={`flex items-center gap-4 rounded-2xl ${cat.color} p-5 text-left`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                  <Icon className={`h-6 w-6 ${cat.fg}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className={`text-base font-bold ${cat.fg}`}>{cat.label}</p>
                  <p className={`text-sm ${cat.fg} opacity-70`}>{cat.providers.map(p => p.name).join(', ')}</p>
                </div>
                <ArrowRight className={`h-5 w-5 ${cat.fg}`} strokeWidth={1.5} />
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Step 2: Bill Form */}
      {step === 'form' && selectedCategory && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
          <button onClick={() => setStep('categories')} className="mb-1 text-left text-sm font-semibold text-primary">← Change category</button>

          <div className={`flex items-center gap-3 rounded-2xl ${selectedCategory.color} p-4`}>
            {React.createElement(selectedCategory.icon, { className: `h-6 w-6 ${selectedCategory.fg}`, strokeWidth: 1.5 })}
            <span className={`text-lg font-bold ${selectedCategory.fg}`}>{selectedCategory.label}</span>
          </div>

          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                {selectedCategory.providers.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Meter / Account Number</Label>
            <Input value={meterNumber} onChange={e => setMeterNumber(e.target.value)} placeholder="Enter your meter or account number" />
          </div>

          <div className="space-y-2">
            <Label>Amount (XAF)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="text-xl font-bold text-center h-14" />
          </div>

          <Button onClick={() => setStep('confirm')} disabled={!provider || !meterNumber || !amount} className="mt-2 gap-2" size="lg">
            Review Payment <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </motion.div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && selectedCategory && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
          <button onClick={() => setStep('form')} className="mb-1 text-left text-sm font-semibold text-primary">← Edit details</button>

          <div className="rounded-2xl border bg-card p-5">
            <h3 className="mb-4 text-base font-bold text-foreground">Payment Summary</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Category', value: selectedCategory.label },
                { label: 'Provider', value: selectedCategory.providers.find(p => p.id === provider)?.name || provider },
                { label: 'Account Number', value: meterNumber },
                { label: 'Amount', value: `XAF ${Number(amount).toLocaleString()}` },
                { label: 'Fee', value: 'XAF 0' },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-semibold text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handlePayBill} disabled={paying} className="gap-2" size="lg">
            {paying ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : 'Confirm & Pay'}
          </Button>
        </motion.div>
      )}

      {/* Step 4: Success */}
      {step === 'success' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-5 py-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--bank-mint))]">
            <Check className="h-10 w-10 text-[hsl(var(--bank-mint-fg))]" strokeWidth={2} />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">Payment Successful!</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your bill has been paid</p>
          </div>
          <div className="w-full rounded-2xl border bg-card p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono font-semibold text-foreground">{paymentRef}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-bold text-foreground">XAF {Number(amount).toLocaleString()}</span>
            </div>
          </div>
          <Button onClick={reset} variant="outline" className="w-full">Pay Another Bill</Button>
        </motion.div>
      )}
    </div>
  );
};

export default BankBills;
