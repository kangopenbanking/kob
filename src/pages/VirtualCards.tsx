import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CreditCard, ArrowUpCircle, List } from "lucide-react";
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

      const response = await supabase.functions.invoke('virtual-card-list', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
  });

  const cards = cardsData?.cards || [];

  const handleCreateCard = () => {
    setShowCreateForm(true);
  };

  const handleTopUp = (card: any) => {
    setSelectedCard(card);
    setShowTopUpForm(true);
  };

  const handleViewTransactions = (card: any) => {
    setSelectedCard(card);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading virtual cards...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Virtual Cards</h1>
        <p className="text-muted-foreground">
          Create USD virtual cards for online purchases worldwide. Top up with your local currency.
        </p>
      </div>

      {showCreateForm ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Virtual Card</CardTitle>
            <CardDescription>
              Create a new USD virtual card for online transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateCardForm
              onSuccess={() => {
                setShowCreateForm(false);
                refetch();
                toast.success('Virtual card created successfully!');
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </CardContent>
        </Card>
      ) : showTopUpForm && selectedCard ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Top Up Card</CardTitle>
            <CardDescription>
              Add funds to {selectedCard.card_name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopUpForm
              card={selectedCard}
              onSuccess={() => {
                setShowTopUpForm(false);
                setSelectedCard(null);
                refetch();
                toast.success('Card topped up successfully!');
              }}
              onCancel={() => {
                setShowTopUpForm(false);
                setSelectedCard(null);
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {cards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <CreditCard className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Virtual Cards Yet</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-md">
                  Create your first USD virtual card to start making online purchases worldwide.
                </p>
                <Button onClick={handleCreateCard} size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Your First Card
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-end mb-6">
                <Button onClick={handleCreateCard}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Card
                </Button>
              </div>

              <Tabs defaultValue="cards" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="cards">
                    <CreditCard className="mr-2 h-4 w-4" />
                    My Cards
                  </TabsTrigger>
                  <TabsTrigger value="transactions">
                    <List className="mr-2 h-4 w-4" />
                    Transactions
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
                    <Card>
                      <CardContent className="py-16 text-center">
                        <p className="text-muted-foreground">
                          Select a card from the "My Cards" tab to view transactions
                        </p>
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
