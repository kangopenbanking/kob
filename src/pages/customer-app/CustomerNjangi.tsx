import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleDollarSign, Users, Calendar, Plus, ChevronRight, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerNjangi } from '@/hooks/useCustomerData';

const circleColors = [
  { color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
  { color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  { color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]' },
  { color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
];

const CustomerNjangi: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: circles = [], isLoading } = useCustomerNjangi(user?.id, institutionId);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContribution, setNewContribution] = useState('');
  const [newMembers, setNewMembers] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim() || !newContribution || !newMembers) { toast.error('Fill in all fields'); return; }
    setCreating(true);
    try {
      toast.info('Njangi circle creation coming soon.');
    } finally {
      setCreating(false);
      setShowCreate(false);
      setNewName('');
      setNewContribution('');
      setNewMembers('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Njangi</h1>
        </div>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

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

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">Create New Circle</p>
                <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Circle name" className="rounded-xl" />
              <Input type="number" value={newContribution} onChange={e => setNewContribution(e.target.value)} placeholder="Contribution per round (XAF)" className="rounded-xl" />
              <Input type="number" value={newMembers} onChange={e => setNewMembers(e.target.value)} placeholder="Number of members" className="rounded-xl" />
              <Button onClick={handleCreate} disabled={creating} className="rounded-xl h-10">
                {creating ? 'Creating...' : 'Create Circle'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Circles from DB */}
      {circles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <CircleDollarSign className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
          <p className="text-sm font-semibold text-muted-foreground">No active circles</p>
          <p className="text-xs text-muted-foreground text-center">Join or create a Njangi circle</p>
        </div>
      ) : (
        circles.map((c: any, i: number) => {
          const style = circleColors[i % circleColors.length];
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} className={`rounded-3xl ${style.color} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-foreground">{c.name}</p>
                <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-[11px] text-muted-foreground">{c.member_count} members</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-[11px] text-muted-foreground">{c.contribution_amount?.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-[11px] text-muted-foreground">{c.frequency}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-background/50 overflow-hidden">
                  <div className="h-full rounded-full bg-[hsl(270,50%,45%)]" style={{ width: `${c.max_members > 0 ? (c.current_cycle / c.max_members) * 100 : 0}%` }} />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">Cycle {c.current_cycle}</span>
              </div>
            </motion.div>
          );
        })
      )}

      <Button variant="outline" className="w-full rounded-2xl h-12" onClick={() => setShowCreate(true)}>
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Join or Create Circle
      </Button>
    </div>
  );
};

export default CustomerNjangi;
