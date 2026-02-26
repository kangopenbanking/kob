import React, { useState } from 'react';
import { Search, Filter, Download, ArrowDownLeft, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const mockTransactions = [
  { id: '1', name: 'MTN MoMo Transfer', amount: -15000, date: '2026-02-26', type: 'debit', category: 'Transfer' },
  { id: '2', name: 'Salary Deposit', amount: 450000, date: '2026-02-25', type: 'credit', category: 'Income' },
  { id: '3', name: 'Electricity Bill', amount: -8500, date: '2026-02-24', type: 'debit', category: 'Utilities' },
  { id: '4', name: 'Orange Money Top Up', amount: -5000, date: '2026-02-23', type: 'debit', category: 'Transfer' },
  { id: '5', name: 'Freelance Payment', amount: 75000, date: '2026-02-22', type: 'credit', category: 'Income' },
  { id: '6', name: 'Restaurant', amount: -3500, date: '2026-02-21', type: 'debit', category: 'Food' },
  { id: '7', name: 'Water Bill', amount: -4200, date: '2026-02-20', type: 'debit', category: 'Utilities' },
];

const BankHistory: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');

  const filtered = mockTransactions.filter((tx) => {
    const matchSearch = tx.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || tx.type === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">History</h1>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" strokeWidth={1.5} />
          Export
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-2">
        {(['all', 'credit', 'debit'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Transactions */}
      <div className="flex flex-col gap-1">
        {filtered.map((tx, i) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
                tx.type === 'credit' ? 'bg-secondary/10' : 'bg-destructive/10'
              }`}>
                {tx.type === 'credit' ? (
                  <ArrowDownLeft className="h-4 w-4 text-secondary" strokeWidth={1.5} />
                ) : (
                  <Send className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{tx.name}</p>
                <p className="text-xs text-muted-foreground">{tx.date} · {tx.category}</p>
              </div>
            </div>
            <span className={`text-sm font-semibold ${
              tx.type === 'credit' ? 'text-secondary' : 'text-foreground'
            }`}>
              {tx.type === 'credit' ? '+' : ''}{tx.amount.toLocaleString()} XAF
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default BankHistory;
