import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';

const mockAlerts = [
  { id: '1', type: 'success', title: 'Transfer Complete', message: 'XAF 15,000 sent to MTN MoMo', time: '2 min ago' },
  { id: '2', type: 'info', title: 'KYC Approved', message: 'Your identity verification is complete', time: '1 hour ago' },
  { id: '3', type: 'warning', title: 'Low Balance', message: 'Main account balance below XAF 50,000', time: '3 hours ago' },
  { id: '4', type: 'success', title: 'Salary Received', message: 'XAF 450,000 credited to your account', time: 'Yesterday' },
];

const iconMap = {
  success: CheckCircle2,
  info: Info,
  warning: AlertCircle,
};

const colorMap = {
  success: 'bg-primary/10 text-primary',
  info: 'bg-secondary/10 text-secondary',
  warning: 'bg-destructive/10 text-destructive',
};

const BankAlerts: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Back
      </button>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Notifications</h1>
      <p className="mb-6 text-sm text-muted-foreground">Alerts & updates</p>

      <div className="flex flex-col gap-2">
        {mockAlerts.map((alert, i) => {
          const Icon = iconMap[alert.type as keyof typeof iconMap];
          const colors = colorMap[alert.type as keyof typeof colorMap];
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 rounded-xl border bg-card p-4"
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors}`}>
                <Icon className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{alert.title}</p>
                <p className="text-xs text-muted-foreground">{alert.message}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/60">{alert.time}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default BankAlerts;