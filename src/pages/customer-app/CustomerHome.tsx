import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Bell, Eye, EyeOff, ArrowUpRight, ArrowDownLeft,
  ShoppingBag, Lock, Smartphone, Gift, Wallet,
  TrendingUp, TrendingDown, Send, Download, Banknote, Link2,
  Receipt, FileText, Users, RefreshCw, PiggyBank, CircleDollarSign,
  BarChart3, Home, Building2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useNotifications } from '@/hooks/useNotifications';

/* ─── Mock Account Cards ─── */
const accountCards = [
  { name: 'Main Wallet', balance: 485000, currency: 'XAF', color: 'bg-[hsl(225,50%,22%)]', textColor: 'text-[hsl(0,0%,100%)]' },
  { name: 'Savings', balance: 120000, currency: 'XAF', color: 'bg-[hsl(150,35%,30%)]', textColor: 'text-[hsl(0,0%,100%)]' },
  { name: 'Mobile Money', balance: 35000, currency: 'XAF', color: 'bg-[hsl(25,60%,35%)]', textColor: 'text-[hsl(0,0%,100%)]' },
];

/* ─── Mock Recent Activities ─── */
const recentActivities = [
  { name: 'Grocery Store', type: 'Shopping', amount: -12500, icon: ShoppingBag, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]', time: '2h ago' },
  { name: 'Salary Deposit', type: 'Income', amount: 350000, icon: ArrowDownLeft, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', time: '5h ago' },
  { name: 'Transfer to John', type: 'Transfer', amount: -25000, icon: ArrowUpRight, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', time: 'Yesterday' },
  { name: 'Mobile Top-up', type: 'Airtime', amount: -5000, icon: Smartphone, color: 'bg-[hsl(255,50%,92%)]', iconColor: 'text-[hsl(255,50%,45%)]', time: 'Yesterday' },
  { name: 'Reward Cashback', type: 'Rewards', amount: 1500, icon: Gift, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]', time: '2 days ago' },
];

/* ─── Service Section Data ─── */
interface FeatureItem {
  label: string;
  description?: string;
  icon: React.ElementType;
  path: string;
  color: string;
  iconColor: string;
  borderColor: string;
  featureKey?: string;
}

const moneyMovement: FeatureItem[] = [
  { label: 'Transfer', description: 'Send money to anyone instantly', icon: Send, path: 'transfer', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', borderColor: 'border-[hsl(210,60%,45%)]', featureKey: 'transfer' },
  { label: 'Request', description: 'Ask someone to pay you', icon: Download, path: 'request', color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', borderColor: 'border-[hsl(150,40%,35%)]', featureKey: 'request' },
  { label: 'Cash Out', description: 'Withdraw at agents', icon: Banknote, path: 'cash-out', color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]', borderColor: 'border-[hsl(45,60%,55%)]', featureKey: 'cash_out' },
  { label: 'Pay Links', description: 'Share a payment link', icon: Link2, path: 'pay-links', color: 'bg-[hsl(180,50%,90%)]', iconColor: 'text-[hsl(180,40%,35%)]', borderColor: 'border-[hsl(180,40%,55%)]', featureKey: 'pay_links' },
];

const paymentsBills: FeatureItem[] = [
  { label: 'Bills', icon: Receipt, path: 'bills', color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]', borderColor: 'border-[hsl(25,60%,60%)]', featureKey: 'bills' },
  { label: 'Invoices', icon: FileText, path: 'invoices', color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]', borderColor: 'border-[hsl(50,60%,55%)]', featureKey: 'invoices' },
  { label: 'Split Bills', icon: Users, path: 'split-bills', color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', borderColor: 'border-[hsl(340,50%,60%)]', featureKey: 'split_bills' },
  { label: 'Recurring', icon: RefreshCw, path: 'recurring', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', borderColor: 'border-[hsl(210,60%,65%)]', featureKey: 'recurring' },
];

const savingsGoals: FeatureItem[] = [
  { label: 'Piggy Bank', description: 'Save towards your goals', icon: PiggyBank, path: 'piggybank', color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', borderColor: 'border-foreground', featureKey: 'piggy_bank' },
  { label: 'Njangi', description: 'Group savings circles', icon: CircleDollarSign, path: 'njangi', color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]', borderColor: 'border-foreground', featureKey: 'njangi' },
  { label: 'Rewards', description: 'Earn & redeem points', icon: Gift, path: 'rewards', color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]', borderColor: 'border-foreground', featureKey: 'rewards' },
];

const financialHealth: FeatureItem[] = [
  { label: 'Credit Score', icon: BarChart3, path: 'credit', color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', borderColor: 'border-[hsl(150,40%,55%)]', featureKey: 'credit_score' },
  { label: 'Rent Report', icon: Home, path: 'rent-reporting', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', borderColor: 'border-[hsl(210,60%,65%)]', featureKey: 'rent_reporting' },
  { label: 'Bank', icon: Building2, path: 'bank', color: 'bg-[hsl(225,50%,92%)]', iconColor: 'text-[hsl(225,40%,40%)]', borderColor: 'border-[hsl(225,40%,60%)]', featureKey: 'bank' },
];

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

const CustomerHome: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const tenant = useCustomerTenant();
  const { user } = useCustomerAuth();
  const { unreadCount } = useNotifications(institutionId);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [period, setPeriod] = useState<'W' | 'M' | 'Y'>('M');

  const isViewOnly = user?.isViewOnly ?? false;
  const totalBalance = accountCards.reduce((s, a) => s + a.balance, 0);

  const go = (path: string) => navigate(`/app/${institutionId}/${path}`);
  const isVisible = (f: FeatureItem) => !f.featureKey || tenant.features[f.featureKey as keyof typeof tenant.features] !== false;

  const visibleMoney = moneyMovement.filter(isVisible);
  const visiblePayments = paymentsBills.filter(isVisible);
  const visibleSavings = savingsGoals.filter(isVisible);
  const visibleHealth = financialHealth.filter(isVisible);

  const earnings = 351500;
  const spending = 68000;

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* ─── Balance Hero Section (flush to edges) ─── */}
      <motion.div {...fadeUp} transition={{ duration: 0.35 }}>
        <div className="bg-primary px-5 pt-5 pb-5 relative overflow-hidden rounded-b-3xl">
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[hsl(0,0%,100%)]/5" />
          <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-[hsl(0,0%,100%)]/5" />

          {/* Top Bar inside hero */}
          <div className="relative flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {tenant.logoUrl && (
                <img src={tenant.logoUrl} alt={tenant.name} className="h-9 w-9 rounded-xl object-contain" />
              )}
              <div>
                <p className="text-[10px] font-medium text-primary-foreground/60">Hello,</p>
                <h2 className="text-lg font-bold text-primary-foreground">{tenant.name}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setBalanceVisible(!balanceVisible)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(0,0%,100%)]/10">
                {balanceVisible ? <Eye className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} /> : <EyeOff className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />}
              </button>
              <button onClick={() => go('alerts')} className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(0,0%,100%)]/10">
                <Bell className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* View-Only Banner */}
          {isViewOnly && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="relative flex items-center gap-3 rounded-2xl border border-[hsl(0,0%,100%)]/20 bg-[hsl(0,0%,100%)]/10 p-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(0,0%,100%)]/15">
                <Lock className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-primary-foreground">View-Only Mode</p>
                <p className="text-[11px] text-primary-foreground/60">Link an account to unlock transactions</p>
              </div>
              <button onClick={() => go('onboarding')} className="rounded-xl bg-primary-foreground px-3.5 py-1.5 text-xs font-bold text-primary">Link</button>
            </motion.div>
          )}

          {/* Balances Label */}
          <div className="relative flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-primary-foreground/80">Balances</p>
            <div className="flex rounded-xl bg-[hsl(0,0%,100%)]/10 p-0.5">
              {(['W', 'M', 'Y'] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-colors ${period === p ? 'bg-primary-foreground text-primary' : 'text-primary-foreground/50'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Account Cards Carousel */}
          {!isViewOnly && (
            <div className="relative flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {accountCards.map((acct, i) => (
                <div key={i} className="flex min-w-[145px] flex-1 flex-col rounded-2xl bg-[hsl(0,0%,100%)]/15 backdrop-blur-sm p-4 border border-[hsl(0,0%,100%)]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${acct.color}`}>
                      {i === 0 && <Wallet className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />}
                      {i === 1 && <PiggyBank className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />}
                      {i === 2 && <Smartphone className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />}
                    </div>
                    <p className="text-[10px] font-semibold text-primary-foreground/80">{acct.name}</p>
                  </div>
                  <p className="text-lg font-bold text-primary-foreground">
                    {balanceVisible ? `${acct.currency} ${acct.balance.toLocaleString()}` : '•••'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {isViewOnly && (
            <p className="relative text-3xl font-bold text-primary-foreground text-center py-4">• • • • •</p>
          )}

          {/* Total */}
          {!isViewOnly && balanceVisible && (
            <div className="relative mt-4 flex items-center justify-between border-t border-[hsl(0,0%,100%)]/10 pt-3">
              <p className="text-xs font-medium text-primary-foreground/60">Total Balance</p>
              <p className="text-base font-bold text-primary-foreground">XAF {totalBalance.toLocaleString()}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ─── Padded content ─── */}
      <div className="flex flex-col gap-5 px-5">

      {/* ─── Money Movement ─── */}
      {visibleMoney.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.03 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Money Movement</p>
          <div className="grid grid-cols-2 gap-3">
            {visibleMoney.slice(0, 2).map((item) => (
              <button key={item.path} onClick={() => go(item.path)}
                className={`flex flex-col items-start gap-3 rounded-3xl ${item.color} p-5 text-left min-h-[140px] border-2 ${item.borderColor}`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50">
                  <item.icon className={`h-6 w-6 ${item.iconColor}`} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{item.description}</p>
                </div>
              </button>
            ))}
            {visibleMoney.slice(2).map((item) => (
              <button key={item.path} onClick={() => go(item.path)}
                className={`flex items-center gap-3 rounded-2xl ${item.color} p-4 border-2 ${item.borderColor}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/50">
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.description}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Payments & Bills ─── */}
      {visiblePayments.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.06 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Payments & Bills</p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {visiblePayments.map((item) => (
              <button key={item.path} onClick={() => go(item.path)}
                className={`flex min-w-[110px] flex-col items-center gap-2.5 rounded-3xl ${item.color} p-4 border-2 ${item.borderColor}`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50">
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold text-foreground">{item.label}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Savings & Goals ─── */}
      {visibleSavings.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.09 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Savings & Goals</p>
          <div className="flex flex-col gap-3">
            {visibleSavings[0] && (() => {
              const FirstIcon = visibleSavings[0].icon;
              return (
                <button onClick={() => go(visibleSavings[0].path)}
                  className={`flex items-center gap-4 rounded-3xl ${visibleSavings[0].color} p-5 text-left w-full border-2 ${visibleSavings[0].borderColor}`}>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background/50">
                    <FirstIcon className={`h-7 w-7 ${visibleSavings[0].iconColor}`} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{visibleSavings[0].label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{visibleSavings[0].description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                </button>
              );
            })()}
            <div className="grid grid-cols-2 gap-3">
              {visibleSavings.slice(1).map((item) => (
                <button key={item.path} onClick={() => go(item.path)}
                  className={`flex flex-col items-center gap-2.5 rounded-3xl ${item.color} p-5 border-2 ${item.borderColor}`}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50">
                    <item.icon className={`h-6 w-6 ${item.iconColor}`} strokeWidth={1.5} />
                  </div>
                  <p className="text-xs font-bold text-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground text-center">{item.description}</p>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Financial Health ─── */}
      {visibleHealth.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.12 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Financial Health</p>
          <div className="grid grid-cols-3 gap-3">
            {visibleHealth.map((item) => (
              <button key={item.path} onClick={() => go(item.path)}
                className={`flex flex-col items-center gap-2 rounded-3xl ${item.color} p-4 border-2 ${item.borderColor}`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/50">
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
                </div>
                <p className="text-[11px] font-bold text-foreground text-center leading-tight">{item.label}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Spending Stats ─── */}
      {!isViewOnly && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.15 }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 rounded-3xl bg-[hsl(150,40%,90%)] p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(150,40%,80%)]">
                <TrendingUp className="h-4.5 w-4.5 text-[hsl(150,40%,30%)]" strokeWidth={2} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(150,30%,35%)]">Earnings</p>
              <p className="text-lg font-bold text-[hsl(150,40%,25%)]">{earnings.toLocaleString()}</p>
              <p className="text-[10px] font-medium text-[hsl(150,30%,40%)]">This {period === 'W' ? 'week' : period === 'M' ? 'month' : 'year'}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-3xl bg-[hsl(0,60%,93%)] p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(0,50%,85%)]">
                <TrendingDown className="h-4.5 w-4.5 text-[hsl(0,50%,35%)]" strokeWidth={2} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(0,30%,40%)]">Spending</p>
              <p className="text-lg font-bold text-[hsl(0,50%,30%)]">{spending.toLocaleString()}</p>
              <p className="text-[10px] font-medium text-[hsl(0,30%,45%)]">This {period === 'W' ? 'week' : period === 'M' ? 'month' : 'year'}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Recent Activities ─── */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.18 }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Recent Activities</p>
          <button onClick={() => go('activity')} className="flex items-center gap-0.5 text-xs font-semibold text-primary">
            See All <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        {isViewOnly ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-border bg-muted/30 p-10">
            <Lock className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground">Link an account to see activity</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivities.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.color}`}>
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.type} · {item.time}</p>
                </div>
                <p className={`text-sm font-bold tabular-nums ${item.amount > 0 ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`}>
                  {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()} <span className="text-[10px] font-medium text-muted-foreground">XAF</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
      </div>
    </div>
  );
};

export default CustomerHome;
