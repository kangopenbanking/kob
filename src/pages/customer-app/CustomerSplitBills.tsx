import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, X, CheckCircle2, Percent, DollarSign, User, StickyNote, ChevronDown, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type SplitMode = 'equal' | 'custom' | 'percentage';

interface Participant {
  name: string;
  phone: string;
  initials: string;
  color: string;
  customAmount?: number;
  customPercent?: number;
  paid: boolean;
}

interface SplitBill {
  id: string;
  title: string;
  total: number;
  splitMode: SplitMode;
  participants: Participant[];
  date: string;
  notes: string;
}

const colors = [
  'bg-[hsl(210,80%,93%)]', 'bg-[hsl(150,40%,90%)]', 'bg-[hsl(340,60%,92%)]',
  'bg-[hsl(45,70%,90%)]', 'bg-[hsl(270,60%,92%)]', 'bg-[hsl(25,80%,92%)]',
];

const initialBills: SplitBill[] = [
  {
    id: 'SB-001', title: 'Friday Dinner', total: 36000, splitMode: 'equal', date: 'Feb 25', notes: '',
    participants: [
      { name: 'You', phone: '', initials: 'ME', color: colors[0], paid: true },
      { name: 'John Doe', phone: '+237 6XX', initials: 'JD', color: colors[1], paid: true },
      { name: 'Marie K.', phone: '+237 6XX', initials: 'MK', color: colors[2], paid: false },
    ],
  },
  {
    id: 'SB-002', title: 'Office Supplies', total: 25000, splitMode: 'equal', date: 'Feb 20', notes: 'Printer ink + paper',
    participants: [
      { name: 'You', phone: '', initials: 'ME', color: colors[0], paid: true },
      { name: 'Paul N.', phone: '+237 6XX', initials: 'PN', color: colors[3], paid: false },
    ],
  },
];

