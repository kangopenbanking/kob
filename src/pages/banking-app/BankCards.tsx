import React, { useState } from 'react';
import { CreditCard, Plus, Snowflake, ArrowUpCircle, Eye, EyeOff, Settings, Loader2, PlayCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useVirtualCards, useCreateVirtualCard, useTopUpCard, useUpdateCardStatus } from '@/hooks/useBankingData';

const BankCards: React.FC = () => {
  const { data: cards, isLoading } = useVirtualCards();
  const createCard = useCreateVirtualCard();
  const topUp = useTopUpCard();
  const updateStatus = useUpdateCardStatus();
  const [showDetails, setShowDetails] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpCardId, setTopUpCardId] = useState<string | null>(null);

  const handleTopUp = () => {
    if (!topUpCardId || !topUpAmount) return;
    topUp.mutate({ card_id: topUpCardId, amount: Number(topUpAmount) }, {
      onSuccess: () => { setTopUpCardId(null); setTopUpAmount(''); },
    });
  };

  return (
    <div className="flex flex-col px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cards</h1>
          <p className="text-sm font-medium text-muted-foreground">Manage your virtual cards</p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 rounded-xl bg-[hsl(var(--bank-violet))] text-white hover:bg-[hsl(var(--bank-violet))]/90"
          disabled={createCard.isPending}
          onClick={() => createCard.mutate({ card_type: 'virtual', currency: 'USD' })}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          {createCard.isPending ? 'Creating...' : 'New Card'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (cards || []).length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-[hsl(var(--bank-violet))]/10">
            <CreditCard className="h-10 w-10 text-[hsl(var(--bank-violet))]" strokeWidth={1.5} />
          </div>
          <p className="text-lg font-bold text-foreground">No virtual cards yet</p>
          <p className="text-sm text-muted-foreground">Create your first virtual card</p>
        </div>
      ) : (
        (cards || []).map((card: any, i: number) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="mb-5"
          >
            {/* Card Display */}
            <div className="rounded-3xl bg-foreground p-6 text-background">
              <div className="flex items-center justify-between">
                <CreditCard className="h-7 w-7" strokeWidth={1.5} />
                <div className="flex items-center gap-2">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                    card.status === 'active' ? 'bg-[hsl(var(--bank-mint))]/20 text-[hsl(var(--bank-mint))]'
                    : card.status === 'inactive' ? 'bg-[hsl(var(--bank-amber))]/20 text-[hsl(var(--bank-amber))]'
                    : 'bg-[hsl(var(--bank-coral))]/20 text-[hsl(var(--bank-coral))]'
                  }`}>{card.status}</span>
                  <span className="text-sm font-bold opacity-80">{card.card_brand || 'Visa'}</span>
                </div>
              </div>
              <p className="mt-8 text-xl font-mono tracking-[0.2em]">
                {showDetails ? (card.card_number || '•••• •••• •••• ••••') : `•••• •••• •••• ${card.last4 || '••••'}`}
              </p>
              <div className="mt-5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium opacity-60">Balance</span>
                  <p className="text-xl font-bold">
                    {card.currency || 'USD'} {(card.balance_usd || card.spending_limit || 0).toLocaleString()}
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
              <Dialog open={topUpCardId === card.id} onOpenChange={(o) => !o && setTopUpCardId(null)}>
                <DialogTrigger asChild>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTopUpCardId(card.id)}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(var(--bank-mint))] p-4"
                  >
                    <ArrowUpCircle className="h-6 w-6 text-[hsl(var(--bank-mint-fg))]" strokeWidth={1.5} />
                    <span className="text-xs font-bold text-[hsl(var(--bank-mint-fg))]">Top Up</span>
                  </motion.button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Top Up Card</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 pt-2">
                    <Input
                      type="number"
                      placeholder="Amount (USD)"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="text-center text-xl font-bold h-14"
                    />
                    <Button onClick={handleTopUp} disabled={topUp.isPending || !topUpAmount}>
                      {topUp.isPending ? 'Processing...' : 'Top Up'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => updateStatus.mutate({
                  card_id: card.id,
                  status: card.status === 'active' ? 'inactive' : 'active',
                })}
                disabled={updateStatus.isPending}
                className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(var(--bank-sky))] p-4"
              >
                {card.status === 'active' ? (
                  <Snowflake className="h-6 w-6 text-white" strokeWidth={1.5} />
                ) : (
                  <PlayCircle className="h-6 w-6 text-white" strokeWidth={1.5} />
                )}
                <span className="text-xs font-bold text-white">
                  {card.status === 'active' ? 'Freeze' : 'Unfreeze'}
                </span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(var(--bank-amber))] p-4"
              >
                <Settings className="h-6 w-6 text-[hsl(var(--bank-amber-fg))]" strokeWidth={1.5} />
                <span className="text-xs font-bold text-[hsl(var(--bank-amber-fg))]">Manage</span>
              </motion.button>
            </div>

            {/* Recent Transactions */}
            {card.recent_transactions?.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Recent</p>
                {card.recent_transactions.slice(0, 3).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-foreground">{tx.merchant_name || 'Transaction'}</span>
                    <span className="text-sm font-bold text-foreground">
                      ${Math.abs(tx.amount_usd || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))
      )}
    </div>
  );
};

export default BankCards;
