import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Search, User, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const recentContacts = [
  { name: 'John D.', initials: 'JD', color: 'bg-[hsl(210,80%,93%)]' },
  { name: 'Marie K.', initials: 'MK', color: 'bg-[hsl(340,60%,92%)]' },
  { name: 'Paul N.', initials: 'PN', color: 'bg-[hsl(150,40%,90%)]' },
  { name: 'Grace T.', initials: 'GT', color: 'bg-[hsl(45,70%,90%)]' },
  { name: 'Eric B.', initials: 'EB', color: 'bg-[hsl(270,60%,92%)]' },
];

const CustomerTransfer: React.FC = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!amount || selectedContact === null) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      toast.success(`XAF ${Number(amount).toLocaleString()} sent to ${recentContacts[selectedContact].name}`);
      setTimeout(() => {
        setSent(false);
        setAmount('');
        setSelectedContact(null);
      }, 2500);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Transfer</h1>
      </div>

      <AnimatePresence mode="wait">
        {sent ? (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(150,40%,90%)]">
              <CheckCircle2 className="h-10 w-10 text-[hsl(150,40%,35%)]" strokeWidth={1.5} />
            </div>
            <p className="text-lg font-bold text-foreground">Transfer Successful!</p>
            <p className="text-sm text-muted-foreground">XAF {Number(amount || 0).toLocaleString()} sent to {selectedContact !== null ? recentContacts[selectedContact]?.name : ''}</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
            {/* Amount Input */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 rounded-3xl bg-[hsl(225,50%,22%)] p-8">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60">Enter Amount</p>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-[hsl(0,0%,100%)]/60">XAF</span>
                <input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0" className="bg-transparent text-4xl font-bold text-[hsl(0,0%,100%)] outline-none w-full text-center placeholder:text-[hsl(0,0%,100%)]/30" />
              </div>
              <p className="text-xs text-[hsl(0,0%,100%)]/40">Available: 485,000 XAF</p>
            </motion.div>

            {/* Recent Contacts */}
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Recent</p>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                {recentContacts.map((c, i) => (
                  <button key={i} onClick={() => setSelectedContact(i)}
                    className={`flex flex-col items-center gap-2 ${selectedContact === i ? 'scale-105' : ''} transition-transform`}>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${c.color} ${selectedContact === i ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                      <span className="text-sm font-bold text-foreground">{c.initials}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-foreground">{c.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* New Recipient */}
            <button className="flex items-center gap-3 rounded-2xl bg-card p-3.5" onClick={() => toast.info('Search contacts coming soon')}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Search className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground text-left">Search or enter number</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </button>

            {/* Account Selector */}
            <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(225,50%,22%)]">
                <User className="h-5 w-5 text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">From: Main Wallet</p>
                <p className="text-[10px] text-muted-foreground">485,000 XAF available</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>

            <Button className="w-full rounded-2xl h-12 text-sm font-bold" disabled={!amount || selectedContact === null || sending} onClick={handleSend}>
              {sending ? (
                <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Sending...</span>
              ) : (
                <><Send className="mr-2 h-4 w-4" strokeWidth={1.5} /> Send Money</>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerTransfer;
