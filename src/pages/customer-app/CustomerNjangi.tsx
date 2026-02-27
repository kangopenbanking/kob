import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleDollarSign, Users, Calendar, Plus, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const circles = [
  { name: 'Family Njangi', members: 8, contribution: 25000, nextPayout: 'Mar 15', position: 3, color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
  { name: 'Office Savings', members: 12, contribution: 10000, nextPayout: 'Mar 1', position: 7, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
];

const CustomerNjangi: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Njangi</h1>
      </div>

      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-3xl bg-[hsl(270,60%,92%)] p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/50">
          <CircleDollarSign className="h-7 w-7 text-[hsl(270,50%,45%)]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Active Circles</p>
          <p className="text-2xl font-bold text-foreground">{circles.length}</p>
        </div>
      </motion.div>

      {/* Circles */}
      {circles.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }} className={`rounded-3xl ${c.color} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">{c.name}</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-[11px] text-muted-foreground">{c.members} members</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-[11px] text-muted-foreground">{c.contribution.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span className="text-[11px] text-muted-foreground">{c.nextPayout}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-background/50 overflow-hidden">
              <div className="h-full rounded-full bg-[hsl(270,50%,45%)]" style={{ width: `${(c.position / c.members) * 100}%` }} />
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">#{c.position}</span>
          </div>
        </motion.div>
      ))}

      <Button variant="outline" className="w-full rounded-2xl h-12">
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Join or Create Circle
      </Button>
    </div>
  );
};

export default CustomerNjangi;
