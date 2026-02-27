import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Bell, Eye, EyeOff, Send, Download, Plus, ArrowUpRight, ArrowDownLeft,
  ShoppingBag, Lock, QrCode, Receipt, Wallet, ChevronRight, CreditCard,
  Smartphone, Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomerTenant, type CustomerSectionKey } from '@/components/customer-app/CustomerTenantProvider';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { MediaBanner } from '@/components/pwa/MediaBanner';

/* ─── Quick Actions ─── */
const allQuickActions = [
  { key: 'transfer', label: 'Transfer', icon: Send, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', requiresAccount: true },
  { key: 'request', label: 'Request', icon: Download, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', requiresAccount: true },
  { key: 'qr_scan', label: 'Scan', icon: QrCode, color: 'bg-[hsl(255,50%,92%)]', iconColor: 'text-[hsl(255,50%,45%)]', requiresAccount: true },
  { key: 'bills', label: 'Bills', icon: Receipt, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]', requiresAccount: true },
  { key: 'cash_out', label: 'Cash Out', icon: Wallet, color: 'bg-[hsl(340,50%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', requiresAccount: true },
  { key: 'bank', label: 'Add', icon: Plus, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]', requiresAccount: false },
];

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

const CustomerHome: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const tenant = useCustomerTenant();
  const { user } = useCustomerAuth();
  const [balanceVisible, setBalanceVisible] = useState(true);

  const isViewOnly = user?.isViewOnly ?? false;

  const handleAction = (key: string, requiresAccount: boolean) => {
    if (requiresAccount && isViewOnly) {
      navigate(`/app/${institutionId}/onboarding`);
      return;
    }
    const pathMap: Record<string, string> = {
      transfer: 'transfer', request: 'request', qr_scan: 'scan',
      bills: 'bills', cash_out: 'cash-out', bank: 'bank',
    };
    navigate(`/app/${institutionId}/${pathMap[key] || key}`);
  };

  const totalBalance = accountCards.reduce((s, a) => s + a.balance, 0);

  const enabledActions = allQuickActions.filter(
    (a) => (tenant.features as any)[a.key] !== false
  );

  /* ─── Section Renderers ─── */
  const renderBalanceCard = () => (
    <motion.div
      key="balance_card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Main Balance */}
      <div className="rounded-3xl bg-[hsl(225,50%,22%)] p-6">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(0,0%,100%)]/60">
            Total Balance
          </p>
          <button onClick={() => setBalanceVisible(!balanceVisible)}>
            {balanceVisible ? (
              <Eye className="h-4 w-4 text-[hsl(0,0%,100%)]/60" strokeWidth={1.5} />
            ) : (
              <EyeOff className="h-4 w-4 text-[hsl(0,0%,100%)]/60" strokeWidth={1.5} />
            )}
          </button>
        </div>
        <p className="mt-2 text-3xl font-bold text-[hsl(0,0%,100%)]">
          {isViewOnly ? '• • • • •' : balanceVisible ? `XAF ${totalBalance.toLocaleString()}` : '• • • • •'}
        </p>
        {!isViewOnly && balanceVisible && (
          <p className="mt-1 text-xs font-medium text-[hsl(150,60%,65%)]">+ 12,500 today</p>
        )}
      </div>

      {/* Account Cards Row */}
      {!isViewOnly && (
        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {accountCards.map((acct, i) => (
            <div
              key={i}
              className={`flex min-w-[140px] flex-1 flex-col rounded-2xl ${acct.color} p-3.5`}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${acct.textColor}/70`}>
                {acct.name}
              </p>
              <p className={`mt-1 text-base font-bold ${acct.textColor}`}>
                {balanceVisible ? `${acct.balance.toLocaleString()}` : '•••'}
              </p>
              <p className={`text-[10px] ${acct.textColor}/50`}>{acct.currency}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );

  const renderQuickActions = () => (
    <motion.div
      key="quick_actions"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
    >
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {enabledActions.slice(0, 6).map((action) => (
          <button
            key={action.key}
            onClick={() => handleAction(action.key, action.requiresAccount)}
            className="flex flex-col items-center gap-2"
          >
            <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${action.color}`}>
              <action.icon className={`h-6 w-6 ${action.iconColor}`} strokeWidth={1.5} />
              {action.requiresAccount && isViewOnly && (
                <div className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-muted-foreground/80">
                  <Lock className="h-2.5 w-2.5 text-background" strokeWidth={2.5} />
                </div>
              )}
            </div>
            <span className="text-xs font-semibold text-foreground">{action.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );

  const renderMediaBanner = () => {
    if (!tenant.mediaSections || tenant.mediaSections.length === 0) return null;
    return (
      <motion.div
        key="media_banner"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <MediaBanner items={tenant.mediaSections} cardSize="medium" />
      </motion.div>
    );
  };

  const renderRecentActivities = () => (
    <motion.div
      key="recent_activities"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Recent Activities
        </p>
        <button
          onClick={() => navigate(`/app/${institutionId}/activity`)}
          className="flex items-center gap-0.5 text-xs font-semibold text-primary"
        >
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
  );

  const sectionRenderers: Record<CustomerSectionKey, () => React.ReactNode> = {
    balance_card: renderBalanceCard,
    quick_actions: renderQuickActions,
    media_banner: renderMediaBanner,
    recent_activities: renderRecentActivities,
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {tenant.logoUrl && (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-9 w-9 rounded-xl object-contain" />
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Welcome back</p>
            <h1 className="text-base font-bold text-foreground">{tenant.name}</h1>
          </div>
        </div>
        <button
          onClick={() => navigate(`/app/${institutionId}/notifications`)}
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-muted"
        >
          <Bell className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[hsl(0,80%,60%)]" />
        </button>
      </div>

      {/* View-Only Banner */}
      {isViewOnly && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 rounded-2xl border border-[hsl(45,60%,75%)] bg-[hsl(45,80%,92%)] p-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(45,70%,80%)]">
            <Lock className="h-4 w-4 text-[hsl(45,50%,25%)]" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-[hsl(45,40%,20%)]">View-Only Mode</p>
            <p className="text-[11px] text-[hsl(45,30%,35%)]">Link an account to unlock transactions</p>
          </div>
          <button
            onClick={() => navigate(`/app/${institutionId}/onboarding`)}
            className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground"
          >
            Link
          </button>
        </motion.div>
      )}

      {/* Dynamic Sections */}
      <AnimatePresence mode="wait">
        {tenant.sectionOrder.map((section) => {
          const renderer = sectionRenderers[section];
          return renderer ? <React.Fragment key={section}>{renderer()}</React.Fragment> : null;
        })}
      </AnimatePresence>
    </div>
  );
};

export default CustomerHome;
