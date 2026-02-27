import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send, Download, Receipt, FileText, Building2, Users,
  Link2, Banknote, RefreshCw, Gift, PiggyBank, CircleDollarSign,
  Home, BarChart3, Settings, HelpCircle, Bell, ScanLine
} from 'lucide-react';
import { useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';

interface FeatureItem {
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
  featureKey?: string;
}

const features: FeatureItem[] = [
  { label: 'Transfer', icon: Send, path: 'transfer', color: 'bg-[hsl(210,80%,93%)]', featureKey: 'transfer' },
  { label: 'Request', icon: Download, path: 'request', color: 'bg-[hsl(150,40%,90%)]', featureKey: 'request' },
  { label: 'QR Scan', icon: ScanLine, path: 'scan', color: 'bg-[hsl(270,60%,92%)]', featureKey: 'qr_scan' },
  { label: 'Bills', icon: Receipt, path: 'bills', color: 'bg-[hsl(25,80%,92%)]', featureKey: 'bills' },
  { label: 'Invoices', icon: FileText, path: 'invoices', color: 'bg-[hsl(50,80%,90%)]', featureKey: 'invoices' },
  { label: 'Bank', icon: Building2, path: 'bank', color: 'bg-[hsl(210,80%,93%)]', featureKey: 'bank' },
  { label: 'Split Bills', icon: Users, path: 'split-bills', color: 'bg-[hsl(340,60%,92%)]', featureKey: 'split_bills' },
  { label: 'Pay Links', icon: Link2, path: 'pay-links', color: 'bg-[hsl(180,50%,90%)]', featureKey: 'pay_links' },
  { label: 'Cash Out', icon: Banknote, path: 'cash-out', color: 'bg-[hsl(150,40%,90%)]', featureKey: 'cash_out' },
  { label: 'Recurring', icon: RefreshCw, path: 'recurring', color: 'bg-[hsl(25,80%,92%)]', featureKey: 'recurring' },
  { label: 'Rewards', icon: Gift, path: 'rewards', color: 'bg-[hsl(50,80%,90%)]', featureKey: 'rewards' },
  { label: 'Piggy Bank', icon: PiggyBank, path: 'piggybank', color: 'bg-[hsl(340,60%,92%)]', featureKey: 'piggy_bank' },
  { label: 'Njangi', icon: CircleDollarSign, path: 'njangi', color: 'bg-[hsl(270,60%,92%)]', featureKey: 'njangi' },
  { label: 'Rent Report', icon: Home, path: 'rent-reporting', color: 'bg-[hsl(210,80%,93%)]', featureKey: 'rent_reporting' },
  { label: 'Credit Score', icon: BarChart3, path: 'credit', color: 'bg-[hsl(150,40%,90%)]', featureKey: 'credit_score' },
];

const utilityItems: FeatureItem[] = [
  { label: 'Settings', icon: Settings, path: 'settings', color: 'bg-muted' },
  { label: 'Alerts', icon: Bell, path: 'alerts', color: 'bg-muted' },
  { label: 'Help', icon: HelpCircle, path: 'help', color: 'bg-muted' },
];

const CustomerMore: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const tenant = useCustomerTenant();

  const visibleFeatures = features.filter((f) => {
    if (!f.featureKey) return true;
    return tenant.features[f.featureKey as keyof typeof tenant.features] !== false;
  });

  return (
    <div className="flex flex-col gap-6 p-5">
      <h1 className="text-xl font-bold text-foreground">More</h1>

      {/* Features Grid */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Financial Services
        </p>
        <div className="grid grid-cols-4 gap-3">
          {visibleFeatures.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(`/app/${institutionId}/${item.path}`)}
              className="flex flex-col items-center gap-2 py-2"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
                <item.icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
              </div>
              <span className="text-[10px] font-semibold text-foreground text-center leading-tight">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Utility Items */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Account
        </p>
        <div className="space-y-2">
          {utilityItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(`/app/${institutionId}/${item.path}`)}
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.color}`}>
                <item.icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-semibold text-foreground">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CustomerMore;
