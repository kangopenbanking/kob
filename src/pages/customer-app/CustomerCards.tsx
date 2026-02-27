import React, { useState } from 'react';
import { CreditCard, Plus, Lock, Snowflake, Eye, EyeOff, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

const cards = [
  { name: 'Main Card', last4: '4582', holder: 'John Doe', expires: '12/28', color: 'bg-[hsl(225,50%,22%)]', balance: 485000, frozen: false },
  { name: 'Savings Card', last4: '7291', holder: 'John Doe', expires: '06/27', color: 'bg-[hsl(150,35%,30%)]', balance: 120000, frozen: false },
  { name: 'MoMo Card', last4: '3156', holder: 'John Doe', expires: '09/29', color: 'bg-[hsl(25,60%,35%)]', balance: 35000, frozen: true },
];

const recentCardTx = [
  { name: 'Amazon Purchase', amount: -18500, time: '2h ago' },
  { name: 'Netflix Subscription', amount: -4500, time: 'Yesterday' },
  { name: 'Refund - ShopRite', amount: 8000, time: '3 days ago' },
];

const CustomerCards: React.FC = () => {
  const [activeCard, setActiveCard] = useState(0);
  const [showNumber, setShowNumber] = useState(false);
  const card = cards[activeCard];

  return (
    <div className="flex flex-col gap-5 p-5">
      <h1 className="text-xl font-bold text-foreground">Cards</h1>

      {/* Card Carousel */}
      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div key={activeCard} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            className={`rounded-3xl ${card.color} p-6`}>
            <div className="flex items-center justify-between">
              <CreditCard className="h-8 w-8 text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
              <div className="flex items-center gap-2">
                {card.frozen && <Snowflake className="h-4 w-4 text-[hsl(210,80%,75%)]" strokeWidth={1.5} />}
                <Lock className="h-4 w-4 text-[hsl(0,0%,100%)]/60" strokeWidth={1.5} />
              </div>
            </div>
            <p className="mt-6 text-lg font-mono tracking-widest text-[hsl(0,0%,100%)]">
              {showNumber ? '5312 8490 2716' : '**** **** ****'} {card.last4}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase text-[hsl(0,0%,100%)]/50">Card Holder</p>
                <p className="text-sm font-semibold text-[hsl(0,0%,100%)]">{card.holder}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-[hsl(0,0%,100%)]/50">Expires</p>
                <p className="text-sm font-semibold text-[hsl(0,0%,100%)]">{card.expires}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation dots */}
        <div className="mt-3 flex justify-center gap-1.5">
          {cards.map((_, i) => (
            <button key={i} onClick={() => setActiveCard(i)}
              className={`h-2 rounded-full transition-all ${i === activeCard ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'}`} />
          ))}
        </div>
      </div>

      {/* Card Controls */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => setShowNumber(!showNumber)} className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3">
          {showNumber ? <EyeOff className="h-5 w-5 text-foreground" strokeWidth={1.5} /> : <Eye className="h-5 w-5 text-foreground" strokeWidth={1.5} />}
          <span className="text-[10px] font-bold text-foreground">{showNumber ? 'Hide' : 'Show'}</span>
        </button>
        <button className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3">
          <Snowflake className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          <span className="text-[10px] font-bold text-foreground">{card.frozen ? 'Unfreeze' : 'Freeze'}</span>
        </button>
        <button className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3">
          <Settings className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          <span className="text-[10px] font-bold text-foreground">Settings</span>
        </button>
      </div>

      {/* Recent Card Transactions */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Card Transactions</p>
        <div className="space-y-2">
          {recentCardTx.map((tx, i) => (
            <div key={i} className="flex items-center justify-between rounded-2xl bg-card p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{tx.name}</p>
                <p className="text-[11px] text-muted-foreground">{tx.time}</p>
              </div>
              <p className={`text-sm font-bold ${tx.amount > 0 ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`}>
                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} XAF
              </p>
            </div>
          ))}
        </div>
      </div>

      <Button variant="outline" className="w-full rounded-2xl">
        <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Add New Card
      </Button>
    </div>
  );
};

export default CustomerCards;
