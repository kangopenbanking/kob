import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CreditCard, Plus } from "lucide-react";
import { VirtualCardDisplay } from "@/components/virtual-cards/VirtualCardDisplay";
import { CreateCardForm } from "@/components/virtual-cards/CreateCardForm";
import { TopUpForm } from "@/components/virtual-cards/TopUpForm";
import { CardTransactions } from "@/components/virtual-cards/CardTransactions";

const VirtualCards = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [topUpCard, setTopUpCard] = useState<any | null>(null);
  const [txCard, setTxCard] = useState<any | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["virtual-cards"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const response = await supabase.functions.invoke("virtual-cards", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) throw response.error;
      return response.data;
    },
  });

  const cards = data?.cards || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Virtual Cards</h1>
          <p className="text-muted-foreground mt-1">
            USD virtual cards for online purchases worldwide.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="rounded-full">
          <Plus className="mr-2 h-4 w-4" />
          New Card
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="skeleton">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
              <CreditCard className="h-10 w-10 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              No virtual cards yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-8">
              Create your first USD virtual card to make online purchases worldwide,
              fund it from your local wallet with automatic FX conversion.
            </p>
            <Button className="rounded-full" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Card
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

      {/* Create Card */}
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

      {/* Top up */}
      <Dialog open={!!topUpCard} onOpenChange={(o) => !o && setTopUpCard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Top Up Card</DialogTitle>
            <DialogDescription>
              Convert from your local wallet to USD and fund the card.
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

      {/* Transactions */}
      <Dialog open={!!txCard} onOpenChange={(o) => !o && setTxCard(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Card Activity</DialogTitle>
            <DialogDescription>
              Recent purchases and top-ups for this card.
            </DialogDescription>
          </DialogHeader>
          {txCard && <CardTransactions card={txCard} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VirtualCards;
