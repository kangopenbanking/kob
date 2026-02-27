import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Clock, CheckCircle2, XCircle, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  client: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  date: string;
}

const statusConfig = {
  paid: { icon: CheckCircle2, color: 'text-[hsl(150,60%,40%)]', bg: 'bg-[hsl(150,40%,90%)]', label: 'Paid' },
  pending: { icon: Clock, color: 'text-[hsl(45,60%,35%)]', bg: 'bg-[hsl(45,70%,90%)]', label: 'Pending' },
  overdue: { icon: XCircle, color: 'text-[hsl(0,60%,50%)]', bg: 'bg-[hsl(0,60%,93%)]', label: 'Overdue' },
};

const initialInvoices: Invoice[] = [
  { id: 'INV-001', client: 'Acme Corp', amount: 150000, status: 'paid', date: 'Feb 20' },
  { id: 'INV-002', client: 'Tech Solutions', amount: 85000, status: 'pending', date: 'Feb 25' },
  { id: 'INV-003', client: 'Global Imports', amount: 320000, status: 'overdue', date: 'Feb 10' },
  { id: 'INV-004', client: 'Local Shop', amount: 45000, status: 'paid', date: 'Feb 18' },
];

const CustomerInvoices: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    if (!newClient.trim() || !newAmount) { toast.error('Fill in client name and amount'); return; }
    setCreating(true);
    setTimeout(() => {
      const inv: Invoice = {
        id: `INV-${String(invoices.length + 1).padStart(3, '0')}`,
        client: newClient.trim(),
        amount: Number(newAmount),
        status: 'pending',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
      setInvoices([inv, ...invoices]);
      setShowCreate(false);
      setNewClient('');
      setNewAmount('');
      setCreating(false);
      toast.success(`Invoice ${inv.id} created`);
    }, 1000);
  };

  const handleSendReminder = (inv: Invoice) => {
    toast.success(`Reminder sent to ${inv.client}`);
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Invoices</h1>
        </div>
        <Button size="sm" className="rounded-xl h-9" onClick={() => setShowCreate(true)}><Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New</Button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">Create Invoice</p>
                <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <Input value={newClient} onChange={e => setNewClient(e.target.value)} placeholder="Client name" className="rounded-xl" />
              <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Amount (XAF)" className="rounded-xl" />
              <Button onClick={handleCreate} disabled={creating} className="rounded-xl h-10">
                {creating ? 'Creating...' : 'Create Invoice'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {invoices.map((inv, i) => {
          const cfg = statusConfig[inv.status];
          return (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="rounded-2xl bg-card p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(50,80%,90%)]">
                  <FileText className="h-5 w-5 text-[hsl(50,60%,35%)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{inv.client}</p>
                  <p className="text-[11px] text-muted-foreground">{inv.id} · {inv.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{inv.amount.toLocaleString()}</p>
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                    <cfg.icon className="h-3 w-3" strokeWidth={2} /> {cfg.label}
                  </span>
                </div>
              </div>
              {(inv.status === 'pending' || inv.status === 'overdue') && (
                <button onClick={() => handleSendReminder(inv)}
                  className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary">
                  <Send className="h-3 w-3" strokeWidth={1.5} /> Send Reminder
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerInvoices;
