import React, { useState, useEffect } from 'react';
import { PWATopBar } from '@/components/pwa/PWATopBar';
import { Eye, EyeOff, Send, QrCode, ArrowDownLeft, Smartphone, ChevronRight, PiggyBank, Landmark, BarChart3, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { useBankAccounts, useBankTransactions, useSavingsAccounts, useLoanApplications, useCreditScore } from '@/hooks/useBankingData';
import { useTenant, HomeSectionKey } from '@/components/pwa/TenantProvider';

const currencyColors: Record<string, { color: string; textColor: string }> = {
  XAF: { color: 'bg-[hsl(var(--bank-mint))]', textColor: 'text-[hsl(var(--bank-mint-fg))]' },
  EUR: { color: 'bg-[hsl(var(--bank-amber))]', textColor: 'text-[hsl(var(--bank-amber-fg))]' },
  USD: { color: 'bg-[hsl(var(--bank-sky))]', textColor: 'text-white' },
  GBP: { color: 'bg-[hsl(var(--bank-violet))]', textColor: 'text-white' },
};

const BankHome: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const tenant = useTenant();
  const { features, homeLayout, sectionOrder, layoutStyle } = tenant;
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

  const allQuickActions = [
    { icon: Send, label: 'Send', path: `payments/send`, color: 'bg-[hsl(var(--bank-violet))]' },
    { icon: ArrowDownLeft, label: 'Receive', path: 'payments/receive', color: 'bg-[hsl(var(--bank-teal))]' },
    { icon: Smartphone, label: 'MoMo', path: 'payments/mobile-money', color: 'bg-[hsl(var(--bank-amber))]', featureKey: 'mobile_money' as const },
    { icon: QrCode, label: 'QR Pay', path: 'payments/qr', color: 'bg-[hsl(var(--bank-sky))]', featureKey: 'qr_payments' as const },
  ];

  const quickActions = allQuickActions.filter(a => !a.featureKey || features[a.featureKey] !== false);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Build financial services items based on features
  const financialServiceItems = [
    features.savings && {
      key: 'savings',
      onClick: () => navigate(`/bank/${institutionId}/more/savings`),
      className: 'bg-[hsl(var(--bank-mint))]',
      icon: <PiggyBank className="h-7 w-7 text-[hsl(var(--bank-mint-fg))]" strokeWidth={1.5} />,
      value: totalSavings > 0 ? `${(totalSavings / 1000).toFixed(0)}K` : '0',
      label: 'Savings',
      textClass: 'text-[hsl(var(--bank-mint-fg))]',
    },
    features.loans && {
      key: 'loans',
      onClick: () => navigate(`/bank/${institutionId}/more/loans`),
      className: 'bg-[hsl(var(--bank-coral))]',
      icon: <Landmark className="h-7 w-7 text-[hsl(var(--bank-coral-fg))]" strokeWidth={1.5} />,
      value: activeLoans,
      label: 'Loans',
      textClass: 'text-[hsl(var(--bank-coral-fg))]',
    },
    features.credit_score && {
      key: 'credit',
      onClick: () => navigate(`/bank/${institutionId}/more/credit`),
      className: 'bg-[hsl(var(--bank-violet))]',
      icon: <BarChart3 className="h-7 w-7 text-[hsl(var(--bank-violet-fg))]" strokeWidth={1.5} />,
      value: creditScore ?? '—',
      label: 'Score',
      textClass: 'text-[hsl(var(--bank-violet-fg))]',
    },
  ].filter(Boolean) as Array<{ key: string; onClick: () => void; className: string; icon: React.ReactNode; value: string | number; label: string; textClass: string }>;

  const renderSection = (key: HomeSectionKey) => {
    switch (key) {
      case 'balance_card':
        if (!homeLayout.show_balance_card) return null;
        if (layoutStyle === 'minimal') {
          return (
            <div key="balance_card" className="py-2">
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Total Balance</span>
              <p className="mt-1 text-4xl font-light tracking-tight text-foreground">
                {accountsLoading ? '...' : showBalance ? `XAF ${totalBalance.toLocaleString()}` : '••••••••'}
              </p>
            </div>
          );
        }
        if (layoutStyle === 'classic') {
          return (
            <div key="balance_card" className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Balance</span>
                <button onClick={() => setShowBalance(!showBalance)}>
                  {showBalance ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {accountsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : showBalance ? `XAF ${totalBalance.toLocaleString()}` : '••••••••'}
              </p>
            </div>
          );
        }
        return (
          <motion.div
            key="balance_card"
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
        );

      case 'account_carousel':
        if (!homeLayout.show_account_carousel || accountCards.length === 0) return null;
        return (
          <div key="account_carousel" className="-mx-4 px-4">
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
        );

      case 'quick_actions':
        if (layoutStyle === 'classic') {
          return (
            <div key="quick_actions" className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => action.path && navigate(`/bank/${institutionId}/${action.path}`)}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 text-left"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}>
                      <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{action.label}</span>
                  </button>
                );
              })}
            </div>
          );
        }
        return (
          <div key="quick_actions" className="flex justify-between px-2">
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
        );

      case 'financial_services':
        if (!homeLayout.show_financial_services || financialServiceItems.length === 0) return null;
        return (
          <div key="financial_services">
            <h3 className="mb-3 text-base font-bold tracking-tight text-foreground">Financial Services</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${financialServiceItems.length}, minmax(0, 1fr))` }}>
              {financialServiceItems.map((item) => (
                <motion.button
                  key={item.key}
                  whileTap={{ scale: 0.96 }}
                  onClick={item.onClick}
                  className={`flex flex-col items-center gap-2 rounded-2xl ${item.className} p-4`}
                >
                  {item.icon}
                  <div className="text-center">
                    <p className={`text-lg font-bold ${item.textClass}`}>{item.value}</p>
                    <p className={`text-[10px] font-semibold ${item.textClass} opacity-70`}>{item.label}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        );

      case 'recent_transactions':
        if (!homeLayout.show_recent_transactions) return null;
        return (
          <div key="recent_transactions">
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col">
      <PWATopBar userName={userName} />

      <div className="flex flex-col gap-5 px-4 py-5">
        {sectionOrder.map((key) => renderSection(key))}
      </div>
    </div>
  );
};

export default BankHome;
