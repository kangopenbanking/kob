import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Clock, CheckCircle2, XCircle, X, Send, Calendar, User, DollarSign, ChevronDown, Eye, MoreVertical, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  items: InvoiceItem[];
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string; ring: string }> = {
  paid: { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Paid', ring: 'ring-emerald-200' },
  pending: { icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50', label: 'Pending', ring: 'ring-amber-200' },
  sent: { icon: Send, color: 'text-blue-700', bg: 'bg-blue-50', label: 'Sent', ring: 'ring-blue-200' },
  overdue: { icon: AlertCircle, color: 'text-red-700', bg: 'bg-red-50', label: 'Overdue', ring: 'ring-red-200' },
};

type StatusFilter = 'all' | 'paid' | 'pending' | 'sent' | 'overdue';

const CustomerInvoices: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>{tr('([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState')}<StatusFilter>{tr('(\'all\');
  const [expandedId, setExpandedId] = useState')}<string | null>{tr('(null);
  const [sendingId, setSendingId] = useState')}<string | null>(null);

  const [newClient, setNewClient] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newItems, setNewItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unitPrice: 0 }]);

  const loadInvoices = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('customer_invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices((data || []).map((inv: any) => ({
        ...inv,
        items: Array.isArray(inv.items) ? inv.items : JSON.parse(inv.items || '[]'),
      })));
    } catch (err) {
      console.error('Load invoices error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('customer-invoices-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_invoices' }, () => {
        loadInvoices();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadInvoices]);

  const totalAmount = newItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handleCreate = async () => {
    if (!newClient.trim()) { toast.error('Enter client name'); return; }
    if (!newClientEmail.trim()) { toast.error('Enter client email'); return; }
    if (!newDueDate) { toast.error('Select a due date'); return; }
    if (newItems.some(i => {tr('!i.description.trim() || i.unitPrice')} <= 0)) { toast.error('Complete all line items'); return; }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create invoice via edge function (server-side validation + insert)
      const { data: createData, error: createError } = await supabase.functions.invoke('customer-invoice-create', {
        body: {
          client_name: newClient.trim(),
          client_email: newClientEmail.trim(),
          due_date: newDueDate,
          items: newItems,
          notes: newNotes || null,
          currency: 'XAF',
        },
      });

      if (createError) throw createError;
      if (createData?.error) throw new Error(createData.error);

      const invoice = createData.invoice;
      const invoiceNumber = invoice.invoice_number;

      // Send invoice email via edge function
      const { error: sendError } = await supabase.functions.invoke('send-customer-invoice', {
        body: { invoice_id: invoice.id }
      });

      if (sendError) {
        console.error('Email send error:', sendError);
        toast.success(`Invoice ${invoiceNumber} created (email delivery pending)`);
      } else {
        toast.success(`Invoice ${invoiceNumber} created & sent to ${newClientEmail.trim()}`);
      }

      setShowCreate(false);
      resetForm();
      loadInvoices();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to create invoice'));
    } finally {
      setCreating(false);
    }
  };

  const handleResend = async (inv: Invoice) => {
    setSendingId(inv.id);
    try {
      const { error } = await supabase.functions.invoke('send-customer-invoice', {
        body: { invoice_id: inv.id }
      });
      if (error) throw error;
      toast.success(`Reminder sent to ${inv.client_email}`);
      loadInvoices();
    } catch (err: any) {
      toast.error('Failed to send reminder');
    } finally {
      setSendingId(null);
    }
  };

  const handleMarkPaid = async (inv: Invoice) => {
    try {
      const { error } = await supabase
        .from('customer_invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', inv.id);
      if (error) throw error;
      toast.success(`${inv.invoice_number} marked as paid`);
      loadInvoices();
    } catch { toast.error('Failed to update'); }
  };

  const resetForm = () => {
    setNewClient(''); setNewClientEmail(''); setNewDueDate(''); setNewNotes('');
    setNewItems([{ description: '', quantity: 1, unitPrice: 0 }]);
  };

  const filtered = statusFilter === 'all' ? invoices : invoices.filter(i => i.status === statusFilter);

  const stats = {
    total: invoices.reduce((s, i) => s + Number(i.amount), 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0),
    pending: invoices.filter(i => i.status === 'pending' || i.status === 'sent').reduce((s, i) => s + Number(i.amount), 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + Number(i.amount), 0),
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
          </button>
          <h1 className="text-xl font-bold text-foreground">{tr('Invoices')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadInvoices()} className="p-2 rounded-xl bg-card border border-border">
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          </button>
          <Button size="sm" className="rounded-2xl h-9 text-xs font-bold" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> {tr('New')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { label: 'Received', value: stats.paid, bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', sub: 'text-emerald-500 dark:text-emerald-500' },
          { label: 'Pending', value: stats.pending, bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', sub: 'text-amber-500 dark:text-amber-500' },
          { label: 'Overdue', value: stats.overdue, bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', sub: 'text-red-500 dark:text-red-500' },
        ] as const).map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border ${s.border} p-3 text-center`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${s.sub}`}>{s.label}</p>
            <p className={`text-sm font-bold ${s.text} mt-0.5`}>{s.value.toLocaleString()}</p>
            <p className={`text-[9px] ${s.sub}`}>XAF</p>
          </div>
        ))}
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(['all', 'pending', 'sent', 'paid', 'overdue'] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`rounded-xl px-3 py-1.5 text-[10px] font-bold capitalize transition-all whitespace-nowrap ${statusFilter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground border border-border'}`}>
            {f === 'all' ? `All (${invoices.length})` : `${f} (${invoices.filter(i => i.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-3xl border-2 border-primary/30 bg-gradient-to-b from-primary/5 via-card to-card shadow-lg shadow-primary/5">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-bold text-foreground">New Invoice</p>
                </div>
                <button onClick={() => { setShowCreate(false); resetForm(); }}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Client Details</p>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input value={newClient} onChange={e => setNewClient(e.target.value)} placeholder="Client name" className="rounded-xl pl-10" />
                </div>
                <div className="relative">
                  <Send className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input type="email" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} placeholder="Client email" className="rounded-xl pl-10" />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="rounded-xl pl-10" />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Line Items</p>
                {newItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <Input value={item.description} onChange={e => setNewItems(newItems.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))} placeholder={tr('Description')} className="rounded-xl text-xs" />
                      <div className="flex gap-2">
                        <Input type="number" value={item.quantity || ''} onChange={e => setNewItems(newItems.map((it, idx) => idx === i ? { ...it, quantity: Number(e.target.value) } : it))} placeholder={tr('Qty')} className="rounded-xl text-xs w-20" />
                        <Input type="number" value={item.unitPrice || ''} onChange={e => setNewItems(newItems.map((it, idx) => idx === i ? { ...it, unitPrice: Number(e.target.value) } : it))} placeholder="Unit price" className="rounded-xl text-xs flex-1" />
                      </div>
                    </div>
                    {newItems.length > 1 && (
                      <button onClick={() => setNewItems(newItems.filter((_, idx) => idx !== i))} className="mt-2">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => setNewItems([...newItems, { description: '', quantity: 1, unitPrice: 0 }])} className="flex items-center gap-1 text-[11px] font-bold text-primary">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Add Line Item
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{tr('Notes (optional)')}</p>
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder={tr('Payment terms, notes...')}
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs outline-none resize-none h-16 focus:ring-1 focus:ring-primary/30" />
              </div>

              {/* Total */}
              <div className="rounded-2xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/15 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Amount</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{newItems.filter(i => i.description).length} item(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{totalAmount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">XAF</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleCreate} disabled={creating} className="rounded-2xl h-11 text-xs font-bold">
                {creating ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {tr('Creating & Sending...')}</span>
                ) : (
                  <span className="flex items-center gap-2"><Send className="h-3.5 w-3.5" /> {tr('Create & Send Invoice')}</span>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{tr('Loading invoices...')}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && invoices.length === 0 && (
        <div className="text-center py-16">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-muted flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-bold text-foreground mb-1">No invoices yet</p>
          <p className="text-xs text-muted-foreground mb-4">Create your first invoice to get started</p>
          <Button size="sm" className="rounded-2xl" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Create Invoice
          </Button>
        </div>
      )}

      {/* Invoice List */}
      <div className="space-y-3">
        {filtered.map((inv, i) => {
  const tr = useHarvestedT('customer');
          const cfg = statusConfig[inv.status] || statusConfig.pending;
          const StatusIcon = cfg.icon;
          const isExpanded = expandedId === inv.id;
          const isDue = new Date(inv.due_date) < new Date() && inv.status !== 'paid';

          // Status-aware accent colors for left stripe
          const stripeColor = inv.status === 'paid' ? 'from-emerald-400 to-emerald-600'
            : inv.status === 'overdue' ? 'from-red-400 to-red-600'
            : inv.status === 'sent' ? 'from-blue-400 to-blue-600'
            : 'from-amber-400 to-amber-500';

          return (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.25 }}
              className={`rounded-2xl overflow-hidden transition-all ${isExpanded ? 'shadow-lg shadow-primary/10' : 'shadow-sm'}`}>
              
               <div>
                 <div className={`bg-card border rounded-2xl ${isExpanded ? 'border-primary/25' : 'border-border'}`}>
                  
                  {/* Card Header */}
                  <button onClick={() => setExpandedId(isExpanded ? null : inv.id)} className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 w-full text-left">
                    {/* Status Icon with gradient bg */}
                    <div className={`relative flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl ${cfg.bg} ring-1 ${cfg.ring}`}>
                      <StatusIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${cfg.color}`} strokeWidth={1.5} />
                      {inv.status === 'paid' && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs sm:text-sm font-bold text-foreground truncate max-w-[120px] sm:max-w-none">{inv.client_name}</p>
                        {isDue && (
                          <span className="text-[8px] font-bold text-white bg-gradient-to-r from-red-500 to-red-600 px-1.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse shrink-0">
                            {tr('Overdue')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 overflow-hidden">
                        <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground truncate">{inv.invoice_number}</span>
                        <span className="text-muted-foreground/40 shrink-0">·</span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground shrink-0">{formatDate(inv.created_at)}</span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right flex flex-col items-end gap-1 shrink-0">
                      <p className="text-xs sm:text-[15px] font-extrabold text-foreground whitespace-nowrap">{Number(inv.amount).toLocaleString()} <span className="text-[8px] sm:text-[9px] text-muted-foreground font-semibold">{inv.currency}</span></p>
                      <span className={`inline-flex items-center gap-0.5 sm:gap-1 rounded-full px-1.5 sm:px-2.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.color} ring-1 ${cfg.ring}`}>
                        <StatusIcon className="h-2 w-2 sm:h-2.5 sm:w-2.5" strokeWidth={2} />
                        {cfg.label}
                      </span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                  </button>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                          {/* Meta Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-2.5 overflow-hidden">
                              <p className="text-[9px] font-bold uppercase tracking-wider text-blue-500 mb-0.5">{tr('Recipient')}</p>
                              <p className="text-[11px] font-semibold text-foreground break-all">{inv.client_email}</p>
                            </div>
                            <div className={`rounded-xl p-2.5 border ${isDue ? 'bg-red-50/60 dark:bg-red-950/20 border-red-100 dark:border-red-900/40' : 'bg-muted/50 border-border'}`}>
                              <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${isDue ? 'text-red-500' : 'text-muted-foreground'}`}>Due Date</p>
                              <p className={`text-[11px] font-semibold ${isDue ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{formatDate(inv.due_date)}</p>
                            </div>
                            {inv.sent_at && (
                              <div className="rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-2.5">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-500 mb-0.5">{tr('Sent')}</p>
                                <p className="text-[11px] font-semibold text-foreground">{formatDate(inv.sent_at)}</p>
                              </div>
                            )}
                            {inv.paid_at && (
                              <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-2.5">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">{tr('Paid')}</p>
                                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{formatDate(inv.paid_at)}</p>
                              </div>
                            )}
                          </div>

                          {/* Line Items */}
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Line Items</p>
                            <div className="rounded-xl border border-border overflow-hidden">
                              {inv.items.map((item, idx) => (
                                <div key={idx} className={`flex justify-between items-center px-3 py-2.5 text-[11px] ${idx % 2 === 0 ? 'bg-muted/20' : 'bg-card'} ${idx < inv.items.length - 1 ? 'border-b border-border/50' : ''}`}>
                                  <div>
                                    <p className="font-semibold text-foreground">{item.description}</p>
                                    <p className="text-[9px] text-muted-foreground">{item.quantity} × {Number(item.unitPrice).toLocaleString()} {inv.currency}</p>
                                  </div>
                                  <p className="font-bold text-foreground">{(item.quantity * item.unitPrice).toLocaleString()}</p>
                                </div>
                              ))}
                              <div className="flex justify-between items-center px-3 py-3 bg-gradient-to-r from-primary/5 to-primary/10 border-t border-primary/15">
                                <p className="text-[11px] font-bold text-primary">{tr('Total')}</p>
                                <p className="text-sm font-extrabold text-primary">{Number(inv.amount).toLocaleString()} {inv.currency}</p>
                              </div>
                            </div>
                          </div>

                          {inv.notes && (
                            <p className="text-[11px] text-muted-foreground italic border-l-2 border-primary/30 pl-3 bg-primary/5 rounded-r-lg py-2 pr-3">{inv.notes}</p>
                          )}

                          {/* Actions */}
                          {inv.status !== 'paid' && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="rounded-xl text-[10px] h-9 flex-1 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                onClick={() => handleResend(inv)} disabled={sendingId === inv.id}>
                                {sendingId === inv.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="mr-1.5 h-3 w-3" strokeWidth={1.5} />}
                                {inv.sent_at ? 'Resend' : 'Send'}
                              </Button>
                              <Button size="sm" className="rounded-xl text-[10px] h-9 flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-sm shadow-emerald-500/20"
                                onClick={() => handleMarkPaid(inv)}>
                                <CheckCircle2 className="mr-1.5 h-3 w-3" strokeWidth={1.5} /> Mark Paid
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerInvoices;
