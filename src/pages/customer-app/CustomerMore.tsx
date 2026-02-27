import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send, Download, Receipt, FileText, Building2, Users,
  Link2, Banknote, RefreshCw, Gift, PiggyBank, CircleDollarSign,
  Settings, HelpCircle, Bell, ScanLine, QrCode, Wallet, Plus,
  Lock, ChevronRight, Zap, Wifi, Tv
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { MediaBanner } from '@/components/pwa/MediaBanner';

/* ─── Quick Actions ─── */
const allQuickActions = [
  { key: 'transfer', label: 'Transfer', icon: Send, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', featureKey: 'transfer' },
  { key: 'request', label: 'Request', icon: Download, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', featureKey: 'request' },
  { key: 'qr_scan', label: 'Scan', icon: QrCode, color: 'bg-[hsl(255,50%,92%)]', iconColor: 'text-[hsl(255,50%,45%)]', featureKey: 'qr_scan' },
  { key: 'bills', label: 'Bills', icon: Receipt, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]', featureKey: 'bills' },
  { key: 'cash_out', label: 'Cash Out', icon: Wallet, color: 'bg-[hsl(340,50%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', featureKey: 'cash_out' },
  { key: 'bank', label: 'Add', icon: Plus, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
];

/* ─── Mock Upcoming Bills ─── */
const upcomingBills = [
  { name: 'Electricity', amount: 15000, due: 'Mar 1', icon: Zap, bg: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  { name: 'Internet', amount: 25000, due: 'Mar 3', icon: Wifi, bg: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  { name: 'Cable TV', amount: 8500, due: 'Mar 5', icon: Tv, bg: 'bg-[hsl(340,50%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]' },
  { name: 'Water Bill', amount: 6000, due: 'Mar 8', icon: Receipt, bg: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]' },
];

const utilityItems = [
  { label: 'Settings', icon: Settings, path: 'settings', color: 'bg-muted', iconColor: 'text-foreground' },
  { label: 'Alerts', icon: Bell, path: 'alerts', color: 'bg-muted', iconColor: 'text-foreground' },
  { label: 'Help', icon: HelpCircle, path: 'help', color: 'bg-muted', iconColor: 'text-foreground' },
];

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

const CustomerMore: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const tenant = useCustomerTenant();
  const { user } = useCustomerAuth();
  const isViewOnly = user?.isViewOnly ?? false;

  const go = (path: string) => navigate(`/app/${institutionId}/${path}`);
  const isFeatureVisible = (featureKey?: string) => !featureKey || tenant.features[featureKey as keyof typeof tenant.features] !== false;

  const enabledActions = allQuickActions.filter((a) => isFeatureVisible(a.featureKey));

  return (
    <div className="flex flex-col gap-6 p-5 pb-8">
      <h1 className="text-xl font-bold text-foreground">More</h1>

      {/* ─── Quick Actions ─── */}
      <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Quick Actions</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {enabledActions.slice(0, 6).map((action) => (
            <button key={action.key} onClick={() => go(action.key === 'qr_scan' ? 'scan' : action.key === 'cash_out' ? 'cash-out' : action.key)} className="flex flex-col items-center gap-2">
              <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${action.color}`}>
                <action.icon className={`h-6 w-6 ${action.iconColor}`} strokeWidth={1.5} />
                {isViewOnly && action.key !== 'bank' && (
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

      {/* ─── Media Banner ─── */}
      {tenant.mediaSections && tenant.mediaSections.length > 0 && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.03 }}>
          <MediaBanner items={tenant.mediaSections} cardSize="medium" />
        </motion.div>
      )}

      {/* ─── Upcoming Bills ─── */}
      {!isViewOnly && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.06 }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Upcoming Bills</p>
            <button onClick={() => go('bills')} className="flex items-center gap-0.5 text-xs font-semibold text-primary">
              View All <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {upcomingBills.map((bill, i) => (
              <div key={i} className={`flex min-w-[130px] flex-col items-center gap-2 rounded-3xl ${bill.bg} p-4`}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background/50">
                  <bill.icon className={`h-5 w-5 ${bill.iconColor}`} strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold text-foreground">{bill.name}</p>
                <p className="text-sm font-bold text-foreground">{bill.amount.toLocaleString()} <span className="text-[10px] font-medium text-muted-foreground">XAF</span></p>
                <p className="text-[10px] font-medium text-muted-foreground">Due {bill.due}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Account ─── */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.09 }}>
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
