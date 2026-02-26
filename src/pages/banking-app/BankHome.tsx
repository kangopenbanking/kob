import React, { useState, useEffect } from 'react';
import { PWATopBar } from '@/components/pwa/PWATopBar';
import { Eye, EyeOff, Send, QrCode, ArrowDownLeft, Smartphone, ChevronRight, PiggyBank, Landmark, BarChart3, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { useBankAccounts, useBankTransactions, useSavingsAccounts, useLoanApplications, useCreditScore } from '@/hooks/useBankingData';

const currencyColors: Record<string, { color: string; textColor: string }> = {
  XAF: { color: 'bg-[hsl(var(--bank-mint))]', textColor: 'text-[hsl(var(--bank-mint-fg))]' },
  EUR: { color: 'bg-[hsl(var(--bank-amber))]', textColor: 'text-[hsl(var(--bank-amber-fg))]' },
  USD: { color: 'bg-[hsl(var(--bank-sky))]', textColor: 'text-white' },
  GBP: { color: 'bg-[hsl(var(--bank-violet))]', textColor: 'text-white' },
};

const BankHome: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [userName, setUserName] = useState('');

  const { data: accounts, isLoading: accountsLoading } = useBankAccounts();
  const { data: transactions, isLoading: txLoading } = useBankTransactions(4);
  const { data: savingsAccounts } = useSavingsAccounts();
  const { data: loanApps } = useLoanApplications();
  const { data: creditData } = useCreditScore();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
      }
    };
    fetchUser();
  }, []);

  // Compute totals from real data
  const totalBalance = (accounts || []).reduce((sum, acc) => {
    const bal = acc.account_balances?.[0]?.amount || 0;
    return sum + (acc.currency === 'XAF' ? bal : 0);
  }, 0);

  const accountCards = (accounts || []).reduce<Array<{ currency: string; balance: number; label: string; color: string; textColor: string }>>((arr, acc) => {
    const bal = acc.account_balances?.[0]?.amount || 0;
    const existing = arr.find(a => a.currency === acc.currency);
    if (existing) {
      existing.balance += bal;
    } else {
      const colors = currencyColors[acc.currency] || { color: 'bg-muted', textColor: 'text-foreground' };
      arr.push({ currency: acc.currency, balance: bal, label: acc.nickname || `${acc.currency} Account`, ...colors });
    }
    return arr;
  }, []);

  const totalSavings = (savingsAccounts || []).reduce((s, a) => s + (a.current_balance || 0), 0);
  const activeLoans = (loanApps || []).filter(l => ['approved', 'disbursed', 'active'].includes(l.status)).length;
  const creditScore = creditData?.score || null;

  const quickActions = [
    { icon: Send, label: 'Send', path: `payments/send`, color: 'bg-[hsl(var(--bank-violet))]' },
    { icon: ArrowDownLeft, label: 'Receive', path: 'payments/receive', color: 'bg-[hsl(var(--bank-teal))]' },
    { icon: Smartphone, label: 'MoMo', path: 'payments/mobile-money', color: 'bg-[hsl(var(--bank-amber))]' },
    { icon: QrCode, label: 'QR Pay', path: 'payments/qr', color: 'bg-[hsl(var(--bank-sky))]' },
  ];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col">
      <PWATopBar userName={userName} />

      <div className="flex flex-col gap-5 px-4 py-5">
        {/* Total Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-foreground p-6"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-background/60">Total Balance</span>
            <button onClick={() => setShowBalance(!showBalance)}>
              {showBalance ? (
                <Eye className="h-5 w-5 text-background/60" strokeWidth={1.5} />
              ) : (
                <EyeOff className="h-5 w-5 text-background/60" strokeWidth={1.5} />
              )}
            </button>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-background">
            {accountsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-background/40" />
            ) : showBalance ? (
              `XAF ${totalBalance.toLocaleString()}`
            ) : '••••••••'}
          </p>
        </motion.div>

        {/* Account Cards - Horizontal Scroll */}
        {accountCards.length > 0 && (
          <div className="-mx-4 px-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {accountCards.map((account) => (
                <motion.div
                  key={account.currency}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.97 }}
                  className={`min-w-[160px] rounded-2xl ${account.color} p-4`}
                >
                  <span className={`text-xs font-medium ${account.textColor} opacity-80`}>{account.label}</span>
                  <p className={`mt-2 text-lg font-bold ${account.textColor}`}>
                    {showBalance
                      ? `${account.currency} ${account.balance.toLocaleString()}`
                      : '••••'}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex justify-between px-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => action.path && navigate(`/bank/${institutionId}/${action.path}`)}
                className="flex flex-col items-center gap-2"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${action.color}`}>
                  <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
                </div>
                <span className="text-xs font-semibold text-foreground">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Financial Services Row */}
        <div>
          <h3 className="mb-3 text-base font-bold tracking-tight text-foreground">Financial Services</h3>
          <div className="grid grid-cols-3 gap-3">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(`/bank/${institutionId}/more/savings`)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(var(--bank-mint))] p-4"
            >
              <PiggyBank className="h-7 w-7 text-[hsl(var(--bank-mint-fg))]" strokeWidth={1.5} />
              <div className="text-center">
                <p className="text-lg font-bold text-[hsl(var(--bank-mint-fg))]">
                  {totalSavings > 0 ? `${(totalSavings / 1000).toFixed(0)}K` : '0'}
                </p>
                <p className="text-[10px] font-semibold text-[hsl(var(--bank-mint-fg))] opacity-70">Savings</p>
              </div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(`/bank/${institutionId}/more/loans`)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(var(--bank-coral))] p-4"
            >
              <Landmark className="h-7 w-7 text-[hsl(var(--bank-coral-fg))]" strokeWidth={1.5} />
              <div className="text-center">
                <p className="text-lg font-bold text-[hsl(var(--bank-coral-fg))]">{activeLoans}</p>
                <p className="text-[10px] font-semibold text-[hsl(var(--bank-coral-fg))] opacity-70">Loans</p>
              </div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(`/bank/${institutionId}/more/credit`)}
              className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(var(--bank-violet))] p-4"
            >
              <BarChart3 className="h-7 w-7 text-[hsl(var(--bank-violet-fg))]" strokeWidth={1.5} />
              <div className="text-center">
                <p className="text-lg font-bold text-[hsl(var(--bank-violet-fg))]">
                  {creditScore ?? '—'}
                </p>
                <p className="text-[10px] font-semibold text-[hsl(var(--bank-violet-fg))] opacity-70">Score</p>
              </div>
            </motion.button>
          </div>
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold tracking-tight text-foreground">Recent Transactions</h3>
            <button
              onClick={() => navigate(`/bank/${institutionId}/history`)}
              className="flex items-center gap-1 text-sm font-semibold text-primary"
            >
              See all
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {txLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (transactions || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet</p>
          ) : (
            <div className="flex flex-col gap-1">
              {(transactions || []).map((tx) => {
                const isCredit = tx.credit_debit_indicator === 'Credit';
                return (
                  <motion.div
                    key={tx.id}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-between rounded-2xl px-3 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                        isCredit ? 'bg-[hsl(var(--bank-mint))]/15' : 'bg-[hsl(var(--bank-coral))]/15'
                      }`}>
                        {isCredit ? (
                          <ArrowDownLeft className="h-5 w-5 text-[hsl(var(--bank-teal))]" strokeWidth={1.5} />
                        ) : (
                          <Send className="h-5 w-5 text-[hsl(var(--bank-coral))]" strokeWidth={1.5} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {tx.transaction_information || tx.transaction_type}
                        </p>
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatDate(tx.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-base font-bold ${
                      isCredit ? 'text-[hsl(var(--bank-teal))]' : 'text-foreground'
                    }`}>
                      {isCredit ? '+' : '-'}{Math.abs(tx.amount || 0).toLocaleString()} {tx.currency}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BankHome;
