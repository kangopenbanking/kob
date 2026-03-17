import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowUpRight, History, Eye, EyeOff, TrendingUp, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessData } from '@/hooks/useBusinessData';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const BusinessWallet: React.FC = () => {
  const { merchantId } = useMerchantContext();
  const isMobile = useIsMobile();
  const { wallets, availableBalance, pendingBalance, settlements, isLoading, refetchWallets } = useBusinessData(merchantId);
  const [showBalance, setShowBalance] = useState(true);
  const [showLedger, setShowLedger] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ open: boolean; action: string; amount?: number }>({ open: false, action: '' });

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
    queryKey: ['wallet-ledger', merchantId],
    queryFn: async () => {
      if (!merchantId) return { data: [], total: 0 };
      const { data, error } = await supabase.functions.invoke('gateway-query', {
        body: { action: 'list-wallet-ledger', merchant_id: merchantId },
      });
      if (error) throw error;
      return data || { data: [], total: 0 };
    },
    enabled: !!merchantId && showLedger,
  });

  const formatXAF = (amount: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(amount);

  const handlePayout = (amount?: number) => {
    setPinDialog({ open: true, action: 'payout', amount });
  };

  const handlePinConfirmed = async (pin: string) => {
    if (pinDialog.action === 'payout') {
      try {
        const amount = pinDialog.amount || availableBalance;
        const { data: settlementAccounts, error: accountsError }: any = await supabase
          .from('gateway_settlement_accounts' as any)
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
          body: { merchant_id: merchantId, amount, currency: 'XAF', settlement_account_id: settlementAccounts[0].id, pin },
        });
        if (error) throw error;
        toast.success('Payout request submitted');
        refetchWallets();
      } catch (err: any) {
        toast.error(err.message || 'Failed to request payout');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 px-5 md:px-0 pt-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-5 md:px-0 pt-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Wallet</h1>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 hover:bg-muted transition-colors"
        >
          {showBalance ? <Eye className="h-4 w-4" strokeWidth={2} /> : <EyeOff className="h-4 w-4" strokeWidth={2} />}
        </button>
      </div>

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="rounded-3xl bg-foreground p-6 text-background">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/10">
              <Wallet className="h-5 w-5 text-background/80" strokeWidth={1.8} />
            </div>
            <p className="text-xs font-medium text-background/50 uppercase tracking-widest">Total Balance</p>
          </div>
          <p className="text-[2.25rem] md:text-[2.75rem] font-bold tracking-tight leading-none">
            {showBalance ? formatXAF(availableBalance + pendingBalance) : '••••••'}
          </p>
          <div className="mt-5 flex gap-6">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[10px] text-background/40 uppercase tracking-wider">Available</p>
                <p className="text-sm font-semibold text-emerald-300">{showBalance ? formatXAF(availableBalance) : '••••'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-3.5 w-3.5 text-amber-400" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[10px] text-background/40 uppercase tracking-wider">Pending</p>
                <p className="text-sm font-semibold text-amber-300">{showBalance ? formatXAF(pendingBalance) : '••••'}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => handlePayout()}
          disabled={availableBalance < 1000}
          className="h-14 rounded-2xl flex-col gap-1.5 bg-foreground text-background hover:bg-foreground/90"
        >
          <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
          <span className="text-xs font-semibold">Request Payout</span>
        </Button>
        <Sheet open={showLedger} onOpenChange={setShowLedger}>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-14 rounded-2xl flex-col gap-1.5 border-border/50">
              <History className="h-5 w-5" strokeWidth={2} />
              <span className="text-xs font-semibold">History</span>
            </Button>
          </SheetTrigger>
          <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn(
            isMobile ? 'h-[80vh] rounded-t-[2rem] border-t-0' : 'w-[420px]',
            'px-5',
          )}>
            <SheetHeader>
              {isMobile && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />}
              <SheetTitle className="text-left">Transaction History</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-2 overflow-auto max-h-[calc(80vh-100px)]">
              {ledgerLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : ledgerData?.data && ledgerData.data.length > 0 ? (
                ledgerData.data.map((entry: any) => (
                  <div key={entry.id} className="flex items-center gap-3.5 rounded-xl p-3 hover:bg-muted/40 transition-colors">
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
                      entry.direction === 'credit' ? 'bg-emerald-500/10' : 'bg-rose-500/10',
                    )}>
                      <ArrowUpRight className={cn(
                        'h-4 w-4',
                        entry.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600 rotate-180',
                      )} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold capitalize">{entry.type}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'text-[13px] font-bold',
                        entry.direction === 'credit' ? 'text-emerald-600' : 'text-rose-600',
                      )}>
                        {entry.direction === 'credit' ? '+' : '-'}{formatXAF(entry.amount)}
                      </p>
                      <p className="text-[10px] capitalize text-muted-foreground">{entry.status}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-muted-foreground">No transactions yet</p>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Recent Settlements */}
      {settlements && settlements.length > 0 && (
        <div>
          <h2 className="text-[15px] font-bold text-foreground mb-3">Recent Settlements</h2>
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30">
            {settlements.slice(0, 5).map((settlement: any) => (
              <div key={settlement.id} className="flex items-center justify-between p-3.5">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{settlement.settlement_ref}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(settlement.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold text-foreground">{formatXAF(settlement.amount)}</p>
                  <p className="text-[10px] capitalize text-muted-foreground">{settlement.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
