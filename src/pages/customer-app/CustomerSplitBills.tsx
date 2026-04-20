import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, X, CheckCircle2, Percent, DollarSign, ChevronDown, Send, AlertCircle, Receipt, UserPlus, Bell, Search, Loader2, Wallet, CreditCard } from 'lucide-react';
import { HowItWorksFlow, type FlowStep } from '@/components/customer-app/HowItWorksFlow';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';

type SplitMode = 'equal' | 'custom' | 'percentage';
type TabView = 'my_bills' | 'bills_owed';

interface Participant {
  name: string;
  phone: string;
  userId: string | null;
  initials: string;
  color: string;
  customAmount: number;
  customPercent: number;
  paid: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  phone_masked: string | null;
}

const colors = [
  'bg-[hsl(210,80%,93%)]', 'bg-[hsl(150,40%,90%)]', 'bg-[hsl(340,60%,92%)]',
  'bg-[hsl(45,70%,90%)]', 'bg-[hsl(270,60%,92%)]', 'bg-[hsl(25,80%,92%)]',
];

const makeParticipant = (name: string, phone: string, color: string, paid: boolean, userId: string | null = null): Participant => {
  const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return { name, phone, initials, color, customAmount: 0, customPercent: 0, paid, userId };
};

const CustomerSplitBills: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>('my_bills');
  const [pinPaymentId, setPinPaymentId] = useState<string | null>(null);
  const [pinPaymentAmount, setPinPaymentAmount] = useState(0);
  const [pinPaymentTitle, setPinPaymentTitle] = useState('');

  // Fetch split bills I created
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

  // Fetch split bills I owe (where I'm a participant but not the owner)
  const { data: owedBills = [], isLoading: owedLoading } = useQuery({
    queryKey: ['customer-split-bills-owed', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Get participant records for this user
      const { data: myParticipations, error: partErr } = await supabase
        .from('split_bill_participants')
        .select('id, split_bill_id, share_amount, paid, paid_at, is_owner, name')
        .eq('user_id', user!.id)
        .eq('is_owner', false);
      if (partErr) throw partErr;
      if (!myParticipations?.length) return [];

      const billIds = [...new Set(myParticipations.map(p => p.split_bill_id))];
      const { data: billsData, error: billErr } = await supabase
        .from('split_bills')
        .select('*, split_bill_participants(*)')
        .in('id', billIds)
        .order('created_at', { ascending: false });
      if (billErr) throw billErr;

      // Attach the user's own participation info
      return (billsData || []).map(bill => ({
        ...bill,
        myParticipation: myParticipations.find(p => p.split_bill_id === bill.id),
      }));
    },
  });

  // Form state
  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [notes, setNotes] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([
    makeParticipant('You', '', colors[0], true, user?.id || null),
  ]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Search registered users
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('split-bills-ops', {
        body: { action: 'search_users', query },
      });
      if (error) throw error;
      const addedIds = new Set(participants.map(p => p.userId).filter(Boolean));
      setSearchResults((data?.users || []).filter((u: SearchResult) => !addedIds.has(u.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [participants]);

  const onSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => handleSearch(value), 300);
  };

  const addRegisteredUser = (u: SearchResult) => {
    setParticipants([
      ...participants,
      makeParticipant(u.name, u.phone_masked || '', colors[participants.length % colors.length], false, u.id),
    ]);
    setSearchQuery('');
    setSearchResults([]);
    setShowAddPerson(false);
    toast.success(`${u.name} added`);
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
        user_id: p.userId || null,
        share_amount: shares[i],
        share_percent: splitMode === 'percentage' ? (i === 0 ? myAutoPercent : p.customPercent) : 0,
      }));

      const { data, error } = await supabase.functions.invoke('split-bills-ops', {
        body: { action: 'create', title: title.trim(), total_amount: totalNum, split_mode: splitMode, notes: notes || null, participants: participantData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await queryClient.invalidateQueries({ queryKey: ['customer-split-bills'] });
      await queryClient.invalidateQueries({ queryKey: ['customer-split-bills-owed'] });
      setShowCreate(false);
      resetForm();
      toast.success(`Split request sent to ${participants.length - 1} people`);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to create split bill'));
    } finally {
      setSending(false);
    }
  };

  const handleSettle = async (participantId: string) => {
    setActionLoading(participantId);
    try {
      const { data, error } = await supabase.functions.invoke('split-bills-ops', {
        body: { action: 'settle', participant_id: participantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['customer-split-bills'] });
      queryClient.invalidateQueries({ queryKey: ['customer-split-bills-owed'] });
      toast.success('Marked as paid');
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to mark as paid'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemind = async (participantId: string, billId: string) => {
    setActionLoading(`remind-${participantId}`);
    try {
      const { data, error } = await supabase.functions.invoke('split-bills-ops', {
        body: { action: 'remind', participant_id: participantId, split_bill_id: billId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.notified) {
        toast.success('Reminder sent');
      } else {
        toast('This participant is not a registered user — they cannot receive in-app reminders');
      }
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to send reminder'));
    } finally {
      setActionLoading(null);
    }
  };

  // Initiate payment with PIN confirmation
  const initiatePayment = (participantId: string, amount: number, billTitle: string) => {
    setPinPaymentId(participantId);
    setPinPaymentAmount(amount);
    setPinPaymentTitle(billTitle);
  };

  // Execute payment after PIN confirmed
  const executePayment = async () => {
    if (!pinPaymentId) return;
    const participantId = pinPaymentId;
    setPinPaymentId(null);
    setActionLoading(`pay-${participantId}`);
    try {
      const idempotencyKey = `split_pay_${participantId}_${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('split-bills-ops', {
        body: { action: 'pay_share', participant_id: participantId, idempotency_key: idempotencyKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['customer-split-bills'] }),
        queryClient.refetchQueries({ queryKey: ['customer-split-bills-owed'] }),
        queryClient.refetchQueries({ queryKey: ['customer-accounts'] }),
        queryClient.refetchQueries({ queryKey: ['account-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['customer-data'] }),
      ]);
      toast.success(`Payment of ${pinPaymentAmount.toLocaleString()} XAF successful!`);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Payment failed. Please try again.'));
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setTitle(''); setTotal(''); setSplitMode('equal'); setNotes('');
    setParticipants([makeParticipant('You', '', colors[0], true, user?.id || null)]);
    setSearchQuery(''); setSearchResults([]);
  };

  const unpaidOwedCount = owedBills.filter((b: any) => {
  const tr = useHarvestedT('customer');tr('!b.myParticipation?.paid).length;

  return
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
          { icon: UserPlus, title: 'Add Participants', description: 'Search and add registered users. Their share is calculated automatically.', color: 'hsl(150,40%,90%)', iconColor: 'hsl(150,40%,35%)' },
          { icon: Send, title: 'Send Split Request', description: 'Everyone gets notified of their share. Track who has paid in real-time.', color: 'hsl(270,60%,92%)', iconColor: 'hsl(270,50%,45%)' },
          { icon: Wallet, title: 'Pay & Settle', description: 'Recipients pay their share directly from their wallet. Bills auto-settle when everyone has paid.', color: 'hsl(45,70%,90%)', iconColor: 'hsl(45,60%,35%)' },
        ] as FlowStep[]}
      />

      {/* Tab Switcher */}
      <div className="flex gap-2 rounded-2xl bg-muted p-1">
        <button
          onClick={() => setActiveTab('my_bills')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${activeTab === 'my_bills' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground'}`}
        >
          My Bills
        </button>
        <button
          onClick={() => setActiveTab('bills_owed')}
          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all relative ${activeTab === 'bills_owed' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground'}`}
        >
          Bills I Owe
          {unpaidOwedCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {unpaidOwedCount}
            </span>
          )}
        </button>
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
                      {p.userId && i > 0 && (
                        <p className="text-[9px] text-[hsl(150,60%,40%)] font-semibold">Registered user</p>
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

                {/* Add Person — User Search */}
                {showAddPerson ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <Input
                        value={searchQuery}
                        onChange={e => onSearchInput(e.target.value)}
                        placeholder="Search by name or phone number"
                        className="rounded-xl text-xs pl-9"
                        autoFocus
                      />
                      {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </div>

                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl bg-background border border-border p-1">
                        {searchResults.map(u => (
                          <button
                            key={u.id}
                            onClick={() => addRegisteredUser(u)}
                            className="flex items-center gap-2.5 w-full rounded-lg p-2.5 hover:bg-muted/70 transition-colors text-left"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(210,80%,93%)]">
                              <span className="text-[9px] font-bold text-foreground">
                                {u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{u.name}</p>
                              {u.phone_masked && <p className="text-[10px] text-muted-foreground">{u.phone_masked}</p>}
                            </div>
                            <Plus className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />
                          </button>
                        ))}
                      </div>
                    )}

                    {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">No registered users found for "{searchQuery}"</p>
                    )}

                    <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => { setShowAddPerson(false); setSearchQuery(''); setSearchResults([]); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button onClick={() => setShowAddPerson(true)} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-3">
                    <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <span className="text-[11px] font-bold text-muted-foreground">Search & Add Person</span>
                  </button>
                )}
              </div>

              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                className="w-full rounded-xl border border-border bg-background p-3 text-xs outline-none resize-none h-14" />

              <Button onClick={handleCreate} disabled={sending} className="rounded-2xl h-11 text-xs font-bold">
                {sending ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Sending...</span>
                  : <><Users className="mr-2 h-4 w-4" strokeWidth={1.5} /> Send Split Request</>}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bills History */}
      <div className="space-y-2">
        {activeTab === 'my_bills' && (
          <>
            {isLoading ? (
              <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : bills.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No split bills yet. Create your first one!</p>
            ) : bills.map((bill: any, i: number) => {
              const parts = bill.split_bill_participants || [];
              const paidCount = parts.filter((p: any) => {
  const tr = useHarvestedT('customer');tr('p.paid).length;
              const isExpanded = expandedId === bill.id;
              const isSettled = bill.status === \'settled\';
              return
                <motion.div key={bill.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }} className="rounded-3xl bg-card border-2 border-border overflow-hidden">
                  <button onClick={() => setExpandedId(isExpanded ? null : bill.id)} className="flex items-center gap-3 p-4 w-full text-left">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isSettled ? 'bg-[hsl(150,40%,90%)]' : 'bg-[hsl(340,60%,92%)]'}`}>
                      {isSettled
                        ? <CheckCircle2 className="h-5 w-5 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                        : <Users className="h-5 w-5 text-[hsl(340,50%,45%)]" strokeWidth={1.5} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{bill.title}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(bill.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {parts.length} people · {bill.split_mode}')</p>
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
                                <span className="text-[9px] font-bold text-foreground">{p.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}')</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-foreground truncate">{p.name}{p.is_owner ? ' (You)' : ''}</p>
                                {p.phone && <p className="text-[10px] text-muted-foreground">{p.phone}</p>}
                              </div>
                              <span className="text-xs font-bold text-foreground">{Number(p.share_amount).toLocaleString()} XAF</span>
                              {p.paid ? (
                                <CheckCircle2 className="h-4 w-4 text-[hsl(150,60%,40%)] shrink-0" strokeWidth={1.5} />
                              ) : (
                                <div className="flex items-center gap-1 shrink-0">
                                  {!p.is_owner && (
                                    <>
                                      <button onClick={() => handleRemind(p.id, bill.id)} disabled={actionLoading === `remind-${p.id}`}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(45,70%,90%)] hover:bg-[hsl(45,70%,85%)] transition-colors" title="Send reminder">
                                        {actionLoading === `remind-${p.id}` ? <Loader2 className="h-3 w-3 animate-spin text-[hsl(45,60%,35%)]" /> : <Bell className="h-3 w-3 text-[hsl(45,60%,35%)]" strokeWidth={2} />}
                                      </button>
                                      <button onClick={() => handleSettle(p.id)} disabled={actionLoading === p.id}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(150,40%,90%)] hover:bg-[hsl(150,40%,85%)] transition-colors" title="Mark as paid">
                                        {actionLoading === p.id ? <Loader2 className="h-3 w-3 animate-spin text-[hsl(150,60%,40%)]" /> : <CheckCircle2 className="h-3 w-3 text-[hsl(150,60%,40%)]" strokeWidth={2} />}
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </>
        )}

        {activeTab === 'bills_owed' && (
          <>
            {owedLoading ? (
              <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : owedBills.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(150,40%,90%)]">
                  <CheckCircle2 className="h-7 w-7 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-bold text-foreground">You're all clear!</p>
                <p className="text-xs text-muted-foreground text-center">No pending split bills to pay</p>
              </div>
            ) : owedBills.map((bill: any, i: number) => {
              const myPart = bill.myParticipation;
              const isPaid = myPart?.paid;
              const shareAmount = Number(myPart?.share_amount || 0);
              const ownerParticipant = (bill.split_bill_participants || []).find((p: any) => {
  const tr = useHarvestedT('customer');tr('p.is_owner);
              const isExpanded = expandedId === bill.id;

              return
                <motion.div key={bill.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`rounded-3xl bg-card border-2 overflow-hidden ${isPaid ? 'border-[hsl(150,40%,80%)]' : 'border-[hsl(340,60%,85%)]'}`}
                >
                  <button onClick={() => setExpandedId(isExpanded ? null : bill.id)} className="flex items-center gap-3 p-4 w-full text-left">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isPaid ? 'bg-[hsl(150,40%,90%)]' : 'bg-[hsl(340,60%,92%)]'}`}>
                      {isPaid
                        ? <CheckCircle2 className="h-5 w-5 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                        : <CreditCard className="h-5 w-5 text-[hsl(340,50%,45%)]" strokeWidth={1.5} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{bill.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        From {ownerParticipant?.name || 'Unknown'} · {new Date(bill.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{shareAmount.toLocaleString()} XAF</p>
                      <span className={`text-[10px] font-bold ${isPaid ? 'text-[hsl(150,60%,40%)]' : 'text-[hsl(340,50%,45%)]'}`}>
                        {isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                          {bill.notes && <p className="text-[11px] text-muted-foreground italic">{bill.notes}</p>}

                          {/* Bill breakdown */}
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bill Breakdown</p>
                            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                              <span className="text-xs text-muted-foreground">Total bill</span>
                              <span className="text-xs font-bold text-foreground">{Number(bill.total_amount).toLocaleString()} XAF</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                              <span className="text-xs text-muted-foreground">Your share ({bill.split_mode})</span>
                              <span className="text-xs font-bold text-foreground">{shareAmount.toLocaleString()} XAF</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-2.5">
                              <span className="text-xs text-muted-foreground">Participants</span>
                              <span className="text-xs font-bold text-foreground">{(bill.split_bill_participants || []).length} people</span>
                            </div>
                          </div>

                          {isPaid ? (
                            <div className="flex items-center gap-2 rounded-2xl bg-[hsl(150,40%,90%)] p-3">
                              <CheckCircle2 className="h-5 w-5 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
                              <div>
                                <p className="text-xs font-bold text-[hsl(150,40%,25%)]">Payment Complete</p>
                                <p className="text-[10px] text-[hsl(150,30%,40%)]">
                                  Paid on {myPart.paid_at ? new Date(myPart.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <Button
                              onClick={() => initiatePayment(myPart.id, shareAmount, bill.title)}
                              disabled={actionLoading === `pay-${myPart.id}`}
                              className="w-full rounded-2xl h-12 text-sm font-bold bg-primary hover:bg-primary/90"
                            >
                              {actionLoading === `pay-${myPart.id}` ? (
                                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing Payment...</span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <Wallet className="h-4 w-4" strokeWidth={1.5} />
                                  Pay {shareAmount.toLocaleString()} XAF from Wallet
                                </span>
                              )}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </>
        )}
      </div>

      {/* PIN Confirmation Dialog */}
      <PinConfirmDialog
        open={!!pinPaymentId}
        onOpenChange={(open) => { if (!open) setPinPaymentId(null); }}
        onConfirmed={executePayment}
        title="Confirm Split Bill Payment"
        description={`Pay ${pinPaymentAmount.toLocaleString()} XAF for "${pinPaymentTitle}" from your wallet`}
      />
    </div>
  );
};

export default CustomerSplitBills;
