import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, ShoppingBag, ArrowUpCircle } from "lucide-react";

interface CardTransactionsProps {
  card: any;
}

export const CardTransactions = ({ card }: CardTransactionsProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['card-transactions', card.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke(
        `virtual-cards?card_id=${card.id}&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.error) throw response.error;
      return response.data;
    },
  });

  const transactions = data?.transactions || [];

  // Also fetch funding transactions
  const { data: fundingData } = useQuery({
    queryKey: ['card-funding', card.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_funding_transactions')
        .select('*')
        .eq('virtual_card_id', card.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const fundingTransactions = fundingData || [];

  // Combine and sort all transactions
  const allTransactions = [
    ...transactions.map((tx: any) => ({ ...tx, type: 'purchase' })),
    ...fundingTransactions.map((tx: any) => ({ ...tx, type: 'topup' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (allTransactions.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-16">
          <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Transactions Yet</h3>
          <p className="text-muted-foreground">
            Transactions will appear here once you start using your card
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History - {card.card_name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allTransactions.map((tx: any) => (
            <div
              key={tx.id}
              className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  {tx.type === 'topup' ? (
                    <ArrowUpCircle className="h-5 w-5 text-primary" />
                  ) : (
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-medium">
                    {tx.type === 'topup' 
                      ? 'Card Top-Up'
                      : tx.merchant_name || 'Purchase'
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(tx.created_at), 'MMM dd, yyyy • HH:mm')}
                  </p>
                  {tx.type === 'topup' && tx.source_currency && (
                    <p className="text-xs text-muted-foreground">
                      From {tx.source_currency} {parseFloat(tx.amount_source_currency).toFixed(2)}
                      {' at rate '} {parseFloat(tx.exchange_rate).toFixed(6)}
                    </p>
                  )}
                  {tx.type === 'purchase' && tx.merchant_country && (
                    <p className="text-xs text-muted-foreground">
                      {tx.merchant_country}
                      {tx.merchant_category && ` • ${tx.merchant_category}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className={`font-semibold ${tx.type === 'topup' ? 'text-green-600' : 'text-foreground'}`}>
                  {tx.type === 'topup' ? '+' : '-'}$
                  {parseFloat(tx.amount_usd || tx.amount).toFixed(2)}
                </p>
                {tx.status && (
                  <Badge
                    variant={
                      tx.status === 'completed' || tx.status === 'approved'
                        ? 'default'
                        : tx.status === 'pending' || tx.status === 'processing'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {tx.status}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
