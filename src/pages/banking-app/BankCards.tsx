import React, { useState } from 'react';
import { CreditCard, Plus, Snowflake, ArrowUpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const BankCards: React.FC = () => {
  const [cards] = useState([
    { id: '1', last4: '4829', brand: 'Visa', balance: 125000, currency: 'XAF', status: 'active' },
  ]);

  return (
    <div className="flex flex-col px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Cards</h1>
          <p className="text-sm text-muted-foreground">Manage your virtual cards</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          New Card
        </Button>
      </div>

      {cards.map((card, i) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="mb-4"
        >
          {/* Card Display */}
          <div className="rounded-2xl bg-foreground p-5 text-background">
            <div className="flex items-center justify-between">
              <CreditCard className="h-6 w-6" strokeWidth={1.5} />
              <span className="text-xs font-medium opacity-70">{card.brand}</span>
            </div>
            <p className="mt-6 text-lg font-mono tracking-widest">
              •••• •••• •••• {card.last4}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm opacity-70">Balance</span>
              <span className="text-sm font-semibold">
                {card.currency} {card.balance.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Card Actions */}
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5">
              <ArrowUpCircle className="h-4 w-4" strokeWidth={1.5} />
              Top Up
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5">
              <Snowflake className="h-4 w-4" strokeWidth={1.5} />
              Freeze
            </Button>
          </div>
        </motion.div>
      ))}

      {cards.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <CreditCard className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-foreground">No virtual cards yet</p>
          <p className="text-xs text-muted-foreground">Create your first virtual card</p>
        </div>
      )}
    </div>
  );
};

export default BankCards;
