import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Smartphone, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { useMobileMoneyCharge } from '@/hooks/useBankingData';

const providers = [
  { id: 'mtn', name: 'MTN MoMo', color: 'bg-yellow-500' },
  { id: 'orange', name: 'Orange Money', color: 'bg-orange-500' },
];

const BankMobileMoney: React.FC = () => {
  const navigate = useNavigate();
  const [selectedProvider, setSelectedProvider] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const momoCharge = useMobileMoneyCharge();

  const handleSend = () => {
    momoCharge.mutate({
      phone_number: phone,
      amount: Number(amount),
      currency: 'XAF',
      provider: selectedProvider,
    }, {
      onSuccess: () => navigate(-1),
    });
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Mobile Money</h1>
      <p className="mb-6 text-sm text-muted-foreground">Send to MTN MoMo or Orange Money</p>

      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label className="text-sm">Select Provider</Label>
          <div className="flex gap-3">
            {providers.map((p) => (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelectedProvider(p.id)}
                className={`flex-1 rounded-xl border p-3 text-center text-sm font-medium transition-colors ${
                  selectedProvider === p.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'bg-card text-foreground'
                }`}
              >
                {p.name}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Phone Number</Label>
          <div className="relative">
            <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <Input
              placeholder="+237 6XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Amount (XAF)</Label>
          <Input
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-xl font-bold text-center h-14"
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={!selectedProvider || !phone || !amount || momoCharge.isPending}
          className="mt-4 gap-2"
          size="lg"
        >
          {momoCharge.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
          ) : (
            <>Send <ArrowRight className="h-4 w-4" strokeWidth={1.5} /></>
          )}
        </Button>
      </div>
    </div>
  );
};

export default BankMobileMoney;
