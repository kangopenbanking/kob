import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, MapPin, Smartphone, Building2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const methods = [
  { label: 'Agent Cashout', description: 'Withdraw at a nearby agent', icon: MapPin, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]' },
  { label: 'ATM Withdrawal', description: 'Cardless ATM withdrawal', icon: Building2, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  { label: 'Mobile Money', description: 'Transfer to MoMo wallet', icon: Smartphone, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
];

const CustomerCashOut: React.FC = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Cash Out</h1>
      </div>

      {/* Amount */}
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
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Withdrawal Method</p>
      <div className="space-y-2">
        {methods.map((m, i) => (
          <button key={i} onClick={() => setSelectedMethod(i)}
            className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all ${selectedMethod === i ? 'ring-2 ring-primary ring-offset-2 bg-card' : 'bg-card'}`}>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${m.color}`}>
              <m.icon className={`h-5 w-5 ${m.iconColor}`} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{m.label}</p>
              <p className="text-[11px] text-muted-foreground">{m.description}</p>
            </div>
          </button>
        ))}
      </div>

      <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={!amount || selectedMethod === null}>
        <Banknote className="mr-2 h-4 w-4" strokeWidth={1.5} />
        Cash Out
      </Button>
    </div>
  );
};

export default CustomerCashOut;
