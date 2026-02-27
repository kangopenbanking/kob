import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, Plus, Copy, Share2, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface PayLink {
  name: string;
  amount: number | null;
  clicks: number;
  created: string;
  active: boolean;
}

const initialLinks: PayLink[] = [
  { name: 'Product Payment', amount: 25000, clicks: 12, created: 'Feb 20', active: true },
  { name: 'Service Fee', amount: 50000, clicks: 5, created: 'Feb 15', active: true },
  { name: 'Donation Link', amount: null, clicks: 34, created: 'Jan 30', active: false },
];

const CustomerPayLinks: React.FC = () => {
  const navigate = useNavigate();
  const [links, setLinks] = useState(initialLinks);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) { toast.error('Enter a link name'); return; }
    setCreating(true);
    setTimeout(() => {
      const newLink: PayLink = {
        name: newName.trim(),
        amount: newAmount ? Number(newAmount) : null,
        clicks: 0,
        created: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        active: true,
      };
      setLinks([newLink, ...links]);
      setShowCreate(false);
      setNewName('');
      setNewAmount('');
      setCreating(false);
      toast.success('Pay link created!');
    }, 1000);
  };

  const handleCopy = (name: string) => {
    navigator.clipboard.writeText(`https://pay.kobpay.com/${name.toLowerCase().replace(/\s/g, '-')}`).then(
      () => toast.success('Link copied to clipboard'),
      () => toast.success('Link copied!')
    );
  };

  const handleShare = (name: string) => {
    if (navigator.share) {
      navigator.share({ title: name, url: `https://pay.kobpay.com/${name.toLowerCase().replace(/\s/g, '-')}` });
    } else {
      toast.info('Share not supported, link copied instead');
      handleCopy(name);
    }
  };

  const handleToggle = (i: number) => {
    setLinks(links.map((l, idx) => idx === i ? { ...l, active: !l.active } : l));
    toast.success(links[i].active ? 'Link deactivated' : 'Link activated');
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Pay Links</h1>
        </div>
        <Button size="sm" className="rounded-xl h-9" onClick={() => setShowCreate(true)}><Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} /> New</Button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">Create Pay Link</p>
                <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Link name (e.g. Product Payment)" className="rounded-xl" />
              <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Amount (leave empty for open)" className="rounded-xl" />
              <Button onClick={handleCreate} disabled={creating} className="rounded-xl h-10">
                {creating ? 'Creating...' : 'Create Link'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {links.map((link, i) => (
          <motion.div key={`${link.name}-${i}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }} className="rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">{link.name}</p>
              <button onClick={() => handleToggle(i)}
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${link.active ? 'bg-[hsl(150,40%,90%)] text-[hsl(150,60%,40%)]' : 'bg-muted text-muted-foreground'}`}>
                {link.active ? 'Active' : 'Inactive'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {link.amount ? `${link.amount.toLocaleString()} XAF` : 'Open amount'} · {link.clicks} clicks · {link.created}
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleCopy(link.name)} className="flex items-center gap-1 rounded-xl bg-muted px-3 py-1.5">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[10px] font-bold text-muted-foreground">Copy</span>
              </button>
              <button onClick={() => handleShare(link.name)} className="flex items-center gap-1 rounded-xl bg-muted px-3 py-1.5">
                <Share2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[10px] font-bold text-muted-foreground">Share</span>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CustomerPayLinks;
