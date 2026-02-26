import React, { useState, useEffect } from 'react';
import { PWATopBar } from '@/components/pwa/PWATopBar';
import { Eye, EyeOff, Send, QrCode, ArrowDownLeft, Smartphone, ChevronRight, PiggyBank, Landmark, BarChart3, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';

const BankHome: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const [showBalance, setShowBalance] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
      }
    };
    fetchUser();
  }, []);

  const quickActions = [
    { icon: Send, label: 'Send', path: `payments/send`, color: 'bg-[hsl(var(--bank-violet))]' },
    { icon: ArrowDownLeft, label: 'Receive', path: 'payments/receive', color: 'bg-[hsl(var(--bank-teal))]' },
    { icon: Smartphone, label: 'MoMo', path: 'payments/mobile-money', color: 'bg-[hsl(var(--bank-amber))]' },
    { icon: QrCode, label: 'QR Pay', path: 'payments/qr', color: 'bg-[hsl(var(--bank-sky))]' },
  ];

  const mockTransactions = [
    { id: '1', name: 'MTN MoMo Transfer', amount: -15000, date: 'Today', type: 'debit' },
    { id: '2', name: 'Salary Deposit', amount: 450000, date: 'Yesterday', type: 'credit' },
    { id: '3', name: 'Electricity Bill', amount: -8500, date: 'Feb 24', type: 'debit' },
    { id: '4', name: 'Orange Money', amount: -5000, date: 'Feb 23', type: 'debit' },
  ];

  const mockAccounts = [
    { currency: 'XAF', balance: 2450000, label: 'Main Account', color: 'bg-[hsl(var(--bank-mint))]', textColor: 'text-[hsl(var(--bank-mint-fg))]' },
    { currency: 'EUR', balance: 1200, label: 'Euro Account', color: 'bg-[hsl(var(--bank-amber))]', textColor: 'text-[hsl(var(--bank-amber-fg))]' },
    { currency: 'USD', balance: 800, label: 'Dollar Account', color: 'bg-[hsl(var(--bank-sky))]', textColor: 'text-[hsl(var(--bank-sky-fg))]' },
  ];

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
            {showBalance ? 'XAF 2,450,000' : '••••••••'}
          </p>
          <p className="mt-1 text-sm font-medium text-[hsl(var(--bank-mint))]">+XAF 42,500</p>
        </motion.div>

        {/* Account Cards - Horizontal Scroll */}
        <div className="-mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {mockAccounts.map((account) => (
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
                <p className="text-lg font-bold text-[hsl(var(--bank-mint-fg))]">410K</p>
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
                <p className="text-lg font-bold text-[hsl(var(--bank-coral-fg))]">0</p>
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
                <p className="text-lg font-bold text-[hsl(var(--bank-violet-fg))]">720</p>
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

          <div className="flex flex-col gap-1">
            {mockTransactions.map((tx) => (
              <motion.div
                key={tx.id}
                whileTap={{ scale: 0.98 }}
                className="flex items-center justify-between rounded-2xl px-3 py-3.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                    tx.type === 'credit' ? 'bg-[hsl(var(--bank-mint))]/15' : 'bg-[hsl(var(--bank-coral))]/15'
                  }`}>
                    {tx.type === 'credit' ? (
                      <ArrowDownLeft className="h-5 w-5 text-[hsl(var(--bank-teal))]" strokeWidth={1.5} />
                    ) : (
                      <Send className="h-5 w-5 text-[hsl(var(--bank-coral))]" strokeWidth={1.5} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tx.name}</p>
                    <p className="text-xs font-medium text-muted-foreground">{tx.date}</p>
                  </div>
                </div>
                <span className={`text-base font-bold ${
                  tx.type === 'credit' ? 'text-[hsl(var(--bank-teal))]' : 'text-foreground'
                }`}>
                  {tx.type === 'credit' ? '+' : ''}{tx.amount.toLocaleString()} XAF
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankHome;
