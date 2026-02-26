import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Phone, Mail, FileText, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const helpItems = [
  { icon: FileText, label: 'FAQs', description: 'Frequently asked questions' },
  { icon: MessageCircle, label: 'Live Chat', description: 'Chat with support' },
  { icon: Phone, label: 'Call Us', description: '+237 233 XXX XXX' },
  { icon: Mail, label: 'Email Support', description: 'support@kangbank.com' },
];

const BankHelp: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Help & Support</h1>
      <p className="mb-6 text-sm text-muted-foreground">How can we help you?</p>

      <div className="flex flex-col gap-2">
        {helpItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between rounded-xl border bg-card p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
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

export default BankHelp;