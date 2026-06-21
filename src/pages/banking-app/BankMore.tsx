import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PiggyBank, Landmark, BarChart3, Settings, Bell, Shield, HelpCircle, LogOut, ChevronRight, Wallet, Store, MessageCircle, HandCoins } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/components/pwa/TenantProvider';

const BankMore: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const { features } = useTenant();

  const allFinancialItems = [
    { icon: Wallet, label: 'Fund Account', description: 'Add money to account', path: 'fund', color: 'bg-[hsl(var(--bank-sky))]', iconColor: 'text-white', featureKey: undefined as any },
    { icon: PiggyBank, label: 'Savings', description: 'Goals & deposits', path: 'more/savings', color: 'bg-[hsl(var(--bank-lime))]', iconColor: 'text-[hsl(var(--bank-lime-fg))]', featureKey: 'savings' as const },
    { icon: Landmark, label: 'Loans', description: 'Apply & manage', path: 'more/loans', color: 'bg-[hsl(var(--bank-coral))]', iconColor: 'text-white', featureKey: 'loans' as const },
    { icon: Landmark, label: 'Loans', description: 'Apply & manage', path: 'more/loans', color: 'bg-[hsl(var(--bank-coral))]', iconColor: 'text-white', featureKey: 'loans' as const },
    { icon: HandCoins, label: 'Promise to Pay', description: 'Schedule a repayment promise', path: 'more/loans/promise', color: 'bg-[hsl(var(--bank-violet))]', iconColor: 'text-white', featureKey: 'loans' as const },
    { icon: BarChart3, label: 'Credit Score', description: 'CrediQ rating', path: 'more/credit', color: 'bg-[hsl(var(--bank-amber))]', iconColor: 'text-[hsl(var(--bank-amber-fg))]', featureKey: 'credit_score' as const },
  ];

  const financialItems = allFinancialItems.filter(item => features[item.featureKey] !== false);

  const accountItems = [
    { icon: Shield, label: 'KYC Status', description: 'Verification', path: 'kyc', color: 'bg-[hsl(var(--bank-teal))]', iconColor: 'text-white' },
    { icon: Bell, label: 'Notifications', description: 'Alerts & updates', path: 'more/alerts', color: 'bg-[hsl(var(--bank-amber))]', iconColor: 'text-[hsl(var(--bank-amber-fg))]' },
    { icon: MessageCircle, label: 'Live Chat', description: 'Chat with support', path: 'more/support', color: 'bg-[hsl(var(--bank-coral))]', iconColor: 'text-white' },
    { icon: Settings, label: 'Settings', description: 'Account & security', path: 'more/settings', color: 'bg-[hsl(var(--bank-sky))]', iconColor: 'text-white' },
    { icon: HelpCircle, label: 'Help & Support', description: 'FAQs & contact', path: 'more/help', color: 'bg-[hsl(var(--bank-lime))]', iconColor: 'text-[hsl(var(--bank-lime-fg))]' },
  ];

  const crossAppItems = [
    { icon: Store, label: 'Business App', description: 'Manage your business', path: '/biz', color: 'bg-[hsl(var(--bank-coral))]', iconColor: 'text-white', external: true },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(`/bank/${institutionId}/auth`, { replace: true });
  };

  const renderItem = (item: typeof accountItems[0] & { external?: boolean }, i: number) => {
    const Icon = item.icon;
    return (
      <motion.button
        key={item.label}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          if ((item as any).external) {
            navigate(item.path);
          } else {
            navigate(`/bank/${institutionId}/${item.path}`);
          }
        }}
        className="flex items-center gap-4 rounded-2xl px-3 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color}`}>
          <Icon className={`h-6 w-6 ${item.iconColor}`} strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-foreground">{item.label}</p>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
      </motion.button>
    );
  };

  return (
    <div className="flex flex-col px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">More</h1>
      <p className="mb-6 text-sm font-medium text-muted-foreground">Account services & settings</p>

      {/* Financial Services */}
      {financialItems.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Financial Services</h3>
          <div className="flex flex-col gap-1">
            {financialItems.map((item, i) => renderItem(item, i))}
          </div>
        </div>
      )}

      {/* Account & Settings */}
      <div className="mb-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Account</h3>
        <div className="flex flex-col gap-1">
          {accountItems.map((item, i) => renderItem(item, i + financialItems.length))}
        </div>
      </div>

      {/* Cross-App Navigation */}
      <div className="mb-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Other Apps</h3>
        <div className="flex flex-col gap-1">
          {crossAppItems.map((item, i) => renderItem(item, i + financialItems.length + accountItems.length))}
        </div>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={handleLogout}
        className="flex items-center gap-4 rounded-2xl px-3 py-3.5 text-left text-destructive transition-colors hover:bg-destructive/5"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
          <LogOut className="h-6 w-6 text-destructive" strokeWidth={1.5} />
        </div>
        <p className="text-base font-bold">Sign Out</p>
      </motion.button>
    </div>
  );
};

export default BankMore;
