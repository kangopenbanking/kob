import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Send, Smartphone, QrCode, FileText, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useBeneficiaries } from '@/hooks/useBankingData';

const quickSendColors = [
  'bg-[hsl(var(--bank-mint))]',
  'bg-[hsl(var(--bank-sky))]',
  'bg-[hsl(var(--bank-rose))]',
  'bg-[hsl(var(--bank-violet))]',
  'bg-[hsl(var(--bank-amber))]',
];

const BankPayments: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const { data: beneficiaries } = useBeneficiaries();

  const paymentOptions = [
    { icon: Send, label: 'Send Money', description: 'Transfer to bank or mobile', path: 'send', color: 'bg-[hsl(var(--bank-violet))]' },
    { icon: Smartphone, label: 'Mobile Money', description: 'MTN MoMo, Orange Money', path: 'mobile-money', color: 'bg-[hsl(var(--bank-amber))]' },
    { icon: QrCode, label: 'QR Pay', description: 'Scan or generate QR code', path: 'qr', color: 'bg-[hsl(var(--bank-teal))]' },
    { icon: FileText, label: 'Pay Bills', description: 'Electricity, water, internet', path: 'bills', color: 'bg-[hsl(var(--bank-coral))]' },
  ];

  const contacts = (beneficiaries || []).slice(0, 4).map((b, i) => ({
    name: b.beneficiary_name,
    initials: b.beneficiary_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    color: quickSendColors[i % quickSendColors.length],
  }));

  // Fallback if no beneficiaries
  const displayContacts = contacts.length > 0 ? contacts : [
    { name: 'Jean M.', initials: 'JM', color: quickSendColors[0] },
    { name: 'Marie K.', initials: 'MK', color: quickSendColors[1] },
    { name: 'Paul A.', initials: 'PA', color: quickSendColors[2] },
    { name: 'Aisha B.', initials: 'AB', color: quickSendColors[3] },
  ];

  return (
    <div className="flex flex-col px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">Payments</h1>
      <p className="mb-6 text-sm font-medium text-muted-foreground">Send, receive, and pay bills</p>

      {/* Recent Contacts */}
      <div className="mb-6">
        <h3 className="mb-3 text-base font-bold text-foreground">Quick Send</h3>
        <div className="flex gap-4">
          {displayContacts.map((contact) => (
            <button key={contact.name} className="flex flex-col items-center gap-1.5">
              <div className={`flex h-14 w-14 items-center justify-center rounded-full ${contact.color}`}>
                <span className="text-sm font-bold text-white">{contact.initials}</span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{contact.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Options */}
      <div className="flex flex-col gap-3">
        {paymentOptions.map((option, i) => {
          const Icon = option.icon;
          return (
            <motion.button
              key={option.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => option.path && navigate(`/bank/${institutionId}/payments/${option.path}`)}
              className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-colors"
            >
              <div className={`flex h-13 w-13 items-center justify-center rounded-2xl ${option.color}`}>
                <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-foreground">{option.label}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default BankPayments;
