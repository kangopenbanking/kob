import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Zap, Wifi, Smartphone, X, Calendar, Bell, ChevronDown, Pause, Play, Tag, Briefcase, Users, Search, FileText, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

const billCategories = [
  { label: 'Utilities', icon: Zap, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  { label: 'Internet', icon: Wifi, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  { label: 'Mobile', icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  { label: 'Other', icon: Tag, color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
];

const paymentTypes = [
  { id: 'bill', label: 'Bill', icon: FileText, desc: 'Recurring bill payment' },
  { id: 'salary', label: 'Salary', icon: Briefcase, desc: 'Track expected income' },
  { id: 'p2p', label: 'Send to Kang', icon: Users, desc: 'Auto-pay another user' },
];

function calculateNextDate(startDate: string, frequency: string): string {
  const d = new Date(startDate);
  const now = new Date();
  while (d < now) {
    if (frequency === 'Daily') d.setDate(d.getDate() + 1);
    else if (frequency === 'Weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'Monthly') d.setMonth(d.getMonth() + 1);
    else if (frequency === 'Quarterly') d.setMonth(d.getMonth() + 3);
  }
  return d.toISOString().split('T')[0];
}

const CustomerRecurring: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<string | null>(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['customer-recurring-payments', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_payments')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // User accounts for source/destination selection
  const { data: accounts = [] } = useQuery({
    queryKey: ['customer-accounts', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('id, nickname, account_holder_name, currency').eq('user_id', user!.id).eq('is_active', true);
      return data || [];
    },
  });

  // Form state
  const [paymentType, setPaymentType] = useState<'bill' | 'salary' | 'p2p'>('bill');
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newFreq, setNewFreq] = useState('Monthly');
  const [newCategory, setNewCategory] = useState('Utilities');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newNotify, setNewNotify] = useState(true);
  const [sourceAccountId, setSourceAccountId] = useState('');
  // P2P recipient
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState<any[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; full_name: string; phone_masked: string | null } | null>(null);
  const [searchingRecipient, setSearchingRecipient] = useState(false);

  const searchRecipient = async (q: string) => {
    setRecipientQuery(q);
    if (q.trim().length < 2) { setRecipientResults([]); return; }
    setSearchingRecipient(true);
    try {
      const { data } = await supabase.rpc('search_profiles_by_name', { _query: q.trim(), _limit: 6 });
      setRecipientResults((data || []).filter((r: any) => r.id !== user?.id));
    } finally {
      setSearchingRecipient(false);
    }
  };

  const handleToggle = async (payment: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('recurring-payment-create', {
        body: { action: 'toggle', payment_id: payment.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newActive = data?.payment?.is_active ?? !payment.is_active;
      queryClient.invalidateQueries({ queryKey: ['customer-recurring-payments'] });
      toast.success(newActive ? `"${payment.name}" resumed` : `"${payment.name}" paused`);
    } catch {
      toast.error('Could not update payment status. Please try again.');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Please enter a name for this recurring payment'); return; }
    if (!newAmount || Number(newAmount) <= 0) { toast.error('Please enter a valid amount'); return; }
    if (!newStartDate) { toast.error('Please select a start date'); return; }
    if (paymentType === 'p2p') {
      if (!selectedRecipient) { toast.error('Please select a Kang user as the recipient'); return; }
      if (!sourceAccountId) { toast.error('Please select a source account to debit'); return; }
    }
    setCreating(true);
    try {
      const nextDate = calculateNextDate(newStartDate, newFreq);
      const category = paymentType === 'salary' ? 'Income' : paymentType === 'p2p' ? 'Transfer' : newCategory;

      // For P2P, look up recipient's primary destination account
      let destinationAccountId: string | null = null;
      if (paymentType === 'p2p' && selectedRecipient) {
        const { data: destAcct } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', selectedRecipient.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (!destAcct) {
          toast.error('Recipient does not have an active account yet');
          setCreating(false);
          return;
        }
        destinationAccountId = destAcct.id;
      }

      const { data, error } = await supabase.functions.invoke('recurring-payment-create', {
        body: {
          name: newName.trim(),
          category,
          amount: Number(newAmount),
          frequency: newFreq,
          start_date: newStartDate,
          end_date: newEndDate || null,
          next_payment_date: nextDate,
          notify: newNotify,
          payment_type: paymentType,
          recipient_user_id: paymentType === 'p2p' ? selectedRecipient!.id : null,
          recipient_name: paymentType === 'p2p' ? selectedRecipient!.full_name : null,
          recipient_phone: paymentType === 'p2p' ? selectedRecipient!.phone_masked : null,
          source_account_id: paymentType === 'p2p' ? sourceAccountId : null,
          destination_account_id: destinationAccountId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['customer-recurring-payments'] });
      setShowCreate(false);
      resetForm();
      toast.success(`"${newName.trim()}" set up successfully`);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Could not create recurring payment. Please try again.'));
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setPaymentType('bill');
    setNewName(''); setNewAmount(''); setNewFreq('Monthly'); setNewCategory('Utilities');
    setNewStartDate(''); setNewEndDate(''); setNewNotify(true);
    setSourceAccountId('');
    setRecipientQuery(''); setRecipientResults([]); setSelectedRecipient(null);
  };

  const activeCount = payments.filter((p: any) => p.is_active).length;
  const totalMonthly = payments.filter((p: any) => p.is_active && p.payment_type !== 'salary').reduce((s: number, p: any) => {
    const amt = Number(p.amount);
    if (p.frequency === 'Weekly') return s + amt * 4;
    if (p.frequency === 'Quarterly') return s + Math.ceil(amt / 3);
    if (p.frequency === 'Daily') return s + amt * 30;
    return s + amt;
  }, 0);

  const getCategoryMeta = (cat: string) => billCategories.find(c => c.label === cat) || billCategories[3];

  const renderItemIcon = (p: any) => {
    if (p.payment_type === 'salary') return <Briefcase className="h-5 w-5 text-[hsl(150,60%,40%)]" strokeWidth={1.5} />;
    if (p.payment_type === 'p2p') return <Users className="h-5 w-5 text-[hsl(210,60%,45%)]" strokeWidth={1.5} />;
    const cat = getCategoryMeta(p.category);
    const Icon = cat.icon;
    return <Icon className={`h-5 w-5 ${cat.iconColor}`} strokeWidth={1.5} />;
  };

  const itemBgClass = (p: any) => {
    if (p.payment_type === 'salary') return 'bg-[hsl(150,40%,90%)]';
    if (p.payment_type === 'p2p') return 'bg-[hsl(210,80%,93%)]';
    return getCategoryMeta(p.category).color;
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">{tr('Recurring Payments')}</h1>
        </div>
        <Button size="sm" className="rounded-2xl h-9 text-xs font-bold" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[hsl(210,80%,93%)] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(210,60%,45%)]">{tr('Active')}</p>
          <p className="text-lg font-bold text-[hsl(210,60%,45%)]">{activeCount}</p>
        </div>
        <div className="rounded-2xl bg-[hsl(150,40%,90%)] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(150,60%,40%)]">{tr('Est. Monthly Out')}</p>
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
                <p className="text-sm font-bold text-foreground">{tr('New Recurring Payment')}</p>
                <button onClick={() => { setShowCreate(false); resetForm(); }}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              {/* Payment Type Selector */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Type')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {paymentTypes.map(t => (
                    <button key={t.id} onClick={() => setPaymentType(t.id as any)}
                      className={`flex flex-col items-center gap-1 rounded-2xl p-3 transition-all border-2 ${paymentType === t.id ? 'border-foreground bg-muted' : 'border-transparent bg-muted/50'}`}>
                      <t.icon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                      <span className="text-[10px] font-bold text-foreground">{t.label}</span>
                      <span className="text-[8px] text-muted-foreground text-center leading-tight">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bill: category */}
              {paymentType === 'bill' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Category')}</p>
                  <div className="flex gap-2">
                    {billCategories.map(c => (
                      <button key={c.label} onClick={() => setNewCategory(c.label)}
                        className={`flex-1 flex flex-col items-center gap-1 rounded-2xl p-3 transition-all ${newCategory === c.label ? 'ring-2 ring-primary ring-offset-1 ' + c.color : c.color + '/50'}`}>
                        <c.icon className={`h-4 w-4 ${c.iconColor}`} strokeWidth={1.5} />
                        <span className="text-[9px] font-bold text-foreground">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* P2P: recipient search */}
              {paymentType === 'p2p' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Recipient (Kang user)')}</p>
                  {selectedRecipient ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
                      <Users className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-foreground">{selectedRecipient.full_name}</p>
                        {selectedRecipient.phone_masked && <p className="text-[10px] text-muted-foreground">{selectedRecipient.phone_masked}</p>}
                      </div>
                      <button onClick={() => { setSelectedRecipient(null); setRecipientQuery(''); }}><X className="h-4 w-4 text-muted-foreground" /></button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        <Input value={recipientQuery} onChange={e => searchRecipient(e.target.value)} placeholder={tr('Search by name')} className="rounded-xl pl-10" />
                      </div>
                      {searchingRecipient && <p className="text-[10px] text-muted-foreground">{tr('Searching...')}</p>}
                      {recipientResults.length > 0 && (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {recipientResults.map(r => (
                            <button key={r.id} onClick={() => { setSelectedRecipient(r); setRecipientResults([]); }}
                              className="w-full flex items-center gap-3 rounded-xl bg-muted/50 p-2 text-left hover:bg-muted">
                              <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-foreground">{r.full_name}</p>
                                {r.phone_masked && <p className="text-[10px] text-muted-foreground">{r.phone_masked}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* P2P: source account */}
              {paymentType === 'p2p' && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('From Account')}</p>
                  <select value={sourceAccountId} onChange={e => setSourceAccountId(e.target.value)}
                    className="w-full rounded-xl bg-muted px-3 py-2 text-xs text-foreground">
                    <option value="">{tr('Select source account')}</option>
                    {accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.nickname || a.account_holder_name} ({a.currency})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {paymentType === 'salary' ? 'Salary Details' : 'Payment Details'}
                </p>
                <Input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder={paymentType === 'salary' ? 'Salary source (e.g. Acme Corp)' : paymentType === 'p2p' ? 'Description (e.g. Rent share)' : 'Payment name (e.g. ENEO)'}
                  className="rounded-xl" />
                <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder={tr('Amount (XAF)')} className="rounded-xl" />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Frequency')}</p>
                <div className="flex gap-2">
                  {['Daily', 'Weekly', 'Monthly', 'Quarterly'].map(f => (
                    <button key={f} onClick={() => setNewFreq(f)}
                      className={`flex-1 rounded-xl py-2 text-[10px] font-bold transition-all ${newFreq === f ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">{tr('Start Date *')}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} className="rounded-xl pl-10 text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">{tr('End Date')}</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} className="rounded-xl pl-10 text-xs" />
                  </div>
                </div>
              </div>

              <button onClick={() => setNewNotify(!newNotify)}
                className="flex items-center gap-3 rounded-2xl bg-muted p-3">
                <Bell className={`h-4 w-4 ${newNotify ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                <span className="text-xs font-semibold text-foreground flex-1 text-left">{tr('Reminders')}</span>
                <div className={`h-5 w-9 rounded-full flex items-center px-0.5 transition-colors ${newNotify ? 'bg-primary justify-end' : 'bg-border justify-start'}`}>
                  <div className="h-4 w-4 rounded-full bg-background shadow-sm" />
                </div>
              </button>

              <Button onClick={handleCreate} disabled={creating} className="rounded-2xl h-11 text-xs font-bold">
                {creating ? <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> {tr('Creating...')}</span>
                  : 'Create Recurring Payment'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payments List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : payments.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">{tr('No recurring payments yet')}</p>
        ) : payments.map((p: any) => {
          const isExpanded = expandedIdx === p.id;
          const typeLabel = p.payment_type === 'salary' ? 'Salary' : p.payment_type === 'p2p' ? 'Send to Kang' : 'Bill';
          const DirIcon = p.payment_type === 'salary' ? ArrowDownCircle : ArrowUpCircle;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl bg-card border-2 border-border overflow-hidden">
              <button onClick={() => setExpandedIdx(isExpanded ? null : p.id)} className="flex items-center gap-3 p-4 w-full text-left">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${itemBgClass(p)}`}>
                  {renderItemIcon(p)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-foreground truncate">{p.name}</p>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{typeLabel}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {p.frequency} · Next: {new Date(p.next_payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {p.recipient_name && ` · → ${p.recipient_name}`}
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <div className="flex items-center gap-1 justify-end">
                      <DirIcon className={`h-3 w-3 ${p.payment_type === 'salary' ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`} strokeWidth={1.5} />
                      <p className="text-sm font-bold text-foreground">{Number(p.amount).toLocaleString()}</p>
                    </div>
                    <span className={`text-[10px] font-bold ${p.is_active ? 'text-[hsl(150,60%,40%)]' : 'text-muted-foreground'}`}>
                      {p.is_active ? 'Active' : 'Paused'}
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
                        <div><span className="text-muted-foreground">{tr('Type:')}</span> <span className="font-semibold text-foreground">{typeLabel}</span></div>
                        <div><span className="text-muted-foreground">{tr('Category:')}</span> <span className="font-semibold text-foreground">{p.category}</span></div>
                        <div><span className="text-muted-foreground">{tr('Payments:')}</span> <span className="font-semibold text-foreground">{p.payments_made}</span></div>
                        <div><span className="text-muted-foreground">{tr('Started:')}</span> <span className="font-semibold text-foreground">{p.start_date}</span></div>
                        <div><span className="text-muted-foreground">{tr('Ends:')}</span> <span className="font-semibold text-foreground">{p.end_date || 'Ongoing'}</span></div>
                        <div><span className="text-muted-foreground">{tr('Notify:')}</span> <span className="font-semibold text-foreground">{p.notify ? 'Yes' : 'No'}</span></div>
                        {p.last_run_at && <div className="col-span-2"><span className="text-muted-foreground">{tr('Last run:')}</span> <span className="font-semibold text-foreground">{new Date(p.last_run_at).toLocaleString()} ({p.last_run_status})</span></div>}
                        {p.last_run_error && <div className="col-span-2"><span className="text-muted-foreground">{tr('Error:')}</span> <span className="font-semibold text-destructive">{p.last_run_error}</span></div>}
                      </div>
                      <Button size="sm" variant="outline" className="rounded-xl text-[11px] h-8 w-full" onClick={(e) => { e.stopPropagation(); handleToggle(p); }}>
                        {p.is_active ? <><Pause className="mr-1.5 h-3 w-3" strokeWidth={1.5} /> {tr('Pause')}</> : <><Play className="mr-1.5 h-3 w-3" strokeWidth={1.5} /> {tr('Resume')}</>}
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
