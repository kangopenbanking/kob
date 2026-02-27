import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PiggyBank, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Goal {
  name: string;
  target: number;
  saved: number;
  color: string;
  barColor: string;
}

const initialGoals: Goal[] = [
  { name: 'New Laptop', target: 450000, saved: 280000, color: 'bg-[hsl(210,80%,93%)]', barColor: 'bg-[hsl(210,60%,45%)]' },
  { name: 'Emergency Fund', target: 500000, saved: 375000, color: 'bg-[hsl(150,40%,90%)]', barColor: 'bg-[hsl(150,40%,35%)]' },
  { name: 'Holiday Trip', target: 300000, saved: 45000, color: 'bg-[hsl(340,60%,92%)]', barColor: 'bg-[hsl(340,50%,40%)]' },
];

const colors = [
  { color: 'bg-[hsl(45,70%,90%)]', barColor: 'bg-[hsl(45,60%,35%)]' },
  { color: 'bg-[hsl(270,60%,92%)]', barColor: 'bg-[hsl(270,50%,45%)]' },
  { color: 'bg-[hsl(25,80%,92%)]', barColor: 'bg-[hsl(25,60%,40%)]' },
];

const CustomerPiggyBank: React.FC = () => {
  const navigate = useNavigate();
  const [goals, setGoals] = useState(initialGoals);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [addAmount, setAddAmount] = useState('');

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);

  const handleCreate = () => {
    if (!newName.trim() || !newTarget) { toast.error('Fill in all fields'); return; }
    setCreating(true);
    setTimeout(() => {
      const c = colors[goals.length % colors.length];
      setGoals([...goals, { name: newName.trim(), target: Number(newTarget), saved: 0, ...c }]);
      setShowCreate(false);
      setNewName('');
      setNewTarget('');
      setCreating(false);
      toast.success('Goal created!');
    }, 800);
  };

  const handleAddSavings = (i: number) => {
    if (!addAmount || Number(addAmount) <= 0) { toast.error('Enter an amount'); return; }
    setGoals(goals.map((g, idx) => idx === i ? { ...g, saved: Math.min(g.saved + Number(addAmount), g.target) } : g));
    toast.success(`XAF ${Number(addAmount).toLocaleString()} added to ${goals[i].name}`);
    setAddingTo(null);
    setAddAmount('');
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Piggy Bank</h1>
      </div>

      {/* Total Savings Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-3xl bg-[hsl(340,60%,92%)] p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/50">
          <PiggyBank className="h-7 w-7 text-[hsl(340,50%,40%)]" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Total Saved</p>
          <p className="text-2xl font-bold text-foreground">{totalSaved.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">XAF</span></p>
        </div>
      </motion.div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">New Savings Goal</p>
                <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Goal name (e.g. New Phone)" className="rounded-xl" />
              <Input type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="Target amount (XAF)" className="rounded-xl" />
              <Button onClick={handleCreate} disabled={creating} className="rounded-xl h-10">
                {creating ? 'Creating...' : 'Create Goal'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals */}
      <div className="space-y-3">
        {goals.map((goal, i) => {
          const pct = Math.round((goal.saved / goal.target) * 100);
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }} className={`rounded-3xl ${goal.color} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-foreground">{goal.name}</p>
                <span className="text-xs font-bold text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-background/50 overflow-hidden">
                <div className={`h-full rounded-full ${goal.barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex justify-between">
                <p className="text-[10px] text-muted-foreground">{goal.saved.toLocaleString()} saved</p>
                <p className="text-[10px] text-muted-foreground">of {goal.target.toLocaleString()}</p>
              </div>
              {addingTo === i ? (
                <div className="mt-3 flex gap-2">
                  <Input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="Amount" className="rounded-xl flex-1 h-9 text-sm" />
                  <Button size="sm" onClick={() => handleAddSavings(i)} className="rounded-xl h-9">Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingTo(null)} className="rounded-xl h-9">Cancel</Button>
                </div>
              ) : (
                <button onClick={() => setAddingTo(i)} className="mt-2 text-[11px] font-semibold text-primary">+ Add Savings</button>
              )}
            </motion.div>
          );
        })}
      </div>

      <Button variant="outline" className="w-full rounded-2xl h-12" onClick={() => setShowCreate(true)}>
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Create New Goal
      </Button>
    </div>
  );
};

export default CustomerPiggyBank;
