import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, Smartphone, QrCode, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

const BankPayments: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();

  const paymentOptions = [
    { icon: Send, label: 'Send Money', description: 'Transfer to bank or mobile', path: 'send' },
    { icon: Smartphone, label: 'Mobile Money', description: 'MTN MoMo, Orange Money', path: '' },
    { icon: QrCode, label: 'QR Pay', description: 'Scan or generate QR code', path: 'qr' },
    { icon: FileText, label: 'Pay Bills', description: 'Electricity, water, internet', path: '' },
  ];

  return (
    <div className="flex flex-col px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Payments</h1>
      <p className="mb-6 text-sm text-muted-foreground">Send, receive, and pay bills</p>

      <div className="flex flex-col gap-3">
        {paymentOptions.map((option, i) => {
          const Icon = option.icon;
          return (
            <motion.button
              key={option.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => option.path && navigate(`/bank/${institutionId}/payments/${option.path}`)}
              className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-colors"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default BankPayments;
