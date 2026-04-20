import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, ArrowUpRight, ShieldAlert, Gift, Info, CheckCheck, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

type AlertType = 'transaction' | 'security' | 'promotion' | 'system';

const filters: { label: string; value: AlertType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Transactions', value: 'transaction' },
  { label: 'Security', value: 'security' },
  { label: 'Promotions', value: 'promotion' },
];

const typeMap: Record<string, AlertType> = {
  success: 'transaction',
  info: 'transaction',
  warning: 'security',
  security: 'security',
  promotion: 'promotion',
  system: 'system',
};

const alertIcon: Record<AlertType, React.ReactNode> = {
  transaction: <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} />,
  security: <ShieldAlert className="h-5 w-5" strokeWidth={1.5} />,
  promotion: <Gift className="h-5 w-5" strokeWidth={1.5} />,
  system: <Info className="h-5 w-5" strokeWidth={1.5} />,
};

const alertColor: Record<AlertType, string> = {
  transaction: 'hsl(160,60%,88%)',
  security: 'hsl(0,70%,90%)',
  promotion: 'hsl(45,90%,88%)',
  system: 'hsl(210,80%,90%)',
};

const CustomerAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications(undefined, false, true);
  const [filter, setFilter] = useState<AlertType | 'all'>('all');

  const mapped = notifications.map(n => ({
    ...n,
    alertType: typeMap[n.type] || ('system' as AlertType),
  }));

  const filtered = filter === 'all' ? mapped : mapped.filter(a => a.alertType === filter);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    toast.success('All marked as read');
  };

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Alerts</h1>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-xs font-medium text-primary">
            <CheckCheck className="h-4 w-4" strokeWidth={1.5} /> Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {filters.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === f.value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading alerts...</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <Bell className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-muted-foreground">
                {filter === 'all' ? 'No alerts yet' : 'No alerts in this category'}
              </p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(alert => (
                <motion.button key={alert.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  onClick={() => markAsRead(alert.id)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    alert.is_read ? 'border-border bg-card' : 'border-primary/30 bg-primary/5'
                  }`}>
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: alertColor[alert.alertType] }}>
                    {alertIcon[alert.alertType]}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                      {!alert.is_read && <Circle className="h-2 w-2 fill-primary text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                    <span className="mt-1 text-[11px] text-muted-foreground/60">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default CustomerAlerts;
