import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, ShoppingBag, Zap, Smartphone, Search, Gift } from 'lucide-react';
import { motion } from 'framer-motion';

const filters = ['All', 'Income', 'Expenses', 'Transfers'];

const allTransactions = [
  { name: 'Grocery Store', type: 'Shopping', category: 'Expenses', amount: -12500, date: 'Today', time: '2:30 PM', icon: ShoppingBag, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  { name: 'Salary Deposit', type: 'Income', category: 'Income', amount: 350000, date: 'Today', time: '9:00 AM', icon: ArrowDownLeft, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]' },
  { name: 'Transfer to John', type: 'Transfer', category: 'Transfers', amount: -25000, date: 'Yesterday', time: '4:15 PM', icon: ArrowUpRight, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  { name: 'Electricity Bill', type: 'Bills', category: 'Expenses', amount: -15000, date: 'Yesterday', time: '11:00 AM', icon: Zap, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  { name: 'MoMo Top Up', type: 'Mobile Money', category: 'Expenses', amount: -10000, date: 'This Week', time: 'Feb 24', icon: Smartphone, color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]' },
  { name: 'Cashback Reward', type: 'Rewards', category: 'Income', amount: 1500, date: 'This Week', time: 'Feb 23', icon: Gift, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
  { name: 'Transfer to Marie', type: 'Transfer', category: 'Transfers', amount: -30000, date: 'This Week', time: 'Feb 22', icon: ArrowUpRight, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
];

const CustomerActivity: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = allTransactions.filter((tx) => {
    if (activeFilter !== 'All' && tx.category !== activeFilter) return false;
    if (search && !tx.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, typeof allTransactions>>((acc, tx) => {
    (acc[tx.date] = acc[tx.date] || []).push(tx);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5 p-5">
      <h1 className="text-xl font-bold text-foreground">Activity</h1>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-2xl bg-muted p-3">
        <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transactions..." className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted-foreground" />
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {filters.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Grouped Transactions */}
      {Object.entries(grouped).map(([date, txs]) => (
        <div key={date}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{date}</p>
          <div className="space-y-2">
            {txs.map((tx, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tx.color}`}>
                  <tx.icon className={`h-5 w-5 ${tx.iconColor}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{tx.name}</p>
                  <p className="text-[11px] text-muted-foreground">{tx.type} · {tx.time}</p>
                </div>
                <p className={`text-sm font-bold tabular-nums ${tx.amount > 0 ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} <span className="text-[10px] font-medium text-muted-foreground">XAF</span>
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CustomerActivity;
