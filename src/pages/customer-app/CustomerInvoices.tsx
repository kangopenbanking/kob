import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const invoices = [
  { id: 'INV-001', client: 'Acme Corp', amount: 150000, status: 'paid', date: 'Feb 20' },
  { id: 'INV-002', client: 'Tech Solutions', amount: 85000, status: 'pending', date: 'Feb 25' },
  { id: 'INV-003', client: 'Global Imports', amount: 320000, status: 'overdue', date: 'Feb 10' },
  { id: 'INV-004', client: 'Local Shop', amount: 45000, status: 'paid', date: 'Feb 18' },
];

const statusConfig = {
  paid: { icon: CheckCircle2, color: 'text-[hsl(150,60%,40%)]', bg: 'bg-[hsl(150,40%,90%)]', label: 'Paid' },
  pending: { icon: Clock, color: 'text-[hsl(45,60%,35%)]', bg: 'bg-[hsl(45,70%,90%)]', label: 'Pending' },
  overdue: { icon: XCircle, color: 'text-[hsl(0,60%,50%)]', bg: 'bg-[hsl(0,60%,93%)]', label: 'Overdue' },
};

const CustomerInvoices: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Invoices</h1>
        </div>
        <Button size="sm" className="rounded-xl h-9"><Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New</Button>
      </div>

      <div className="space-y-2">
        {invoices.map((inv, i) => {
          const cfg = statusConfig[inv.status as keyof typeof statusConfig];
          return (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
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
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerInvoices;
