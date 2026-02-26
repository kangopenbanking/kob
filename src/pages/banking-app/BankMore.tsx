import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PiggyBank, Landmark, BarChart3, Settings, Bell, Shield, HelpCircle, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

const BankMore: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();

  const menuItems = [
    { icon: PiggyBank, label: 'Savings', description: 'Goals & deposits', path: 'more/savings' },
    { icon: Landmark, label: 'Loans', description: 'Apply & manage', path: 'more/loans' },
    { icon: BarChart3, label: 'Credit Score', description: 'CrediQ rating', path: 'more/credit' },
    { icon: Shield, label: 'KYC Status', description: 'Verification', path: 'kyc' },
    { icon: Bell, label: 'Notifications', description: 'Alerts & updates', path: 'more/alerts' },
    { icon: Settings, label: 'Settings', description: 'Account & security', path: 'more/settings' },
    { icon: HelpCircle, label: 'Help & Support', description: 'FAQs & contact', path: 'more/help' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(`/bank/${institutionId}`);
  };

  return (
    <div className="flex flex-col px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">More</h1>
      <p className="mb-6 text-sm text-muted-foreground">Account services & settings</p>

      <div className="flex flex-col gap-2">
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => item.path && navigate(`/bank/${institutionId}/${item.path}`)}
              className="flex items-center gap-4 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </motion.button>
          );
        })}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={handleLogout}
          className="mt-4 flex items-center gap-4 rounded-xl px-3 py-3.5 text-left text-destructive transition-colors hover:bg-destructive/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
            <LogOut className="h-5 w-5 text-destructive" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium">Sign Out</p>
        </motion.button>
      </div>
    </div>
  );
};

export default BankMore;
