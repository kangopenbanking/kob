import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const initialParticipants = [
  { name: 'You', initials: 'ME', color: 'bg-[hsl(210,80%,93%)]' },
  { name: 'John', initials: 'JD', color: 'bg-[hsl(150,40%,90%)]' },
  { name: 'Marie', initials: 'MK', color: 'bg-[hsl(340,60%,92%)]' },
  { name: 'Paul', initials: 'PN', color: 'bg-[hsl(45,70%,90%)]' },
];

const colors = ['bg-[hsl(270,60%,92%)]', 'bg-[hsl(25,80%,92%)]', 'bg-[hsl(180,50%,90%)]'];

const CustomerSplitBills: React.FC = () => {
  const navigate = useNavigate();
  const [total, setTotal] = useState('25000');
  const [participants, setParticipants] = useState(initialParticipants);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const perPerson = Math.ceil(Number(total || 0) / participants.length);

  const handleAddPerson = () => {
    if (!newName.trim()) { toast.error('Enter a name'); return; }
    const initials = newName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    setParticipants([...participants, { name: newName.trim(), initials, color: colors[participants.length % colors.length] }]);
    setNewName('');
    setShowAdd(false);
    toast.success(`${newName.trim()} added`);
  };

  const handleRemove = (i: number) => {
    if (i === 0) return; // Can't remove self
    const name = participants[i].name;
    setParticipants(participants.filter((_, idx) => idx !== i));
    toast.success(`${name} removed`);
  };

  const handleSend = () => {
    if (!total || participants.length < 2) { toast.error('Need at least 2 people'); return; }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      toast.success(`Split request sent to ${participants.length - 1} people`);
      setTimeout(() => { setSent(false); }, 2500);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Split Bills</h1>
      </div>

      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
              <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-bold text-foreground">Split Request Sent!</p>
            <p className="text-sm text-muted-foreground">{perPerson.toLocaleString()} XAF each to {participants.length - 1} people</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
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
                  {i > 0 && (
                    <button onClick={() => handleRemove(i)} className="ml-1">
                      <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {showAdd ? (
              <div className="flex gap-2">
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter name" className="rounded-xl flex-1" />
                <Button onClick={handleAddPerson} size="sm" className="rounded-xl">Add</Button>
                <Button onClick={() => setShowAdd(false)} size="sm" variant="outline" className="rounded-xl">Cancel</Button>
              </div>
            ) : (
              <button onClick={() => setShowAdd(true)} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-3">
                <Plus className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-muted-foreground">Add Person</span>
              </button>
            )}

            <Button className="w-full rounded-2xl h-12 text-sm font-bold" onClick={handleSend} disabled={sending || !total || participants.length < 2}>
              {sending ? (
                <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Sending...</span>
              ) : (
                <><Users className="mr-2 h-4 w-4" strokeWidth={1.5} /> Send Split Request</>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerSplitBills;
