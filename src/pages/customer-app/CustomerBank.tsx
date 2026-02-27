import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface LinkedAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  currency: string;
  color: string;
  transactions: { id: string; desc: string; amount: number; date: string }[];
}

const initialAccounts: LinkedAccount[] = [
  {
    id: '1', bankName: 'Afriland First Bank', accountNumber: '****4521', balance: 1250000, currency: 'XAF', color: 'hsl(210,80%,90%)',
    transactions: [
      { id: 't1', desc: 'Salary Credit', amount: 450000, date: '2026-02-25' },
      { id: 't2', desc: 'Transfer to MTN MoMo', amount: -50000, date: '2026-02-22' },
      { id: 't3', desc: 'ATM Withdrawal', amount: -100000, date: '2026-02-18' },
    ],
  },
  {
    id: '2', bankName: 'UBA Cameroon', accountNumber: '****8903', balance: 780000, currency: 'XAF', color: 'hsl(0,70%,90%)',
    transactions: [
      { id: 't4', desc: 'Freelance Payment', amount: 200000, date: '2026-02-24' },
      { id: 't5', desc: 'Electricity Bill', amount: -15000, date: '2026-02-20' },
    ],
  },
];

const availableBanks = ['Ecobank', 'BICEC', 'SCB Cameroun', 'National Financial Credit', 'CCA Bank'];

const CustomerBank: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<LinkedAccount[]>(initialAccounts);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [selectedBank, setSelectedBank] = useState('');
  const [newAccNum, setNewAccNum] = useState('');
  const [linking, setLinking] = useState(false);

  const handleUnlink = (id: string, name: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    toast.success(`${name} unlinked`);
  };

  const handleLink = () => {
    if (!selectedBank || !newAccNum) { toast.error('Select a bank and enter account number'); return; }
    setLinking(true);
    setTimeout(() => {
      const newAccount: LinkedAccount = {
        id: Date.now().toString(), bankName: selectedBank, accountNumber: `****${newAccNum.slice(-4)}`,
        balance: Math.floor(Math.random() * 500000) + 100000, currency: 'XAF',
        color: `hsl(${Math.floor(Math.random() * 360)},60%,90%)`, transactions: [],
      };
      setAccounts(prev => [...prev, newAccount]);
      setShowLinkForm(false);
      setSelectedBank('');
      setNewAccNum('');
      setLinking(false);
      toast.success(`${selectedBank} linked successfully`);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Linked Accounts</h1>
        </div>
        <button onClick={() => setShowLinkForm(true)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <Plus className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
        </button>
      </div>

      <AnimatePresence>
        {showLinkForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Link New Account</h3>
                <button onClick={() => setShowLinkForm(false)}><X className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} /></button>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Select Bank</label>
                <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                  <option value="">Choose a bank</option>
                  {availableBanks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Account Number</label>
                <Input value={newAccNum} onChange={e => setNewAccNum(e.target.value)} placeholder="Enter account number" className="rounded-xl border-border" />
              </div>
              <Button onClick={handleLink} disabled={linking} className="h-11 rounded-2xl font-semibold">
                {linking ? 'Linking...' : 'Link Account'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3">
        {accounts.map(acc => (
          <motion.div key={acc.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-3xl border-2" style={{ borderColor: acc.color, backgroundColor: acc.color }}>
            <button onClick={() => setExpandedId(expandedId === acc.id ? null : acc.id)} className="flex w-full items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/60">
                  <Building2 className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{acc.bankName}</span>
                  <span className="text-xs text-foreground/60">{acc.accountNumber}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{acc.balance.toLocaleString()} {acc.currency}</span>
                {expandedId === acc.id ? <ChevronUp className="h-4 w-4 text-foreground/60" /> : <ChevronDown className="h-4 w-4 text-foreground/60" />}
              </div>
            </button>

            <AnimatePresence>
              {expandedId === acc.id && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="border-t border-foreground/10 bg-background/40 px-4 pb-4 pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Recent Transactions</p>
                    {acc.transactions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No transactions yet</p>
                    ) : acc.transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between py-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground">{tx.desc}</span>
                          <span className="text-[11px] text-muted-foreground">{tx.date}</span>
                        </div>
                        <span className={`text-xs font-semibold ${tx.amount > 0 ? 'text-primary' : 'text-destructive'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} XAF
                        </span>
                      </div>
                    ))}
                    <button onClick={() => handleUnlink(acc.id, acc.bankName)}
                      className="mt-3 flex items-center gap-1.5 text-xs font-medium text-destructive">
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Unlink Account
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}

        {accounts.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">No linked accounts</p>
            <Button onClick={() => setShowLinkForm(true)} size="sm" className="rounded-xl">Link Account</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerBank;
