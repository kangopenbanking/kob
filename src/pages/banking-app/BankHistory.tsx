import React, { useState } from 'react';
import { Search, Download, ArrowDownLeft, Send, Calendar } from 'lucide-react';
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

  // Group by date
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, tx) => {
    const label = tx.date === '2026-02-26' ? 'Today' : tx.date === '2026-02-25' ? 'Yesterday' : tx.date;
    if (!acc[label]) acc[label] = [];
    acc[label].push(tx);
    return acc;
  }, {});

  return (
    <div className="flex flex-col px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">History</h1>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl font-semibold">
          <Download className="h-4 w-4" strokeWidth={2} />
          Export
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-2xl border-2 py-6 pl-11 text-base font-medium"
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-2">
        {(['all', 'credit', 'debit'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition-colors ${
              filter === f
                ? f === 'credit' ? 'bg-[hsl(var(--bank-mint))] text-[hsl(var(--bank-mint-fg))]'
                  : f === 'debit' ? 'bg-[hsl(var(--bank-coral))] text-white'
                  : 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'credit' ? 'Income' : 'Expense'}
          </button>
        ))}
      </div>

      {/* Transactions grouped */}
      <div className="flex flex-col gap-5">
        {Object.entries(grouped).map(([dateLabel, txs]) => (
          <div key={dateLabel}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{dateLabel}</p>
            <div className="flex flex-col gap-1">
              {txs.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between rounded-2xl px-3 py-3.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                      tx.type === 'credit' ? 'bg-[hsl(var(--bank-mint))]/15' : 'bg-[hsl(var(--bank-coral))]/15'
                    }`}>
                      {tx.type === 'credit' ? (
                        <ArrowDownLeft className="h-5 w-5 text-[hsl(var(--bank-teal))]" strokeWidth={1.5} />
                      ) : (
                        <Send className="h-5 w-5 text-[hsl(var(--bank-coral))]" strokeWidth={1.5} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{tx.name}</p>
                      <p className="text-xs font-medium text-muted-foreground">{tx.category}</p>
                    </div>
                  </div>
                  <span className={`text-base font-bold ${
                    tx.type === 'credit' ? 'text-[hsl(var(--bank-teal))]' : 'text-foreground'
                  }`}>
                    {tx.type === 'credit' ? '+' : ''}{tx.amount.toLocaleString()} XAF
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BankHistory;
