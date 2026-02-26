import React, { useState } from 'react';
import { CreditCard, Plus, Snowflake, ArrowUpCircle, Eye, EyeOff, Copy, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const BankCards: React.FC = () => {
  const [cards] = useState([
    { id: '1', last4: '4829', brand: 'Visa', balance: 125000, currency: 'XAF', status: 'active', color: 'bg-foreground' },
  ]);
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="flex flex-col px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cards</h1>
          <p className="text-sm font-medium text-muted-foreground">Manage your virtual cards</p>
        </div>
        <Button size="sm" className="gap-1.5 rounded-xl bg-[hsl(var(--bank-violet))] text-white hover:bg-[hsl(var(--bank-violet))]/90">
          <Plus className="h-4 w-4" strokeWidth={2} />
          New Card
        </Button>
      </div>

      {cards.map((card, i) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="mb-5"
        >
          {/* Card Display */}
          <div className={`rounded-3xl ${card.color} p-6 text-background`}>
            <div className="flex items-center justify-between">
              <CreditCard className="h-7 w-7" strokeWidth={1.5} />
              <span className="text-sm font-bold opacity-80">{card.brand}</span>
            </div>
            <p className="mt-8 text-xl font-mono tracking-[0.2em]">
              {showDetails ? '4829 5612 3478 4829' : '•••• •••• •••• ' + card.last4}
            </p>
            <div className="mt-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium opacity-60">Balance</span>
                <p className="text-xl font-bold">
                  {card.currency} {card.balance.toLocaleString()}
                </p>
              </div>
              <button onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? (
                  <EyeOff className="h-5 w-5 opacity-70" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-5 w-5 opacity-70" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {/* Card Actions */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(var(--bank-mint))] p-4"
            >
              <ArrowUpCircle className="h-6 w-6 text-[hsl(var(--bank-mint-fg))]" strokeWidth={1.5} />
              <span className="text-xs font-bold text-[hsl(var(--bank-mint-fg))]">Top Up</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(var(--bank-sky))] p-4"
            >
              <Snowflake className="h-6 w-6 text-white" strokeWidth={1.5} />
              <span className="text-xs font-bold text-white">Freeze</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(var(--bank-amber))] p-4"
            >
              <Settings className="h-6 w-6 text-[hsl(var(--bank-amber-fg))]" strokeWidth={1.5} />
              <span className="text-xs font-bold text-[hsl(var(--bank-amber-fg))]">Manage</span>
            </motion.button>
          </div>
        </motion.div>
      ))}

      {cards.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-[hsl(var(--bank-violet))]/10">
            <CreditCard className="h-10 w-10 text-[hsl(var(--bank-violet))]" strokeWidth={1.5} />
          </div>
          <p className="text-lg font-bold text-foreground">No virtual cards yet</p>
          <p className="text-sm text-muted-foreground">Create your first virtual card</p>
        </div>
      )}
    </div>
  );
};

export default BankCards;
