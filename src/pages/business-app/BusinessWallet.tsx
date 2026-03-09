import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowUpRight, History, Eye, EyeOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessData } from '@/hooks/useBusinessData';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const BusinessWallet: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const { wallets, availableBalance, pendingBalance, settlements, isLoading, refetchWallets } = useBusinessData(merchantId);
  const [showBalance, setShowBalance] = useState(true);
  const [showLedger, setShowLedger] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ open: boolean; action: string; amount?: number }>({ 
    open: false, 
    action: '' 
  });

  // Fetch wallet ledger
  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['wallet-ledger', merchantId],
    queryFn: async () => {
      if (!merchantId) return { data: [], total: 0 };
      const { data, error } = await supabase.functions.invoke('gateway-list-wallet-ledger', {
        method: 'GET',
      });
      if (error) throw error;
      return data || { data: [], total: 0 };
    },
    enabled: !!merchantId && showLedger,
  });

  const formatXAF = (amount: number) => {
    return new Intl.NumberFormat('fr-CM', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handlePayout = (amount?: number) => {
    setPinDialog({ open: true, action: 'payout', amount });
  };

  const handlePinConfirmed = async (pin: string) => {
    if (pinDialog.action === 'payout') {
      try {
        const amount = pinDialog.amount || availableBalance;
        
        // Get first active settlement account (in production, show selection UI)
        const { data: settlementAccounts, error: accountsError } = await supabase
          .from('gateway_settlement_accounts')
          .select('*')
          .eq('merchant_id', merchantId!)
          .eq('is_active', true)
          .limit(1);

        if (accountsError) throw accountsError;

        if (!settlementAccounts || settlementAccounts.length === 0) {
          toast.error('No settlement account configured');
          return;
        }

        const { data, error } = await supabase.functions.invoke('gateway-request-payout', {
          body: {
            merchant_id: merchantId,
            amount,
            currency: 'XAF',
            settlement_account_id: settlementAccounts[0].id,
            pin,
          },
        });

        if (error) throw error;
        
        toast.success('Payout request submitted for approval');
        refetchWallets();
      } catch (err: any) {
        toast.error(err.message || 'Failed to request payout');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowBalance(!showBalance)}
          className="rounded-full"
        >
          {showBalance ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </Button>
      </header>

      <Card className="border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Balance</p>
                <p className="text-3xl font-bold tracking-tight">
                  {showBalance ? formatXAF(availableBalance + pendingBalance) : '••••••'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Available</p>
              <p className="text-lg font-bold text-emerald-600">
                {showBalance ? formatXAF(availableBalance) : '••••••'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              <p className="text-lg font-bold text-amber-600">
                {showBalance ? formatXAF(pendingBalance) : '••••••'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={() => handlePayout()}
          disabled={availableBalance < 1000}
          className="h-auto py-4 flex-col gap-2 rounded-2xl"
        >
          <ArrowUpRight className="h-5 w-5" />
          <span className="text-sm font-medium">Request Payout</span>
        </Button>
        <Sheet open={showLedger} onOpenChange={setShowLedger}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2 rounded-2xl"
            >
              <History className="h-5 w-5" />
              <span className="text-sm font-medium">Transaction History</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>Transaction Ledger</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2 overflow-auto max-h-[calc(80vh-100px)]">
              {ledgerLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : ledgerData?.data && ledgerData.data.length > 0 ? (
                ledgerData.data.map((entry: any) => (
                  <Card key={entry.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium capitalize">{entry.type}</p>
                        <p className="text-xs text-muted-foreground">{entry.reference}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${entry.direction === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {entry.direction === 'credit' ? '+' : '-'}{formatXAF(entry.amount)}
                        </p>
                        <p className="text-xs capitalize text-muted-foreground">{entry.status}</p>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No transactions yet</p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {settlements && settlements.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Settlements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settlements.slice(0, 5).map((settlement: any) => (
              <div key={settlement.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{settlement.settlement_ref}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(settlement.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatXAF(settlement.amount)}</p>
                  <p className="text-xs capitalize text-muted-foreground">{settlement.status}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <PinConfirmDialog
        open={pinDialog.open}
        onOpenChange={(open) => setPinDialog({ ...pinDialog, open })}
        onConfirmed={handlePinConfirmed}
        title="Confirm Payout Request"
        description={`Enter your PIN to request payout of ${formatXAF(pinDialog.amount || availableBalance)}`}
      />
    </div>
  );
};

export default BusinessWallet;
