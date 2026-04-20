import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wallet, ArrowUpRight, History, Eye, EyeOff, TrendingUp, Clock, Building2, Smartphone, Globe, CreditCard, Check, Plus, Trash2, Star, AlertCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessData } from '@/hooks/useBusinessData';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { PinConfirmDialog } from '@/components/pwa/PinConfirmDialog';
import { AutoCashOutRules } from '@/components/pwa/AutoCashOutRules';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PageGuide } from '@/components/business-app/PageGuide';

const BusinessWallet: React.FC = () => {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();
  const isMobile = useIsMobile();
  const { wallets, availableBalance, pendingBalance, settlements, isLoading, refetchWallets } = useBusinessData(merchantId);
  const queryClient = useQueryClient();
  const [showBalance, setShowBalance] = useState(true);
  const [showLedger, setShowLedger] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ open: boolean; amount: number; accountId: string }>({ open: false, amount: 0, accountId: '' });

  // Fetch settlement accounts (linked accounts) - max 2
  const { data: linkedAccounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = useQuery({
    queryKey: ['biz-linked-accounts', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from('gateway_merchant_settlement_accounts')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).slice(0, 2);
    },
    enabled: !!merchantId,
  });

  // Check if merchant owner has a consumer wallet
  const { data: consumerAccount } = useQuery({
    queryKey: ['biz-consumer-account'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('accounts')
        .select('id, account_holder_name, account_id, currency')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

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

  const numAmount = Number(withdrawAmount) || 0;

  const openWithdrawSheet = () => {
    setWithdrawAmount('');
    setSelectedAccountId(linkedAccounts.find((a: any) => a.is_default)?.id || linkedAccounts[0]?.id || null);
    setShowWithdraw(true);
  };

  const handleWithdrawSubmit = () => {
    if (numAmount < 1000) { toast.error('Minimum withdrawal amount is 1,000 XAF'); return; }
    if (numAmount > availableBalance) { toast.error(`Insufficient balance. You have ${formatXAF(availableBalance)} available`); return; }
    if (!selectedAccountId) { toast.error('Please select a withdrawal destination account'); return; }
    setPinDialog({ open: true, amount: numAmount, accountId: selectedAccountId });
  };

  const handlePinConfirmed = async (pin: string) => {
    setWithdrawLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gateway-request-payout', {
        body: {
          merchant_id: merchantId,
          amount: pinDialog.amount,
          currency: 'XAF',
          settlement_account_id: pinDialog.accountId,
          pin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const isInstant = data?.transfer_type === 'instant';
      toast.success(isInstant 
        ? `${formatXAF(pinDialog.amount)} transferred to your Kang wallet instantly! ⚡` 
        : `Withdrawal of ${formatXAF(pinDialog.amount)} submitted. You'll receive the funds within 1–3 business days.`);
      setShowWithdraw(false);
      refetchWallets();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Withdrawal could not be processed. Please try again.'));
    } finally {
      setWithdrawLoading(false);
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'mobile_money': return Smartphone;
      case 'paypal': return Globe;
      case 'card': return CreditCard;
      case 'kob_wallet': return Wallet;
      default: return Building2;
    }
  };

  const getAccountLabel = (type: string) => {
    switch (type) {
      case 'bank_transfer': return 'Bank Transfer';
      case 'mobile_money': return 'Mobile Money';
      case 'paypal': return 'PayPal';
      case 'card': return 'Card';
      case 'kob_wallet': return 'Kang Wallet';
      case 'rtgs': return 'RTGS / Wire';
      default: return type;
    }
  };

  const getAccountSummary = (a: any) => {
    const meta = (a.metadata as any) || {};
    switch (a.account_type) {
      case 'mobile_money': return a.phone_number || '';
      case 'paypal': return meta.paypal_email || '';
      case 'card': return `•••• ${meta.card_last4 || ''}`;
      case 'kob_wallet': return a.account_name || 'Consumer Wallet';
      default: return a.account_number ? `****${a.account_number.slice(-4)}` : '';
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
      <PageGuide
        title="Wallet"
        summary="See your available and pending balance, withdraw funds, and link the bank or mobile money accounts that receive your payouts."
        steps={[
          { title: 'Check your balances', description: 'Available is ready to withdraw; Pending will clear after the standard settlement window.' },
          { title: 'Link a payout account', description: 'Add up to two accounts (bank or mobile money) before requesting a withdrawal.' },
          { title: 'Withdraw securely', description: 'Enter an amount, choose an account, and confirm with your PIN to send funds.' },
        ]}
        learnMoreHref="/developer/payouts"
      />
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
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
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
      <div className="grid grid-cols-3 gap-3">
        <Button
          onClick={() => navigate('/biz/fund-wallet')}
          className="h-14 rounded-2xl flex-col gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" strokeWidth={2} />
          <span className="text-xs font-semibold">Fund</span>
        </Button>
        <Button
          onClick={openWithdrawSheet}
          disabled={availableBalance < 1000}
          className="h-14 rounded-2xl flex-col gap-1.5 bg-foreground text-background hover:bg-foreground/90"
        >
          <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
          <span className="text-xs font-semibold">Withdraw</span>
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

      {/* Linked Accounts Preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-foreground">Linked Accounts</h2>
          <span className="text-[11px] text-muted-foreground font-medium">{linkedAccounts.length}/2 max</span>
        </div>
        {accountsLoading ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : linkedAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">No withdrawal accounts linked</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Go to Settings → Settlement Accounts to add one</p>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedAccounts.map((a: any) => {
              const Icon = getAccountIcon(a.account_type);
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3.5">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{a.account_name || a.bank_name || 'Account'}</p>
                    <p className="text-[11px] text-muted-foreground">{getAccountLabel(a.account_type)} · {getAccountSummary(a)}</p>
                  </div>
                  {a.is_default && <Badge variant="secondary" className="text-[10px] shrink-0">Default</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-Withdraw Rules */}
      {merchantId && linkedAccounts.length > 0 && (
        <AutoCashOutRules
          userId={merchantId}
          linkedAccounts={linkedAccounts}
          ownerType="merchant"
          ownerId={merchantId}
        />
      )}

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

      {/* ============ Withdraw Sheet ============ */}
      <Sheet open={showWithdraw} onOpenChange={setShowWithdraw}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn(
          isMobile ? 'h-[90vh] rounded-t-[2rem] border-t-0' : 'w-[420px]',
          'px-5 flex flex-col',
        )}>
          <SheetHeader>
            {isMobile && <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />}
            <SheetTitle className="text-left">Withdraw Funds</SheetTitle>
            <p className="text-xs text-muted-foreground text-left">
              Available: <span className="font-semibold text-foreground">{formatXAF(availableBalance)}</span>
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-auto mt-5 space-y-5">
            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Amount (XAF)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">XAF</span>
                <Input
                  type="number"
                  placeholder="0"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  min={1000}
                  className="pl-14 text-lg font-semibold h-12"
                />
              </div>
              <div className="flex gap-2">
                {[10000, 25000, 50000].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setWithdrawAmount(String(p))}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                      numAmount === p
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                    )}
                  >
                    {formatXAF(p)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setWithdrawAmount(String(availableBalance))}
                  className="rounded-full px-3 py-1 text-xs font-medium border border-border bg-card text-muted-foreground hover:border-primary/40"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Account Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Withdraw To</Label>

              {/* KOB Consumer Wallet auto-detected */}
              {consumerAccount && !linkedAccounts.some((a: any) => a.account_type === 'kob_wallet') && (
                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Your Kang consumer wallet was detected</p>
                  <p className="text-[11px] text-muted-foreground/70">Add it as a settlement account in Settings to enable instant transfers</p>
                </div>
              )}

              {linkedAccounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
                  <AlertCircle className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No withdrawal accounts</p>
                  <p className="text-xs text-muted-foreground/60">Add accounts in Settings → Settlement Accounts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedAccounts.map((a: any) => {
                    const Icon = getAccountIcon(a.account_type);
                    const selected = selectedAccountId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAccountId(a.id)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
                          selected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-border/40 hover:border-primary/30 hover:bg-muted/30',
                        )}
                      >
                        <div className={cn(
                          'h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                          selected ? 'bg-primary text-primary-foreground' : 'bg-muted',
                        )}>
                          <Icon className="h-4 w-4" strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold truncate">{a.account_name || a.bank_name || 'Account'}</p>
                          <p className="text-[11px] text-muted-foreground">{getAccountLabel(a.account_type)} · {getAccountSummary(a)}</p>
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />}
                        {a.account_type === 'kob_wallet' && (
                          <Badge variant="secondary" className="text-[9px] shrink-0">Instant</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary */}
            {numAmount > 0 && selectedAccountId && (
              <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">{formatXAF(numAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Destination</span>
                  <span className="font-medium">{getAccountLabel(linkedAccounts.find((a: any) => a.id === selectedAccountId)?.account_type || '')}</span>
                </div>
                {linkedAccounts.find((a: any) => a.id === selectedAccountId)?.account_type === 'kob_wallet' && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Speed</span>
                    <span className="font-medium text-emerald-600">⚡ Instant</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-4 pb-2 shrink-0">
            <Button
              onClick={handleWithdrawSubmit}
              disabled={numAmount < 1000 || numAmount > availableBalance || !selectedAccountId || withdrawLoading}
              className="w-full h-12 rounded-xl gap-2 text-sm font-semibold"
              size="lg"
            >
              {withdrawLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <>Withdraw {numAmount > 0 ? formatXAF(numAmount) : ''}</>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <PinConfirmDialog
        open={pinDialog.open}
        onOpenChange={(open) => setPinDialog({ ...pinDialog, open })}
        onConfirmed={handlePinConfirmed}
        title="Confirm Withdrawal"
        description={`Enter your PIN to withdraw ${formatXAF(pinDialog.amount)}`}
      />
    </div>
  );
};

export default BusinessWallet;
