import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Zap, Wifi, Smartphone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface RecurringPayment {
  name: string;
  amount: number;
  frequency: string;
  nextDate: string;
  active: boolean;
  icon: React.ElementType;
  color: string;
  iconColor: string;
}

const initialPayments: RecurringPayment[] = [
  { name: 'ENEO Electricity', amount: 15000, frequency: 'Monthly', nextDate: 'Mar 1', active: true, icon: Zap, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  { name: 'Camtel Internet', amount: 25000, frequency: 'Monthly', nextDate: 'Mar 5', active: true, icon: Wifi, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  { name: 'MTN Airtime', amount: 5000, frequency: 'Weekly', nextDate: 'Feb 28', active: false, icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
];

const CustomerRecurring: React.FC = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState(initialPayments);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newFreq, setNewFreq] = useState('Monthly');
  const [creating, setCreating] = useState(false);

  const handleToggle = (i: number) => {
    setPayments(payments.map((p, idx) => idx === i ? { ...p, active: !p.active } : p));
    toast.success(payments[i].active ? `${payments[i].name} paused` : `${payments[i].name} resumed`);
  };

  const handleCreate = () => {
    if (!newName.trim() || !newAmount) { toast.error('Fill in all fields'); return; }
    setCreating(true);
    setTimeout(() => {
      const payment: RecurringPayment = {
        name: newName.trim(),
        amount: Number(newAmount),
        frequency: newFreq,
        nextDate: 'Mar 15',
        active: true,
        icon: Zap,
        color: 'bg-[hsl(150,40%,90%)]',
        iconColor: 'text-[hsl(150,40%,35%)]',
      };
      setPayments([payment, ...payments]);
      setShowCreate(false);
      setNewName('');
      setNewAmount('');
      setCreating(false);
      toast.success('Recurring payment created');
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Recurring Payments</h1>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">New Recurring Payment</p>
                <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Payment name" className="rounded-xl" />
              <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Amount (XAF)" className="rounded-xl" />
              <select value={newFreq} onChange={e => setNewFreq(e.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
                <option>Weekly</option><option>Monthly</option><option>Quarterly</option>
              </select>
              <Button onClick={handleCreate} disabled={creating} className="rounded-xl h-10">
                {creating ? 'Creating...' : 'Create Payment'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {payments.map((p, i) => (
          <motion.div key={`${p.name}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }} className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.color}`}>
              <p.icon className={`h-5 w-5 ${p.iconColor}`} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">{p.frequency} · Next: {p.nextDate}</p>
            </div>
            <div className="text-right flex items-center gap-3">
              <p className="text-sm font-bold text-foreground">{p.amount.toLocaleString()}</p>
              <button onClick={() => handleToggle(i)}
                className={`h-5 w-9 rounded-full flex items-center px-0.5 transition-colors ${p.active ? 'bg-primary justify-end' : 'bg-muted justify-start'}`}>
                <div className="h-4 w-4 rounded-full bg-background shadow-sm" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <Button variant="outline" className="w-full rounded-2xl h-12" onClick={() => setShowCreate(true)}>
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Add Recurring Payment
      </Button>
    </div>
  );
};

export default CustomerRecurring;
