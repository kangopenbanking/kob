import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowUpRight, History, Eye, EyeOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessData } from '@/hooks/useBusinessData';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { toast } from 'sonner';

const BusinessWallet: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const { wallets, availableBalance, pendingBalance, settlements, isLoading } = useBusinessData(merchantId);
  const [showBalance, setShowBalance] = useState(true);
  const [pinDialog, setPinDialog] = useState<{ open: boolean; action: string }>({ 
    open: false, 
    action: '' 
  });

  const formatXAF = (amount: number) => {
    return new Intl.NumberFormat('fr-CM', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handlePayout = () => {
    setPinDialog({ open: true, action: 'payout' });
  };

  const handlePinConfirmed = () => {
    if (pinDialog.action === 'payout') {
      // TODO: Implement payout logic
      toast.success('Payout request submitted');
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
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {showBalance ? formatXAF(availableBalance) : '••••••'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {showBalance ? formatXAF(pendingBalance) : '••••••'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={handlePayout}
          disabled={availableBalance < 1000}
          className="h-auto py-4 flex-col gap-2 rounded-2xl"
        >
          <ArrowUpRight className="h-5 w-5" />
          <span className="text-sm font-medium">Request Payout</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex-col gap-2 rounded-2xl"
        >
          <History className="h-5 w-5" />
          <span className="text-sm font-medium">History</span>
        </Button>
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
        title="Confirm Payout"
        description="Enter your PIN to request a payout"
      />
    </div>
  );
};

export default BusinessWallet;
