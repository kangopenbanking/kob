import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Bell, Globe, Moon, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const settingsItems = [
  { icon: User, label: 'Personal Information', description: 'Name, email, phone' },
  { icon: Lock, label: 'Security', description: 'Password, PIN, biometrics' },
  { icon: Bell, label: 'Notification Preferences', description: 'Push, email, SMS' },
  { icon: Globe, label: 'Language & Region', description: 'English, XAF' },
  { icon: Moon, label: 'Appearance', description: 'Light / Dark mode' },
];

const BankSettings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Settings</h1>
      <p className="mb-6 text-sm text-muted-foreground">Account & security preferences</p>

      <div className="flex flex-col gap-1">
        {settingsItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default BankSettings;