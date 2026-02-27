import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Plus, Zap, Wifi, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const payments = [
  { name: 'ENEO Electricity', amount: 15000, frequency: 'Monthly', nextDate: 'Mar 1', active: true, icon: Zap, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  { name: 'Camtel Internet', amount: 25000, frequency: 'Monthly', nextDate: 'Mar 5', active: true, icon: Wifi, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  { name: 'MTN Airtime', amount: 5000, frequency: 'Weekly', nextDate: 'Feb 28', active: false, icon: Smartphone, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
];

const CustomerRecurring: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Recurring Payments</h1>
      </div>

      <div className="space-y-2">
        {payments.map((p, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
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
              <div className={`h-5 w-9 rounded-full flex items-center px-0.5 transition-colors ${p.active ? 'bg-primary justify-end' : 'bg-muted justify-start'}`}>
                <div className="h-4 w-4 rounded-full bg-background shadow-sm" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Button variant="outline" className="w-full rounded-2xl h-12">
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Add Recurring Payment
      </Button>
    </div>
  );
};

export default CustomerRecurring;
