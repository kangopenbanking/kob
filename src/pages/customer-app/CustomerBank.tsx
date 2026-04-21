import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, ChevronDown, ChevronUp, Plus, Trash2, X, Loader2, RefreshCw, Link2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerAccounts, useAccountBalances, useCustomerTransactions } from '@/hooks/useCustomerData';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

const bankColors: Record<string, string> = {
  'Afriland First Bank': 'hsl(210,80%,90%)',
  'Ecobank': 'hsl(150,50%,88%)',
  'BICEC': 'hsl(0,60%,90%)',
  'UBA': 'hsl(0,70%,90%)',
  'SCB Cameroun': 'hsl(45,70%,88%)',
  default: 'hsl(270,50%,90%)',
};

const CustomerBank: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const { user } = useCustomerAuth();

  const { data: accounts = [], isLoading, refetch } = useCustomerAccounts(user?.id);
  const accountIds = accounts.map((a: any) => a.id);
  const { data: balances = [] } = useAccountBalances(accountIds);
  const { data: recentTxns = [] } = useCustomerTransactions(user?.id, undefined, 20);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const getBalance = (accountId: string) => {
    const b = balances.find((b: any) => b.account_id === accountId);
    return b ? b.amount : 0;
  };

  const getCurrency = (accountId: string) => {
    const b = balances.find((b: any) => b.account_id === accountId);
    return b?.currency || 'XAF';
  };

  const getAccountTxns = (accountId: string) =>
    recentTxns.filter((tx: any) => tx.account_id === accountId).slice(0, 5);

  const getBankColor = (name: string) => {
    const key = Object.keys(bankColors).find(k => name?.toLowerCase().includes(k.toLowerCase()));
    return key ? bankColors[key] : bankColors.default;
  };

  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      queryClient.refetchQueries({ queryKey: ['account-balances'] }),
    ]);
    setRefreshing(false);
    toast.success('Accounts refreshed');
  };

  const totalBalance = accounts.reduce((sum: number, acc: any) => sum + getBalance(acc.id), 0);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">{tr('Linked Accounts')}</h1>
        </div>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">{tr('Linked Accounts')}</h1>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
          <RefreshCw className={`h-4 w-4 text-foreground ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Total Balance */}
      {accounts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-[hsl(210,80%,93%)] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Total Balance')}</p>
          <p className="text-2xl font-bold text-foreground">{totalBalance.toLocaleString()} XAF</p>
          <p className="text-[11px] text-muted-foreground">{accounts.length} account{accounts.length > 1 ? 's' : ''} linked</p>
          <button onClick={() => navigate('/app/linked-accounts')}
            className="mt-2 flex items-center gap-1 text-xs font-bold text-primary">
            <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Manage Linked Accounts
          </button>
        </motion.div>
      )}

      {/* Account Cards */}
      <div className="flex flex-col gap-3">
        {accounts.map((acc: any) => {
          const balance = getBalance(acc.id);
          const currency = getCurrency(acc.id);
          const color = getBankColor(acc.account_holder_name);
          const txns = getAccountTxns(acc.id);

          return (
            <motion.div key={acc.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-3xl border-2" style={{ borderColor: color, backgroundColor: color }}>
              <button onClick={() => setExpandedId(expandedId === acc.id ? null : acc.id)}
                className="flex w-full items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/60">
                    <Building2 className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-semibold text-foreground">{acc.account_holder_name}</span>
                    <span className="text-xs text-foreground/60">{acc.nickname || acc.account_id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{balance.toLocaleString()} {currency}</span>
                  {expandedId === acc.id ? <ChevronUp className="h-4 w-4 text-foreground/60" /> : <ChevronDown className="h-4 w-4 text-foreground/60" />}
                </div>
              </button>

              <AnimatePresence>
                {expandedId === acc.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-foreground/10 bg-background/40 px-4 pb-4 pt-3">
                      <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
                        <div className="rounded-xl bg-background/50 p-2">
                          <p className="text-muted-foreground">{tr('Type')}</p>
                          <p className="font-semibold text-foreground capitalize">{acc.account_subtype}</p>
                        </div>
                        <div className="rounded-xl bg-background/50 p-2">
                          <p className="text-muted-foreground">{tr('Status')}</p>
                          <p className="font-semibold text-foreground">{acc.is_active ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{tr('Recent Transactions')}</p>
                      {txns.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{tr('No transactions yet')}</p>
                      ) : txns.map((tx: any) => (
                        <div key={tx.id} className="flex items-center justify-between py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-foreground">{tx.transaction_information || tx.transaction_type}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {tx.booking_datetime ? new Date(tx.booking_datetime).toLocaleDateString() : ''}
                            </span>
                          </div>
                          <span className={`text-xs font-semibold ${tx.credit_debit_indicator === 'Credit' ? 'text-[hsl(150,60%,40%)]' : 'text-destructive'}`}>
                            {tx.credit_debit_indicator === 'Credit' ? '+' : '-'}{Math.abs(tx.amount || 0).toLocaleString()} {tx.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {accounts.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">{tr('No linked accounts')}</p>
            <p className="text-xs text-muted-foreground text-center">{tr('Your bank accounts linked to this institution will appear here')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerBank;
