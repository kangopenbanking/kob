import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Droplets, Wifi, Tv } from 'lucide-react';
import { motion } from 'framer-motion';

const billCategories = [
  { icon: Zap, label: 'Electricity', description: 'ENEO, AES-SONEL', path: '' },
  { icon: Droplets, label: 'Water', description: 'CDE, Camwater', path: '' },
  { icon: Wifi, label: 'Internet', description: 'Camtel, MTN, Orange', path: '' },
  { icon: Tv, label: 'TV & Cable', description: 'Canal+, DStv', path: '' },
];

const BankBills: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Pay Bills</h1>
      <p className="mb-6 text-sm text-muted-foreground">Electricity, water, internet & more</p>

      <div className="flex flex-col gap-3">
        {billCategories.map((cat, i) => {
          const Icon = cat.icon;
          return (
            <motion.button
              key={cat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-colors"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{cat.label}</p>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Bill payment integration coming soon
      </p>
    </div>
  );
};

export default BankBills;