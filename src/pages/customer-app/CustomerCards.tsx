import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Plus, Lock, Snowflake, Eye, EyeOff, Settings, Loader2, Search, Store, ScanLine } from 'lucide-react';
import { useMerchantDirectory, searchMerchants } from '@/hooks/useMerchantDirectory';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerCards, useCardTransactions } from '@/hooks/useCustomerData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

const cardColors = ['bg-[hsl(225,50%,22%)]', 'bg-[hsl(150,35%,30%)]', 'bg-[hsl(25,60%,35%)]'];

const CustomerCards: React.FC = () => {
  const tr = useHarvestedT('customer');
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState(0);
  const [showNumber, setShowNumber] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pendingAction, setPendingAction] = useState<'freeze' | 'unfreeze' | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { data: cards = [], isLoading } = useCustomerCards(user?.id);
  const { data: cardTxns = [] } = useCardTransactions(user?.id, 5);

  const card = cards[activeCard] as any;

  const handleFreezeUnfreeze = () => {
    if (!card) return;
    setPendingAction(card.status === 'frozen' ? 'unfreeze' : 'freeze');
    setShowPin(true);
  };

  const handlePinConfirmed = async () => {
    if (!card || !pendingAction) return;
    setIsUpdatingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const newStatus = pendingAction === 'freeze' ? 'inactive' : 'active';
      const idempotencyKey = `card_status_${card.id}_${newStatus}_${Date.now()}`;

      const response = await supabase.functions.invoke('virtual-cards', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { card_id: card.id, status: newStatus, idempotency_key: idempotencyKey },
      });

      if (response.error) throw response.error;

      toast.success(pendingAction === 'freeze' ? 'Card frozen successfully' : 'Card activated successfully');
      await queryClient.refetchQueries({ queryKey: ['customer-cards'] });
    } catch (error: any) {
      toast.error(extractEdgeFunctionError(error, 'Failed to update card status'));
    } finally {
      setIsUpdatingStatus(false);
      setPendingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <h1 className="text-xl font-bold text-foreground">{tr('Cards')}</h1>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <CreditCard className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">{tr('No cards yet')}</p>
          <p className="text-xs text-muted-foreground text-center">{tr('Add a virtual card to start making payments')}</p>
          <Button variant="outline" className="rounded-2xl" onClick={() => navigate('/virtual-cards')}>
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Add New Card
          </Button>
        </div>
      ) : (
        <>
          {/* Card Carousel */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {card && (
                <motion.div key={activeCard} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  className={`rounded-2xl ${cardColors[activeCard % cardColors.length]} p-6 relative overflow-hidden`}
                  style={{ aspectRatio: '1.586', maxHeight: '220px' }}>
                  <div className="absolute right-6 top-6 h-20 w-20 rounded-full border border-[hsl(0,0%,100%)]/10" />
                  <div className="absolute right-10 top-10 h-14 w-14 rounded-full border border-[hsl(0,0%,100%)]/10" />

                  <div className="relative flex items-center justify-between">
                    <CreditCard className="h-8 w-8 text-[hsl(0,0%,100%)]" strokeWidth={1.5} />
                    <div className="flex items-center gap-2">
                      {card.status === 'frozen' && <Snowflake className="h-4 w-4 text-[hsl(210,80%,75%)]" strokeWidth={1.5} />}
                      <Lock className="h-4 w-4 text-[hsl(0,0%,100%)]/60" strokeWidth={1.5} />
                    </div>
                  </div>
                  <p className="relative mt-6 text-lg font-mono tracking-widest text-[hsl(0,0%,100%)]">
                    {showNumber ? `**** **** ****` : '**** **** ****'} {card.last4}
                  </p>
                  <div className="relative mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase text-[hsl(0,0%,100%)]/50">{tr('Card Name')}</p>
                      <p className="text-sm font-semibold text-[hsl(0,0%,100%)]">{card.card_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-[hsl(0,0%,100%)]/50">{tr('Expires')}</p>
                      <p className="text-sm font-semibold text-[hsl(0,0%,100%)]">{String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-3 flex justify-center gap-1.5">
              {cards.map((_: any, i: number) => (
                <button key={i} onClick={() => setActiveCard(i)}
                  className={`h-2 rounded-full transition-all ${i === activeCard ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'}`} />
              ))}
            </div>
          </div>

          {/* Card Controls */}
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => setShowNumber(!showNumber)} className="flex flex-col items-center gap-2.5 rounded-2xl bg-[hsl(210,80%,93%)] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(210,70%,85%)]">
                {showNumber ? <EyeOff className="h-5 w-5 text-[hsl(210,60%,40%)]" strokeWidth={1.5} /> : <Eye className="h-5 w-5 text-[hsl(210,60%,40%)]" strokeWidth={1.5} />}
              </div>
              <span className="text-[10px] font-bold text-foreground">{showNumber ? 'Hide' : 'Show'}</span>
            </button>
            <button
              onClick={handleFreezeUnfreeze}
              disabled={isUpdatingStatus || card?.status === 'cancelled'}
              className="flex flex-col items-center gap-2.5 rounded-2xl bg-[hsl(200,70%,92%)] p-4 disabled:opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(200,60%,82%)]">
                {isUpdatingStatus
                  ? <Loader2 className="h-5 w-5 animate-spin text-[hsl(200,50%,38%)]" strokeWidth={1.5} />
                  : <Snowflake className="h-5 w-5 text-[hsl(200,50%,38%)]" strokeWidth={1.5} />}
              </div>
              <span className="text-[10px] font-bold text-foreground">{card?.status === 'frozen' ? 'Unfreeze' : 'Freeze'}</span>
            </button>
            <button onClick={() => navigate('/virtual-cards')} className="flex flex-col items-center gap-2.5 rounded-2xl bg-[hsl(255,50%,93%)] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(255,40%,84%)]">
                <Settings className="h-5 w-5 text-[hsl(255,40%,42%)]" strokeWidth={1.5} />
              </div>
              <span className="text-[10px] font-bold text-foreground">{tr('Settings')}</span>
            </button>
          </div>

          {/* Card Transactions */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Card Transactions')}</p>
            {cardTxns.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">{tr('No card transactions yet')}</p>
            ) : (
              <div className="space-y-2">
                {cardTxns.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between rounded-2xl bg-card p-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{tx.description || tx.transaction_type}</p>
                      <p className="text-[11px] text-muted-foreground">{tx.card_last4 ? `•••• ${tx.card_last4}` : ''}</p>
                    </div>
                    <p className={`text-sm font-bold ${tx.amount > 0 ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`}>
                      {tx.amount > 0 ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()} {tx.currency}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" className="w-full rounded-2xl" onClick={() => navigate('/virtual-cards')}>
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Add New Card
          </Button>
        </>
      )}

      <PinConfirmDialog open={showPin} onOpenChange={setShowPin} onConfirmed={handlePinConfirmed} />
    </div>
  );
};

export default CustomerCards;
