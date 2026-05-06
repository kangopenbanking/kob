import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, Plus, Loader2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VirtualCardDisplay } from '@/components/virtual-cards/VirtualCardDisplay';
import { CreateCardForm } from '@/components/virtual-cards/CreateCardForm';
import { TopUpForm } from '@/components/virtual-cards/TopUpForm';
import { CardTransactions } from '@/components/virtual-cards/CardTransactions';
import { QRPayScanner } from '@/components/virtual-cards/QRPayScanner';

const BankCards: React.FC = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [topUpCard, setTopUpCard] = useState<any | null>(null);
  const [txCard, setTxCard] = useState<any | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bank-virtual-cards'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const response = await supabase.functions.invoke('virtual-cards', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) throw response.error;
      return response.data;
    },
  });

  const cards = data?.cards || [];

  return (
    <div className="flex flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Virtual Cards</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            USD cards for online purchases
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="mr-1 h-4 w-4" strokeWidth={1.5} />
          New
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
            <CreditCard className="h-8 w-8 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            No virtual cards yet
          </h2>
          <p className="text-xs text-muted-foreground max-w-xs mb-5">
            Create a USD virtual card to make online purchases worldwide.
          </p>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Create Card
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {cards.map((card: any) => (
            <VirtualCardDisplay
              key={card.id}
              card={card}
              onTopUp={() => setTopUpCard(card)}
              onViewTransactions={() => setTxCard(card)}
              onRefresh={refetch}
            />
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Virtual Card</DialogTitle>
            <DialogDescription>
              Issue a new USD virtual card to your account.
            </DialogDescription>
          </DialogHeader>
          <CreateCardForm
            onSuccess={() => {
              setShowCreate(false);
              refetch();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!topUpCard} onOpenChange={(o) => !o && setTopUpCard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Top Up Card</DialogTitle>
            <DialogDescription>
              Convert from your local wallet to USD.
            </DialogDescription>
          </DialogHeader>
          {topUpCard && (
            <TopUpForm
              card={topUpCard}
              onSuccess={() => {
                setTopUpCard(null);
                refetch();
              }}
              onCancel={() => setTopUpCard(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!txCard} onOpenChange={(o) => !o && setTxCard(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Card Activity</DialogTitle>
            <DialogDescription>
              Recent purchases and top-ups.
            </DialogDescription>
          </DialogHeader>
          {txCard && <CardTransactions card={txCard} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankCards;
