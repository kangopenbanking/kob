import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send, Download, Receipt, FileText, Building2, Users,
  Link2, Banknote, RefreshCw, Gift, PiggyBank, CircleDollarSign,
  Home, BarChart3, Settings, HelpCircle, Bell, ScanLine, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';

interface FeatureItem {
  label: string;
  description?: string;
  icon: React.ElementType;
  path: string;
  color: string;
  iconColor: string;
  featureKey?: string;
}

/* ─── Money Movement ─── */
const moneyMovement: FeatureItem[] = [
  { label: 'Transfer', description: 'Send money to anyone instantly', icon: Send, path: 'transfer', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', featureKey: 'transfer' },
  { label: 'Request', description: 'Ask someone to pay you', icon: Download, path: 'request', color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', featureKey: 'request' },
  { label: 'Cash Out', description: 'Withdraw at agents', icon: Banknote, path: 'cash-out', color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]', featureKey: 'cash_out' },
  { label: 'Pay Links', description: 'Share a payment link', icon: Link2, path: 'pay-links', color: 'bg-[hsl(180,50%,90%)]', iconColor: 'text-[hsl(180,40%,35%)]', featureKey: 'pay_links' },
];

/* ─── Payments & Bills ─── */
const paymentsBills: FeatureItem[] = [
  { label: 'Bills', icon: Receipt, path: 'bills', color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]', featureKey: 'bills' },
  { label: 'Invoices', icon: FileText, path: 'invoices', color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]', featureKey: 'invoices' },
  { label: 'Split Bills', icon: Users, path: 'split-bills', color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', featureKey: 'split_bills' },
  { label: 'Recurring', icon: RefreshCw, path: 'recurring', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', featureKey: 'recurring' },
];

/* ─── Savings & Goals ─── */
const savingsGoals: FeatureItem[] = [
  { label: 'Piggy Bank', description: 'Save towards your goals with automated deposits', icon: PiggyBank, path: 'piggybank', color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', featureKey: 'piggy_bank' },
  { label: 'Njangi', description: 'Group savings circles', icon: CircleDollarSign, path: 'njangi', color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]', featureKey: 'njangi' },
  { label: 'Rewards', description: 'Earn & redeem points', icon: Gift, path: 'rewards', color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]', featureKey: 'rewards' },
];

/* ─── Financial Health ─── */
const financialHealth: FeatureItem[] = [
  { label: 'Credit Score', icon: BarChart3, path: 'credit', color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', featureKey: 'credit_score' },
  { label: 'Rent Report', icon: Home, path: 'rent-reporting', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', featureKey: 'rent_reporting' },
  { label: 'Bank', icon: Building2, path: 'bank', color: 'bg-[hsl(225,50%,92%)]', iconColor: 'text-[hsl(225,40%,40%)]', featureKey: 'bank' },
];

const utilityItems: FeatureItem[] = [
  { label: 'Settings', icon: Settings, path: 'settings', color: 'bg-muted', iconColor: 'text-foreground' },
  { label: 'Alerts', icon: Bell, path: 'alerts', color: 'bg-muted', iconColor: 'text-foreground' },
  { label: 'Help', icon: HelpCircle, path: 'help', color: 'bg-muted', iconColor: 'text-foreground' },
];

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

const CustomerMore: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const tenant = useCustomerTenant();

  const isVisible = (f: FeatureItem) => !f.featureKey || tenant.features[f.featureKey as keyof typeof tenant.features] !== false;
  const go = (path: string) => navigate(`/app/${institutionId}/${path}`);

  const visibleMoney = moneyMovement.filter(isVisible);
  const visiblePayments = paymentsBills.filter(isVisible);
  const visibleSavings = savingsGoals.filter(isVisible);
  const visibleHealth = financialHealth.filter(isVisible);

  return (
    <div className="flex flex-col gap-6 p-5 pb-8">
      <h1 className="text-xl font-bold text-foreground">Services</h1>

      {/* ─── Money Movement: 2 tall + 2 small ─── */}
      {visibleMoney.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Money Movement</p>
          <div className="grid grid-cols-2 gap-3">
            {visibleMoney.slice(0, 2).map((item) => (
              <button key={item.path} onClick={() => go(item.path)}
                className={`flex flex-col items-start gap-3 rounded-3xl ${item.color} p-5 text-left min-h-[140px]`}>
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
                className={`flex items-center gap-3 rounded-2xl ${item.color} p-4`}>
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

      {/* ─── Payments & Bills: Horizontal scroll medium cards ─── */}
      {visiblePayments.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.05 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Payments & Bills</p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {visiblePayments.map((item) => (
              <button key={item.path} onClick={() => go(item.path)}
                className={`flex min-w-[110px] flex-col items-center gap-2.5 rounded-3xl ${item.color} p-4`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50">
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold text-foreground">{item.label}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Savings & Goals: 1 wide banner + 2 squares ─── */}
      {visibleSavings.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Savings & Goals</p>
          <div className="flex flex-col gap-3">
            {visibleSavings[0] && (() => {
              const FirstIcon = visibleSavings[0].icon;
              return (
                <button onClick={() => go(visibleSavings[0].path)}
                  className={`flex items-center gap-4 rounded-3xl ${visibleSavings[0].color} p-5 text-left w-full`}>
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
                  className={`flex flex-col items-center gap-2.5 rounded-3xl ${item.color} p-5`}>
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

      {/* ─── Financial Health: 3 equal cards ─── */}
      {visibleHealth.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.15 }}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Financial Health</p>
          <div className="grid grid-cols-3 gap-3">
            {visibleHealth.map((item) => (
              <button key={item.path} onClick={() => go(item.path)}
                className={`flex flex-col items-center gap-2 rounded-3xl ${item.color} p-4`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/50">
                  <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
                </div>
                <p className="text-[11px] font-bold text-foreground text-center leading-tight">{item.label}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Account ─── */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.2 }}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Account</p>
        <div className="space-y-2">
          {utilityItems.map((item) => (
            <button key={item.path} onClick={() => go(item.path)}
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.color}`}>
                <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default CustomerMore;
