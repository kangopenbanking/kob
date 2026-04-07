import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, X, CheckCircle2, Percent, DollarSign, ChevronDown, Send, AlertCircle, Receipt, UserPlus, Coins, Bell } from 'lucide-react';
import { HowItWorksFlow, type FlowStep } from '@/components/customer-app/HowItWorksFlow';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

type SplitMode = 'equal' | 'custom' | 'percentage';

interface Participant {
  name: string;
  phone: string;
  initials: string;
  color: string;
  customAmount: number;
  customPercent: number;
  paid: boolean;
}

const colors = [
  'bg-[hsl(210,80%,93%)]', 'bg-[hsl(150,40%,90%)]', 'bg-[hsl(340,60%,92%)]',
  'bg-[hsl(45,70%,90%)]', 'bg-[hsl(270,60%,92%)]', 'bg-[hsl(25,80%,92%)]',
];

const makeParticipant = (name: string, phone: string, color: string, paid: boolean): Participant => {
  const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return { name, phone, initials, color, customAmount: 0, customPercent: 0, paid };
};

const CustomerSplitBills: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch split bills from DB
  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['customer-split-bills', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('split_bills')
        .select('*, split_bill_participants(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Form state
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([
    makeParticipant('You', '', colors[0], true),
  ]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');

  const totalNum = Number(total || 0);
  const perPerson = participants.length > 0 ? Math.ceil(totalNum / participants.length) : 0;

  const shares = useMemo(() => {
    if (splitMode === 'equal') return participants.map(() => perPerson);
    if (splitMode === 'custom') {
      const othersTotal = participants.slice(1).reduce((s, p) => s + (p.customAmount || 0), 0);
      return [Math.max(totalNum - othersTotal, 0), ...participants.slice(1).map(p => p.customAmount || 0)];
    }
    if (splitMode === 'percentage') {
      const othersPercent = participants.slice(1).reduce((s, p) => s + (p.customPercent || 0), 0);
      const myPercent = Math.max(100 - othersPercent, 0);
      return [Math.ceil(totalNum * myPercent / 100), ...participants.slice(1).map(p => Math.ceil(totalNum * (p.customPercent || 0) / 100))];
    }
    return participants.map(() => 0);
  }, [splitMode, participants, totalNum, perPerson]);

  const customTotal = splitMode === 'custom' ? shares.reduce((s, v) => s + v, 0) : 0;
  const percentTotal = splitMode === 'percentage' ? participants.slice(1).reduce((s, p) => s + (p.customPercent || 0), 0) : 0;
  const myAutoPercent = splitMode === 'percentage' ? Math.max(100 - percentTotal, 0) : 0;

  const addPerson = () => {
    if (!newPersonName.trim()) { toast.error('Enter a name'); return; }
    setParticipants([...participants, makeParticipant(newPersonName.trim(), newPersonPhone.trim(), colors[participants.length % colors.length], false)]);
    setNewPersonName(''); setNewPersonPhone(''); setShowAddPerson(false);
  };

  const removePerson = (i: number) => {
    if (i === 0) return;
    setParticipants(participants.filter((_, idx) => idx !== i));
  };

  const updateParticipant = (i: number, field: 'customAmount' | 'customPercent', value: number) => {
    setParticipants(participants.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Enter a bill title'); return; }
    if (!total || totalNum <= 0) { toast.error('Enter a valid total amount'); return; }
    if (participants.length < 2) { toast.error('Add at least one other person'); return; }
    if (splitMode === 'custom') {
      const othersTotal = participants.slice(1).reduce((s, p) => s + (p.customAmount || 0), 0);
      if (othersTotal <= 0) { toast.error('Enter amounts for each participant'); return; }
      if (othersTotal > totalNum) { toast.error('Participant amounts exceed the total bill'); return; }
    }
    if (splitMode === 'percentage') {
      if (percentTotal <= 0) { toast.error('Enter percentages for each participant'); return; }
      if (percentTotal > 100) { toast.error('Total percentages exceed 100%'); return; }
    }

    setSending(true);
    try {
      const participantData = participants.map((p, i) => ({
        name: p.name,
        phone: p.phone || null,
        share_amount: shares[i],
        share_percent: splitMode === 'percentage' ? (i === 0 ? myAutoPercent : p.customPercent) : 0,
      }));

      const { data, error } = await supabase.functions.invoke('split-bills-ops', {
        body: {
          action: 'create',
          title: title.trim(),
          total_amount: totalNum,
          split_mode: splitMode,
          notes: notes || null,
          participants: participantData,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ['customer-split-bills'] });
      setShowCreate(false);
      resetForm();
      toast.success(`Split request sent to ${participants.length - 1} people`);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to create split bill'));
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setTotal(''); setSplitMode('equal'); setNotes('');
    setParticipants([makeParticipant('You', '', colors[0], true)]);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Split Bills</h1>
        </div>
        <Button size="sm" className="rounded-2xl h-9 text-xs font-bold" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New Split
        </Button>
      </div>

      <HowItWorksFlow
        title="How Split Bills Works"
        steps={[
          { icon: Receipt, title: 'Add a Bill', description: 'Enter the bill title, total amount, and choose how to split — equal, custom amounts, or percentages.', color: 'hsl(210,80%,93%)', iconColor: 'hsl(210,60%,45%)' },
          { icon: UserPlus, title: 'Add Participants', description: 'Add friends by name and phone. Your share is auto-calculated as the remainder.', color: 'hsl(150,40%,90%)', iconColor: 'hsl(150,40%,35%)' },
          { icon: Send, title: 'Send Split Request', description: 'Everyone gets notified of their share. Track who has paid in real-time.', color: 'hsl(270,60%,92%)', iconColor: 'hsl(270,50%,45%)' },
          { icon: Bell, title: 'Remind & Settle', description: 'Send reminders to unpaid participants. Once everyone pays, the bill is settled.', color: 'hsl(45,70%,90%)', iconColor: 'hsl(45,60%,35%)' },
        ] as FlowStep[]}
      />

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

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bill Details</p>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Bill title (e.g. Friday Dinner)" className="rounded-xl" />
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input type="text" inputMode="numeric" value={total} onChange={e => setTotal(e.target.value.replace(/\D/g, ''))} placeholder="Total amount (XAF)" className="rounded-xl pl-10" />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Split Method</p>
                <div className="flex gap-2">
                  {([
                    { mode: 'equal' as SplitMode, label: 'Equal', icon: Users },
                    { mode: 'custom' as SplitMode, label: 'Custom', icon: DollarSign },
                    { mode: 'percentage' as SplitMode, label: 'Percent', icon: Percent },
                  ]).map(m => (
                    <button key={m.mode} onClick={() => setSplitMode(m.mode)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold transition-all ${splitMode === m.mode ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      <m.icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-muted/50 p-2.5">
                <p className="text-[10px] text-muted-foreground text-center">
                  {splitMode === 'equal' && 'Everyone pays the same amount'}
                  {splitMode === 'custom' && 'Set custom amounts — your share is auto-calculated as the remainder'}
                  {splitMode === 'percentage' && 'Set percentages — your share is auto-calculated as the remainder'}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Participants ({participants.length})</p>
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-2xl bg-muted/50 p-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${p.color}`}>
                      <span className="text-[10px] font-bold text-foreground">{p.initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                      {p.phone && <p className="text-[10px] text-muted-foreground">{p.phone}</p>}
                      {i === 0 && splitMode !== 'equal' && (
                        <p className="text-[9px] text-primary font-semibold">Auto-calculated</p>
                      )}
                    </div>
                    {splitMode === 'custom' && i > 0 && (
                      <Input type="number" min={0} value={p.customAmount || ''} onChange={e => updateParticipant(i, 'customAmount', Number(e.target.value))}
                        placeholder="XAF" className="rounded-lg text-xs w-24 h-8" />
                    )}
                    {splitMode === 'percentage' && i > 0 && (
                      <div className="flex items-center gap-1">
                        <Input type="number" min={0} max={100} value={p.customPercent || ''} onChange={e => updateParticipant(i, 'customPercent', Math.min(Number(e.target.value), 100))}
                          placeholder="%" className="rounded-lg text-xs w-16 h-8" />
                        <span className="text-[10px] text-muted-foreground">%</span>
                      </div>
                    )}
                    {splitMode === 'percentage' && i === 0 && (
                      <span className="text-[10px] font-bold text-primary">{myAutoPercent}%</span>
                    )}
                    <span className="text-xs font-bold text-foreground w-20 text-right shrink-0">
                      {shares[i]?.toLocaleString() || '0'} <span className="text-[9px] text-muted-foreground">XAF</span>
                    </span>
                    {i > 0 && <button onClick={() => removePerson(i)} className="shrink-0"><X className="h-4 w-4 text-muted-foreground" /></button>}
                  </div>
                ))}

                {splitMode === 'custom' && totalNum > 0 && participants.length > 1 && (
                  <div className={`flex items-center gap-2 rounded-xl p-2 text-[10px] font-bold ${customTotal === totalNum ? 'bg-[hsl(150,40%,90%)] text-[hsl(150,60%,40%)]' : customTotal > totalNum ? 'bg-[hsl(0,60%,93%)] text-[hsl(0,60%,50%)]' : 'bg-[hsl(45,70%,90%)] text-[hsl(45,60%,35%)]'}`}>
                    {customTotal === totalNum ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    Total: {customTotal.toLocaleString()} / {totalNum.toLocaleString()} XAF
                    {customTotal > totalNum && ' — exceeds bill!'}
                  </div>
                )}
                {splitMode === 'percentage' && participants.length > 1 && (
                  <div className={`flex items-center gap-2 rounded-xl p-2 text-[10px] font-bold ${(percentTotal + myAutoPercent) === 100 ? 'bg-[hsl(150,40%,90%)] text-[hsl(150,60%,40%)]' : 'bg-[hsl(45,70%,90%)] text-[hsl(45,60%,35%)]'}`}>
                    {(percentTotal + myAutoPercent) === 100 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    Total: {percentTotal + myAutoPercent}% / 100%
                    {percentTotal > 100 && ' — exceeds 100%!'}
                  </div>
                )}

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
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : bills.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No split bills yet. Create your first one!</p>
        ) : bills.map((bill: any, i: number) => {
          const parts = bill.split_bill_participants || [];
          const paidCount = parts.filter((p: any) => p.paid).length;
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
                  <p className="text-[11px] text-muted-foreground">{new Date(bill.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {parts.length} people · {bill.split_mode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{Number(bill.total_amount).toLocaleString()}</p>
                  <span className={`text-[10px] font-bold ${paidCount === parts.length ? 'text-[hsl(150,60%,40%)]' : 'text-[hsl(45,60%,35%)]'}`}>
                    {paidCount}/{parts.length} paid
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                      {bill.notes && <p className="text-[11px] text-muted-foreground italic">{bill.notes}</p>}
                      {parts.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${p.is_owner ? 'bg-[hsl(210,80%,93%)]' : 'bg-[hsl(340,60%,92%)]'}`}>
                            <span className="text-[9px] font-bold text-foreground">{p.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{p.name}{p.is_owner ? ' (You)' : ''}</p>
                            {p.phone && <p className="text-[10px] text-muted-foreground">{p.phone}</p>}
                          </div>
                          <span className="text-xs font-bold text-foreground">{Number(p.share_amount).toLocaleString()} XAF</span>
                          {p.paid ? <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,40%)] shrink-0" strokeWidth={1.5} />
                            : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                        </div>
                      ))}
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
