import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Clock, CheckCircle2, XCircle, X, Send, Calendar, Hash, User, DollarSign, StickyNote, ChevronDown, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Invoice {
  id: string;
  client: string;
  clientEmail: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  notes: string;
}

const statusConfig = {
  paid: { icon: CheckCircle2, color: 'text-[hsl(150,60%,40%)]', bg: 'bg-[hsl(150,40%,90%)]', label: 'Paid' },
  pending: { icon: Clock, color: 'text-[hsl(45,60%,35%)]', bg: 'bg-[hsl(45,70%,90%)]', label: 'Pending' },
  overdue: { icon: XCircle, color: 'text-[hsl(0,60%,50%)]', bg: 'bg-[hsl(0,60%,93%)]', label: 'Overdue' },
};

const initialInvoices: Invoice[] = [];

type StatusFilter = 'all' | 'paid' | 'pending' | 'overdue';

const CustomerInvoices: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [newClient, setNewClient] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newItems, setNewItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unitPrice: 0 }]);

  const addItem = () => setNewItems([...newItems, { description: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => { if (newItems.length > 1) setNewItems(newItems.filter((_, idx) => idx !== i)); };
  const updateItem = (i: number, field: keyof InvoiceItem, value: string | number) => {
    setNewItems(newItems.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const totalAmount = newItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handleCreate = () => {
    if (!newClient.trim()) { toast.error('Enter client name'); return; }
    if (!newClientEmail.trim()) { toast.error('Enter client email'); return; }
    if (!newDueDate) { toast.error('Select a due date'); return; }
    if (newItems.some(i => !i.description.trim() || i.unitPrice <= 0)) { toast.error('Complete all line items'); return; }
    setCreating(true);
    setTimeout(() => {
      const inv: Invoice = {
        id: `INV-${String(invoices.length + 1).padStart(3, '0')}`,
        client: newClient.trim(),
        clientEmail: newClientEmail.trim(),
        amount: totalAmount,
        status: 'pending',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dueDate: new Date(newDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        items: newItems,
        notes: newNotes,
      };
      setInvoices([inv, ...invoices]);
      setShowCreate(false);
      resetForm();
      setCreating(false);
      toast.success(`Invoice ${inv.id} created & sent to ${inv.clientEmail}`);
    }, 1200);
  };

  const resetForm = () => {
    setNewClient(''); setNewClientEmail(''); setNewDueDate(''); setNewNotes('');
    setNewItems([{ description: '', quantity: 1, unitPrice: 0 }]);
  };

  const filtered = statusFilter === 'all' ? invoices : invoices.filter(i => i.status === statusFilter);

  const stats = {
    total: invoices.reduce((s, i) => s + i.amount, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
    pending: invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Invoices</h1>
        </div>
        <Button size="sm" className="rounded-2xl h-9 text-xs font-bold" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New Invoice
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { label: 'Paid', value: stats.paid, bg: 'bg-[hsl(150,40%,90%)]', text: 'text-[hsl(150,60%,40%)]' },
          { label: 'Pending', value: stats.pending, bg: 'bg-[hsl(45,70%,90%)]', text: 'text-[hsl(45,60%,35%)]' },
          { label: 'Overdue', value: stats.overdue, bg: 'bg-[hsl(0,60%,93%)]', text: 'text-[hsl(0,60%,50%)]' },
        ] as const).map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} p-3 text-center`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>{s.label}</p>
            <p className={`text-sm font-bold ${s.text} mt-0.5`}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2">
        {(['all', 'paid', 'pending', 'overdue'] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`rounded-xl px-3 py-1.5 text-[10px] font-bold capitalize transition-all ${statusFilter === f ? 'bg-foreground text-background' : 'bg-card text-muted-foreground'}`}>
            {f === 'all' ? 'All' : f} {f !== 'all' && `(${invoices.filter(i => i.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-3xl border-2 border-foreground bg-card">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">Create Invoice</p>
                <button onClick={() => { setShowCreate(false); resetForm(); }}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>

              {/* Client Info */}
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

              {/* Line Items */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Line Items</p>
                {newItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <Input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description" className="rounded-xl text-xs" />
                      <div className="flex gap-2">
                        <Input type="number" value={item.quantity || ''} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} placeholder="Qty" className="rounded-xl text-xs w-20" />
                        <Input type="number" value={item.unitPrice || ''} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} placeholder="Unit price (XAF)" className="rounded-xl text-xs flex-1" />
                      </div>
                    </div>
                    {newItems.length > 1 && (
                      <button onClick={() => removeItem(i)} className="mt-2"><X className="h-4 w-4 text-muted-foreground" /></button>
                    )}
                  </div>
                ))}
                <button onClick={addItem} className="flex items-center gap-1 text-[11px] font-bold text-primary">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Add Line Item
                </button>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Notes (optional)</p>
                <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Payment terms, notes..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs outline-none resize-none h-16" />
              </div>

              {/* Total & Submit */}
              <div className="flex items-center justify-between rounded-2xl bg-muted p-3">
                <span className="text-xs font-bold text-muted-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">{totalAmount.toLocaleString()} XAF</span>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="rounded-2xl h-11 text-xs font-bold">
                {creating ? <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Creating...</span> : 'Create & Send Invoice'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoice List */}
      <div className="space-y-2">
        {filtered.map((inv, i) => {
          const cfg = statusConfig[inv.status];
          const isExpanded = expandedId === inv.id;
          return (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="rounded-3xl bg-card border-2 border-border overflow-hidden">
              <button onClick={() => setExpandedId(isExpanded ? null : inv.id)} className="flex items-center gap-3 p-4 w-full text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(50,80%,90%)]">
                  <FileText className="h-5 w-5 text-[hsl(50,60%,35%)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{inv.client}</p>
                  <p className="text-[11px] text-muted-foreground">{inv.id} · {inv.date}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-sm font-bold text-foreground">{inv.amount.toLocaleString()}</p>
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                    <cfg.icon className="h-3 w-3" strokeWidth={2} /> {cfg.label}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} strokeWidth={1.5} />
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><span className="text-muted-foreground">Email:</span> <span className="font-semibold text-foreground">{inv.clientEmail}</span></div>
                        <div><span className="text-muted-foreground">Due:</span> <span className="font-semibold text-foreground">{inv.dueDate}</span></div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Items</p>
                        {inv.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[11px]">
                            <span className="text-foreground">{item.description} × {item.quantity}</span>
                            <span className="font-bold text-foreground">{(item.quantity * item.unitPrice).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      {inv.notes && <p className="text-[11px] text-muted-foreground italic">{inv.notes}</p>}
                      {(inv.status === 'pending' || inv.status === 'overdue') && (
                        <Button size="sm" variant="outline" className="rounded-xl text-[11px] h-8 w-full" onClick={() => toast.success(`Reminder sent to ${inv.clientEmail}`)}>
                          <Send className="mr-1.5 h-3 w-3" strokeWidth={1.5} /> Send Reminder
                        </Button>
                      )}
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

export default CustomerInvoices;