const CustomerSplitBills: React.FC = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState(initialBills);
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([
    { name: 'You', phone: '', initials: 'ME', color: colors[0], paid: true },
  ]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');

  const addPerson = () => {
    if (!newPersonName.trim()) { toast.error('Enter a name'); return; }
    const initials = newPersonName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    setParticipants([...participants, {
      name: newPersonName.trim(), phone: newPersonPhone.trim(), initials,
      color: colors[participants.length % colors.length], paid: false,
    }]);
    setNewPersonName(''); setNewPersonPhone(''); setShowAddPerson(false);
  };

  const removePerson = (i: number) => {
    if (i === 0) return;
    setParticipants(participants.filter((_, idx) => idx !== i));
  };

  const perPerson = participants.length > 0 ? Math.ceil(Number(total || 0) / participants.length) : 0;

  const getShare = (p: Participant, idx: number) => {
    if (splitMode === 'equal') return perPerson;
    if (splitMode === 'custom') return p.customAmount || 0;
    if (splitMode === 'percentage') return Math.ceil(Number(total || 0) * (p.customPercent || 0) / 100);
    return 0;
  };

  const handleCreate = () => {
    if (!title.trim()) { toast.error('Enter a bill title'); return; }
    if (!total || Number(total) <= 0) { toast.error('Enter valid total'); return; }
    if (participants.length < 2) { toast.error('Add at least one other person'); return; }
    setSending(true);
    setTimeout(() => {
      const bill: SplitBill = {
        id: `SB-${String(bills.length + 1).padStart(3, '0')}`,
        title: title.trim(), total: Number(total), splitMode, notes,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        participants,
      };
      setBills([bill, ...bills]);
      setShowCreate(false);
      resetForm();
      setSending(false);
      toast.success(`Split request sent to ${participants.length - 1} people`);
    }, 1200);
  };

  const resetForm = () => {
    setTitle(''); setTotal(''); setSplitMode('equal'); setNotes('');
    setParticipants([{ name: 'You', phone: '', initials: 'ME', color: colors[0], paid: true }]);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Split Bills</h1>
        </div>
        <Button size="sm" className="rounded-2xl h-9 text-xs font-bold" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New Split
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-3xl border-2 border-foreground bg-card">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">New Split Bill</p>
                <button onClick={() => { setShowCreate(false); resetForm(); }}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              {/* Bill Details */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bill Details</p>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Bill title (e.g. Friday Dinner)" className="rounded-xl" />
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input type="text" inputMode="numeric" value={total} onChange={e => setTotal(e.target.value.replace(/\D/g, ''))} placeholder="Total amount (XAF)" className="rounded-xl pl-10" />
                </div>
              </div>

              {/* Split Mode */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Split Method</p>
                <div className="flex gap-2">
                  {([
                    { mode: 'equal' as SplitMode, label: 'Equal', icon: Users },
                    { mode: 'custom' as SplitMode, label: 'Custom', icon: DollarSign },
                    { mode: 'percentage' as SplitMode, label: 'Percent', icon: Percent },
                  ]).map(m => (
                    <button key={m.mode} onClick={() => setSplitMode(m.mode)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold transition-all ${splitMode === m.mode ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      <m.icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participants */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Participants ({participants.length})</p>
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-2xl bg-muted/50 p-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${p.color}`}>
                      <span className="text-[10px] font-bold text-foreground">{p.initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                      {p.phone && <p className="text-[10px] text-muted-foreground">{p.phone}</p>}
                    </div>
                    {splitMode === 'custom' && i > 0 && (
                      <Input type="number" value={p.customAmount || ''} onChange={e => {
                        const updated = [...participants]; updated[i].customAmount = Number(e.target.value); setParticipants(updated);
                      }} placeholder="XAF" className="rounded-lg text-xs w-24 h-8" />
                    )}
                    {splitMode === 'percentage' && i > 0 && (
                      <Input type="number" value={p.customPercent || ''} onChange={e => {
                        const updated = [...participants]; updated[i].customPercent = Number(e.target.value); setParticipants(updated);
                      }} placeholder="%" className="rounded-lg text-xs w-16 h-8" />
                    )}
                    <span className="text-xs font-bold text-foreground w-16 text-right">{getShare(p, i).toLocaleString()}</span>
                    {i > 0 && <button onClick={() => removePerson(i)}><X className="h-4 w-4 text-muted-foreground" /></button>}
                  </div>
                ))}
                {showAddPerson ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border p-3">
                    <Input value={newPersonName} onChange={e => setNewPersonName(e.target.value)} placeholder="Name" className="rounded-xl text-xs" />
                    <Input value={newPersonPhone} onChange={e => setNewPersonPhone(e.target.value)} placeholder="Phone (optional)" className="rounded-xl text-xs" />
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-xl flex-1 text-xs" onClick={addPerson}>Add</Button>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => setShowAddPerson(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddPerson(true)} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-3">
                    <Plus className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <span className="text-[11px] font-bold text-muted-foreground">Add Person</span>
                  </button>
                )}
              </div>

              {/* Notes */}
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                className="w-full rounded-xl border border-border bg-background p-3 text-xs outline-none resize-none h-14" />

              <Button onClick={handleCreate} disabled={sending} className="rounded-2xl h-11 text-xs font-bold">
                {sending ? <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Sending...</span>
                  : <><Users className="mr-2 h-4 w-4" strokeWidth={1.5} /> Send Split Request</>}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bills History */}
      <div className="space-y-2">
        {bills.map((bill, i) => {
          const paidCount = bill.participants.filter(p => p.paid).length;
          const isExpanded = expandedId === bill.id;
          return (
            <motion.div key={bill.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="rounded-3xl bg-card border-2 border-border overflow-hidden">
              <button onClick={() => setExpandedId(isExpanded ? null : bill.id)} className="flex items-center gap-3 p-4 w-full text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(340,60%,92%)]">
                  <Users className="h-5 w-5 text-[hsl(340,50%,45%)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{bill.title}</p>
                  <p className="text-[11px] text-muted-foreground">{bill.date} · {bill.participants.length} people</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{bill.total.toLocaleString()}</p>
                  <span className={`text-[10px] font-bold ${paidCount === bill.participants.length ? 'text-[hsl(150,60%,40%)]' : 'text-[hsl(45,60%,35%)]'}`}>
                    {paidCount}/{bill.participants.length} paid
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                      {bill.participants.map((p, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${p.color}`}>
                            <span className="text-[9px] font-bold text-foreground">{p.initials}</span>
                          </div>
                          <span className="flex-1 text-xs font-semibold text-foreground">{p.name}</span>
                          <span className="text-xs font-bold text-foreground">{Math.ceil(bill.total / bill.participants.length).toLocaleString()}</span>
                          {p.paid
                            ? <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,40%)]" strokeWidth={2} />
                            : <span className="text-[10px] font-bold text-[hsl(45,60%,35%)] bg-[hsl(45,70%,90%)] rounded-md px-1.5 py-0.5">Pending</span>
                          }
                        </div>
                      ))}
                      {bill.notes && <p className="text-[11px] text-muted-foreground italic mt-2">{bill.notes}</p>}
                      <Button size="sm" variant="outline" className="rounded-xl text-[11px] h-8 w-full mt-2"
                        onClick={() => toast.success('Reminder sent to unpaid participants')}>
                        <Send className="mr-1.5 h-3 w-3" strokeWidth={1.5} /> Remind Unpaid
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

export default CustomerSplitBills;
