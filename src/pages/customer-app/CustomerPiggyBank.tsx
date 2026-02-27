import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PiggyBank, Plus, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerSavings } from '@/hooks/useCustomerData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const goalColors = [
  { color: 'bg-[hsl(210,80%,93%)]', barColor: 'bg-[hsl(210,60%,45%)]' },
  { color: 'bg-[hsl(150,40%,90%)]', barColor: 'bg-[hsl(150,40%,35%)]' },
  { color: 'bg-[hsl(340,60%,92%)]', barColor: 'bg-[hsl(340,50%,40%)]' },
  { color: 'bg-[hsl(45,70%,90%)]', barColor: 'bg-[hsl(45,60%,35%)]' },
  { color: 'bg-[hsl(270,60%,92%)]', barColor: 'bg-[hsl(270,50%,45%)]' },
  { color: 'bg-[hsl(25,80%,92%)]', barColor: 'bg-[hsl(25,60%,40%)]' },
];

const CustomerPiggyBank: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: goals = [], isLoading } = useCustomerSavings(user?.id);
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [creating, setCreating] = useState(false);

  const totalSaved = goals.reduce((s: number, g: any) => s + (g.current_balance || 0), 0);

  const handleCreate = async () => {
    if (!newName.trim() || !newTarget) { toast.error('Fill in all fields'); return; }
    setCreating(true);
    try {
      // This would need a proper API - for now show feedback
      toast.info('Savings goal creation coming soon. Contact your bank to set up a savings account.');
    } finally {
      setCreating(false);
      setShowCreate(false);
      setNewName('');
      setNewTarget('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Piggy Bank</h1>
        </div>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

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

      {/* Goals from DB */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <PiggyBank className="h-12 w-12 text-muted-foreground" strokeWidth={1} />
          <p className="text-sm font-semibold text-muted-foreground">No savings goals yet</p>
          <p className="text-xs text-muted-foreground text-center">Create a savings goal to start saving</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal: any, i: number) => {
            const target = goal.target_amount || 0;
            const saved = goal.current_balance || 0;
            const pct = target > 0 ? Math.round((saved / target) * 100) : 0;
            const c = goalColors[i % goalColors.length];
            return (
              <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} className={`rounded-3xl ${c.color} p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-foreground">{goal.account_name || `Goal ${i + 1}`}</p>
                  {target > 0 && <span className="text-xs font-bold text-muted-foreground">{pct}%</span>}
                </div>
                {target > 0 && (
                  <div className="h-2 rounded-full bg-background/50 overflow-hidden">
                    <div className={`h-full rounded-full ${c.barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                )}
                <div className="mt-2 flex justify-between">
                  <p className="text-[10px] text-muted-foreground">{saved.toLocaleString()} saved</p>
                  {target > 0 && <p className="text-[10px] text-muted-foreground">of {target.toLocaleString()}</p>}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Button variant="outline" className="w-full rounded-2xl h-12" onClick={() => setShowCreate(true)}>
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Create New Goal
      </Button>
    </div>
  );
};

export default CustomerPiggyBank;
