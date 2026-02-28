import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Zap, Wifi, Smartphone, X, Calendar, Clock, Bell, ChevronDown, CheckCircle2, Pause, Play, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface RecurringPayment {
  name: string;
  category: string;
  amount: number;
  frequency: string;
  startDate: string;
  endDate: string | null;
  nextDate: string;
  active: boolean;
  notify: boolean;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  paymentsMade: number;
}

const categories = [
  { label: 'Utilities', icon: Zap, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  { label: 'Internet', icon: Wifi, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  { label: 'Mobile', icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  { label: 'Other', icon: Tag, color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
];

const initialPayments: RecurringPayment[] = [];

const CustomerRecurring: React.FC = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState(initialPayments);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Form
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newFreq, setNewFreq] = useState('Monthly');
  const [newCategory, setNewCategory] = useState('Utilities');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newNotify, setNewNotify] = useState(true);

  const handleToggle = (i: number) => {
    setPayments(payments.map((p, idx) => idx === i ? { ...p, active: !p.active } : p));
    toast.success(payments[i].active ? `${payments[i].name} paused` : `${payments[i].name} resumed`);
  };

  const handleCreate = () => {
    if (!newName.trim()) { toast.error('Enter payment name'); return; }
    if (!newAmount || Number(newAmount) <= 0) { toast.error('Enter valid amount'); return; }
    if (!newStartDate) { toast.error('Select start date'); return; }
    setCreating(true);
    const cat = categories.find(c => c.label === newCategory) || categories[0];
    setTimeout(() => {
      const payment: RecurringPayment = {
        name: newName.trim(), category: newCategory, amount: Number(newAmount),
        frequency: newFreq, startDate: newStartDate, endDate: newEndDate || null,
        nextDate: new Date(newStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        active: true, notify: newNotify, paymentsMade: 0,
        icon: cat.icon, color: cat.color, iconColor: cat.iconColor,
      };
      setPayments([payment, ...payments]);
      setShowCreate(false);
      resetForm();
      setCreating(false);
      toast.success('Recurring payment created');
    }, 1000);
  };

  const resetForm = () => {
    setNewName(''); setNewAmount(''); setNewFreq('Monthly'); setNewCategory('Utilities');
    setNewStartDate(''); setNewEndDate(''); setNewNotify(true);
  };

  const activeCount = payments.filter(p => p.active).length;
  const totalMonthly = payments.filter(p => p.active).reduce((s, p) => {
    if (p.frequency === 'Weekly') return s + p.amount * 4;
    if (p.frequency === 'Quarterly') return s + Math.ceil(p.amount / 3);
    return s + p.amount;
  }, 0);

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Recurring Payments</h1>
        </div>
        <Button size="sm" className="rounded-2xl h-9 text-xs font-bold" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[hsl(210,80%,93%)] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(210,60%,45%)]">Active</p>
          <p className="text-lg font-bold text-[hsl(210,60%,45%)]">{activeCount}</p>
        </div>
        <div className="rounded-2xl bg-[hsl(150,40%,90%)] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(150,60%,40%)]">Est. Monthly</p>
          <p className="text-lg font-bold text-[hsl(150,60%,40%)]">{totalMonthly.toLocaleString()}</p>
        </div>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-3xl border-2 border-foreground bg-card">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">New Recurring Payment</p>
                <button onClick={() => { setShowCreate(false); resetForm(); }}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</p>
                <div className="flex gap-2">
                  {categories.map(c => (
                    <button key={c.label} onClick={() => setNewCategory(c.label)}
                      className={`flex-1 flex flex-col items-center gap-1 rounded-2xl p-3 transition-all ${newCategory === c.label ? 'ring-2 ring-primary ring-offset-1 ' + c.color : c.color + '/50'}`}>
                      <c.icon className={`h-4 w-4 ${c.iconColor}`} strokeWidth={1.5} />
                      <span className="text-[9px] font-bold text-foreground">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment Details</p>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Payment name (e.g. ENEO Electricity)" className="rounded-xl" />
                <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Amount (XAF)" className="rounded-xl" />
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Frequency</p>
                <div className="flex gap-2">
                  {['Daily', 'Weekly', 'Monthly', 'Quarterly'].map(f => (
                    <button key={f} onClick={() => setNewFreq(f)}
                      className={`flex-1 rounded-xl py-2 text-[10px] font-bold transition-all ${newFreq === f ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Start Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} className="rounded-xl pl-10 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} className="rounded-xl pl-10 text-xs" />
                  </div>
                </div>
              </div>

              {/* Notifications */}
              <button onClick={() => setNewNotify(!newNotify)}
                className="flex items-center gap-3 rounded-2xl bg-muted p-3">
                <Bell className={`h-4 w-4 ${newNotify ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                <span className="text-xs font-semibold text-foreground flex-1 text-left">Payment reminders</span>
                <div className={`h-5 w-9 rounded-full flex items-center px-0.5 transition-colors ${newNotify ? 'bg-primary justify-end' : 'bg-border justify-start'}`}>
                  <div className="h-4 w-4 rounded-full bg-background shadow-sm" />
                </div>
              </button>

              <Button onClick={handleCreate} disabled={creating} className="rounded-2xl h-11 text-xs font-bold">
                {creating ? <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Creating...</span>
                  : 'Create Recurring Payment'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payments List */}
      <div className="space-y-2">
        {payments.map((p, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <motion.div key={`${p.name}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="rounded-3xl bg-card border-2 border-border overflow-hidden">
              <button onClick={() => setExpandedIdx(isExpanded ? null : i)} className="flex items-center gap-3 p-4 w-full text-left">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${p.color}`}>
                  <p.icon className={`h-5 w-5 ${p.iconColor}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.frequency} · Next: {p.nextDate}</p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="text-sm font-bold text-foreground">{p.amount.toLocaleString()}</p>
                    <span className={`text-[10px] font-bold ${p.active ? 'text-[hsl(150,60%,40%)]' : 'text-muted-foreground'}`}>
                      {p.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                </div>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><span className="text-muted-foreground">Category:</span> <span className="font-semibold text-foreground">{p.category}</span></div>
                        <div><span className="text-muted-foreground">Payments:</span> <span className="font-semibold text-foreground">{p.paymentsMade}</span></div>
                        <div><span className="text-muted-foreground">Started:</span> <span className="font-semibold text-foreground">{p.startDate}</span></div>
                        <div><span className="text-muted-foreground">Ends:</span> <span className="font-semibold text-foreground">{p.endDate || 'Ongoing'}</span></div>
                        <div><span className="text-muted-foreground">Notify:</span> <span className="font-semibold text-foreground">{p.notify ? 'Yes' : 'No'}</span></div>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-xl text-[11px] h-8 w-full" onClick={(e) => { e.stopPropagation(); handleToggle(i); }}>
                        {p.active ? <><Pause className="mr-1.5 h-3 w-3" strokeWidth={1.5} /> Pause Payment</> : <><Play className="mr-1.5 h-3 w-3" strokeWidth={1.5} /> Resume Payment</>}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerRecurring;
