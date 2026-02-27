import React from 'react';
import { ArrowUpRight, ArrowDownLeft, ShoppingBag, Zap, Smartphone } from 'lucide-react';

const transactions = [
  { name: 'Grocery Store', type: 'Shopping', amount: -12500, date: 'Today, 2:30 PM', icon: ShoppingBag, color: 'bg-[hsl(25,80%,92%)]' },
  { name: 'Salary Deposit', type: 'Income', amount: 350000, date: 'Today, 9:00 AM', icon: ArrowDownLeft, color: 'bg-[hsl(150,40%,90%)]' },
  { name: 'Transfer to John', type: 'Transfer', amount: -25000, date: 'Yesterday', icon: ArrowUpRight, color: 'bg-[hsl(210,80%,93%)]' },
  { name: 'Electricity Bill', type: 'Bills', amount: -15000, date: 'Yesterday', icon: Zap, color: 'bg-[hsl(50,80%,90%)]' },
  { name: 'MoMo Top Up', type: 'Mobile Money', amount: -10000, date: 'Feb 24', icon: Smartphone, color: 'bg-[hsl(340,60%,92%)]' },
];

const CustomerActivity: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-5">
      <h1 className="text-xl font-bold text-foreground">Activity</h1>

      <div className="space-y-3">
        {transactions.map((tx, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tx.color}`}>
              <tx.icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{tx.name}</p>
              <p className="text-xs text-muted-foreground">{tx.date}</p>
            </div>
            <p className={`text-sm font-bold ${tx.amount > 0 ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`}>
              {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} XAF
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerActivity;
