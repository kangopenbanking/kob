import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CreditCard, List } from "lucide-react";
import { VirtualCardDisplay } from "@/components/virtual-cards/VirtualCardDisplay";
import { CreateCardForm } from "@/components/virtual-cards/CreateCardForm";
import { TopUpForm } from "@/components/virtual-cards/TopUpForm";
import { CardTransactions } from "@/components/virtual-cards/CardTransactions";
import { toast } from "sonner";

const VirtualCards = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTopUpForm, setShowTopUpForm] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);

  const { data: cardsData, isLoading, refetch } = useQuery({
    queryKey: ['virtual-cards'],
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

  const cards = cardsData?.cards || [];

  const handleCreateCard = () => setShowCreateForm(true);
  const handleTopUp = (card: any) => { setSelectedCard(card); setShowTopUpForm(true); };
  const handleViewTransactions = (card: any) => setSelectedCard(card);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Virtual Cards</h1>
        <p className="text-muted-foreground mt-1">
          Create USD virtual cards for online purchases worldwide.
        </p>
      </div>

      {showCreateForm ? (
        <Card className="rounded-xl border-0 shadow-sm">
          <div className="h-1 w-full bg-primary" />
          <CardHeader>
            <CardTitle className="text-base font-semibold">Create New Virtual Card</CardTitle>
            <CardDescription className="text-xs">Create a new USD virtual card for online transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateCardForm
              onSuccess={() => { setShowCreateForm(false); refetch(); toast.success('Virtual card created!'); }}
              onCancel={() => setShowCreateForm(false)}
            />
          </CardContent>
        </Card>
      ) : showTopUpForm && selectedCard ? (
        <Card className="rounded-xl border-0 shadow-sm">
          <div className="h-1 w-full bg-green-500" />
          <CardHeader>
            <CardTitle className="text-base font-semibold">Top Up Card</CardTitle>
            <CardDescription className="text-xs">Add funds to {selectedCard.card_name}</CardDescription>
          </CardHeader>
          <CardContent>
            <TopUpForm
              card={selectedCard}
              onSuccess={() => { setShowTopUpForm(false); setSelectedCard(null); refetch(); toast.success('Card topped up!'); }}
              onCancel={() => { setShowTopUpForm(false); setSelectedCard(null); }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {cards.length === 0 ? (
            <Card className="rounded-xl border-0 shadow-sm">
              <CardContent className="empty-state py-20">
                <div className="empty-state-icon">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Virtual Cards Yet</h3>
                <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
                  Create your first USD virtual card to start making online purchases worldwide.
                </p>
                <Button className="rounded-full" size="lg" onClick={handleCreateCard}>
                  <Plus className="mr-2 h-5 w-5" />Create Your First Card
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-end">
                <Button className="rounded-full" onClick={handleCreateCard}>
                  <Plus className="mr-2 h-4 w-4" />Create New Card
                </Button>
              </div>

              <Tabs defaultValue="cards" className="space-y-6">
                <TabsList className="inline-flex h-10 items-center rounded-full bg-muted p-1 text-muted-foreground">
                  <TabsTrigger value="cards" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                    <CreditCard className="mr-2 h-4 w-4" />My Cards
                  </TabsTrigger>
                  <TabsTrigger value="transactions" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                    <List className="mr-2 h-4 w-4" />Transactions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="cards" className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {cards.map((card: any) => (
                      <VirtualCardDisplay
                        key={card.id}
                        card={card}
                        onTopUp={() => handleTopUp(card)}
                        onViewTransactions={() => handleViewTransactions(card)}
                        onRefresh={refetch}
                      />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="transactions">
                  {selectedCard ? (
                    <CardTransactions card={selectedCard} />
                  ) : (
                    <Card className="rounded-xl border-0 shadow-sm">
                      <CardContent className="empty-state">
                        <div className="empty-state-icon"><List className="h-6 w-6 text-muted-foreground" /></div>
                        <p className="text-sm text-muted-foreground">Select a card to view transactions</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default VirtualCards;
