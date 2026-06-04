import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Download, Receipt, Building2, Users,
  Link2, Banknote, Gift, Settings, HelpCircle, Bell, QrCode, Wallet, Plus,
  Lock, ChevronRight, Loader2, Package, ShieldAlert, Globe, Heart, Star, Store, MessageCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useRecentBillPayments } from '@/hooks/useCustomerData';
import { format } from 'date-fns';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

const allQuickActions = [
  { key: 'transfer', label: 'Transfer', icon: Send, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]', featureKey: 'transfer' },
  { key: 'request', label: 'Request', icon: Download, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]', featureKey: 'request' },
  { key: 'qr_scan', label: 'Scan', icon: QrCode, color: 'bg-[hsl(255,50%,92%)]', iconColor: 'text-[hsl(255,50%,45%)]', featureKey: 'qr_scan' },
  { key: 'bills', label: 'Bills', icon: Receipt, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]', featureKey: 'bills' },
  { key: 'cash_out', label: 'Cash Out', icon: Wallet, color: 'bg-[hsl(340,50%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]', featureKey: 'cash_out' },
  { key: 'bank', label: 'Accounts', icon: Building2, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
  { key: 'marketplace', label: 'Marketplace', icon: Store, color: 'bg-[hsl(30,70%,90%)]', iconColor: 'text-[hsl(30,60%,40%)]' },
  { key: 'daily_needs', label: 'Daily Needs', icon: Store, color: 'bg-[hsl(160,60%,90%)]', iconColor: 'text-[hsl(160,50%,35%)]' },
  { key: 'driver_hub', label: 'Driver Hub', icon: Users, color: 'bg-[hsl(200,70%,92%)]', iconColor: 'text-[hsl(200,60%,40%)]' },
];

const utilityItems = [
  { label: 'Send Abroad', icon: Globe, path: 'send-money', color: 'bg-[hsl(200,70%,92%)]', iconColor: 'text-[hsl(200,60%,40%)]' },
  { label: 'Remittances', icon: Download, path: 'remittances', color: 'bg-[hsl(150,50%,90%)]', iconColor: 'text-[hsl(150,45%,35%)]' },
  { label: 'Loyalty', icon: Gift, path: 'loyalty', color: 'bg-[hsl(320,60%,92%)]', iconColor: 'text-[hsl(320,50%,45%)]' },
  { label: 'Wishlist', icon: Heart, path: 'wishlist', color: 'bg-[hsl(350,70%,92%)]', iconColor: 'text-[hsl(350,55%,45%)]' },
  { label: 'Reviews', icon: Star, path: 'reviews', color: 'bg-[hsl(45,80%,90%)]', iconColor: 'text-[hsl(45,70%,35%)]' },
  { label: 'My Orders', icon: Package, path: 'orders', color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
  { label: 'DDN Orders', icon: Package, path: 'daily-needs/orders', color: 'bg-[hsl(200,70%,92%)]', iconColor: 'text-[hsl(200,60%,40%)]' },
  { label: 'Disputes', icon: ShieldAlert, path: 'disputes', color: 'bg-[hsl(0,60%,92%)]', iconColor: 'text-[hsl(0,50%,45%)]' },
  { label: 'Support Chat', icon: HelpCircle, path: 'support', color: 'bg-[hsl(210,60%,92%)]', iconColor: 'text-[hsl(210,50%,45%)]' },
  { label: 'Settings', icon: Settings, path: 'settings', color: 'bg-muted', iconColor: 'text-foreground' },
  { label: 'Alerts', icon: Bell, path: 'alerts', color: 'bg-muted', iconColor: 'text-foreground' },
  { label: 'Help', icon: HelpCircle, path: 'help', color: 'bg-muted', iconColor: 'text-foreground' },
];

// Pre-register strings for the harvester (must be literal calls so the scanner picks them up).
const _harvest = (t: (s: string) => string) => [
  t('Transfer'), t('Request'), t('Scan'), t('Bills'), t('Cash Out'), t('Add'),
  t('Marketplace'), t('Daily Needs'), t('Driver Hub'),
  t('Send Abroad'), t('Remittances'), t('Loyalty'), t('Wishlist'),
  t('Reviews'), t('My Orders'), t('Disputes'), t('Support Chat'), t('Settings'),
  t('Alerts'), t('Help'), t('View All'), t('Done'),
];
void _harvest;

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

const CustomerMore: React.FC = () => {
  const tr = useHarvestedT('customer');
  const navigate = useNavigate();
  const tenant = useCustomerTenant();
  const { user } = useCustomerAuth();
  const isViewOnly = user?.isViewOnly ?? false;

  const { data: recentBills = [], isLoading: billsLoading } = useRecentBillPayments(user?.id);

  const go = (path: string) => navigate(`/app/${path}`);
  const isFeatureVisible = (featureKey?: string) => !featureKey || tenant.features[featureKey as keyof typeof tenant.features] !== false;
  const enabledActions = allQuickActions.filter((a) => isFeatureVisible(a.featureKey));

  return (
    <div className="flex flex-col gap-6 p-5 pb-8">
      <h1 className="text-xl font-bold text-foreground">{tr('More')}</h1>

      {/* Quick Actions */}
      <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Quick Actions')}</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {enabledActions.map((action) => (
            <button key={action.key} onClick={() => go(
              action.key === 'qr_scan' ? 'scan' :
              action.key === 'cash_out' ? 'cash-out' :
              action.key === 'bank' ? 'bank' :
              action.key === 'daily_needs' ? 'daily-needs' :
              action.key === 'driver_hub' ? 'driver' :
              action.key
            )} className="flex flex-col items-center gap-2">
              <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${action.color}`}>
                <action.icon className={`h-6 w-6 ${action.iconColor}`} strokeWidth={1.5} />
                {isViewOnly && action.key !== 'bank' && (
                  <div className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-muted-foreground/80">
                    <Lock className="h-2.5 w-2.5 text-background" strokeWidth={2.5} />
                  </div>
                )}
              </div>
              <span className="text-xs font-semibold text-foreground">{tr(action.label)}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Recent Bill Payments (Live) */}
      {!isViewOnly && (
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.06 }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Recent Bill Payments')}</p>
            <button onClick={() => go('bills')} className="flex items-center gap-0.5 text-xs font-semibold text-primary">
              {tr('View All')} <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          {billsLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : recentBills.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">{tr('No recent bill payments')}</p>
          ) : (
            <div className="space-y-2">
              {recentBills.slice(0, 4).map((bill: any) => (
                <div key={bill.id} className="flex items-center justify-between rounded-2xl bg-card p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{bill.transaction_information || 'Bill Payment'}</span>
                    <span className="text-xs text-muted-foreground">{bill.booking_datetime ? format(new Date(bill.booking_datetime), 'MMM d, yyyy') : ''}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{Math.abs(bill.amount || 0).toLocaleString()} {bill.currency}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Account */}
      <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.09 }}>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{tr('Account')}</p>
        <div className="space-y-2">
          {utilityItems.map((item) => (
            <button key={item.path} onClick={() => go(item.path)}
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.color}`}>
                <item.icon className={`h-5 w-5 ${item.iconColor}`} strokeWidth={1.5} />
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground">{tr(item.label)}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default CustomerMore;
