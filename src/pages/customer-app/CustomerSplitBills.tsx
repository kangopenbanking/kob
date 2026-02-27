import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const participants = [
  { name: 'You', initials: 'ME', color: 'bg-[hsl(210,80%,93%)]' },
  { name: 'John', initials: 'JD', color: 'bg-[hsl(150,40%,90%)]' },
  { name: 'Marie', initials: 'MK', color: 'bg-[hsl(340,60%,92%)]' },
  { name: 'Paul', initials: 'PN', color: 'bg-[hsl(45,70%,90%)]' },
];

const CustomerSplitBills: React.FC = () => {
  const navigate = useNavigate();
  const [total, setTotal] = useState('25000');
  const perPerson = Math.ceil(Number(total || 0) / participants.length);

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Split Bills</h1>
      </div>

      {/* Total */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-2 rounded-3xl bg-[hsl(340,60%,92%)] p-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Bill</p>
        <input type="text" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))}
          className="bg-transparent text-3xl font-bold text-foreground outline-none text-center w-full" />
        <p className="text-xs text-muted-foreground">÷ {participants.length} people = {perPerson.toLocaleString()} XAF each</p>
      </motion.div>

      {/* Participants */}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Participants</p>
      <div className="space-y-2">
        {participants.map((p, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.color}`}>
              <span className="text-xs font-bold text-foreground">{p.initials}</span>
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground">{p.name}</span>
            <span className="text-sm font-bold text-foreground">{perPerson.toLocaleString()} XAF</span>
          </div>
        ))}
      </div>

      <button className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-3">
        <Plus className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-xs font-semibold text-muted-foreground">Add Person</span>
      </button>

      <Button className="w-full rounded-2xl h-12 text-sm font-bold">
        <Users className="mr-2 h-4 w-4" strokeWidth={1.5} /> Send Split Request
      </Button>
    </div>
  );
};

export default CustomerSplitBills;
