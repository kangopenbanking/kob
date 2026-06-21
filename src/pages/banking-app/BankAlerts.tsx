import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, Info, Bell, RefreshCw, CheckCheck, Wallet, ArrowUpDown, ShieldCheck, Smartphone, Landmark, Filter, HandCoins } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';

type FilterType = 'all' | 'success' | 'info' | 'warning' | 'ptp';

const typeIconMap: Record<string, React.ElementType> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertCircle,
};

const categoryIconMap: Record<string, React.ElementType> = {
  balance: Wallet,
  transaction: ArrowUpDown,
  kyc: ShieldCheck,
  mobile_money: Smartphone,
  bank_transfer: Landmark,
  loan: HandCoins,
  payment: ArrowUpDown,
  default: Bell,
};

const colorMap: Record<string, string> = {
  success: 'bg-primary/10 text-primary',
  info: 'bg-secondary/10 text-secondary-foreground',
  warning: 'bg-destructive/10 text-destructive',
};

const PTP_EVENTS = new Set(['created', 'partial', 'rescheduled', 'kept', 'broken', 'swept']);

const filterOptions: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ptp', label: 'Promises' },
  { key: 'success', label: 'Success' },
  { key: 'info', label: 'Updates' },
  { key: 'warning', label: 'Alerts' },
];

const BankAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { institutionId } = useParams();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications(institutionId, true);
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredNotifications = filter === 'all'
    ? notifications
    : filter === 'ptp'
      ? notifications.filter(n => (n as any)?.metadata?.ptp_event || PTP_EVENTS.has(String((n as any)?.metadata?.ptp_event)) || n.icon === 'loan')
      : notifications.filter(n => n.type === filter);

  const formatTime = (time: string) => {
    try {
      return formatDistanceToNow(new Date(time), { addSuffix: true });
    } catch {
      return time;
    }
  };

  const getIcon = (alert: { type: string; icon: string }) => {
    const CatIcon = categoryIconMap[alert.icon] || categoryIconMap.default;
    return CatIcon;
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Back
        </button>
        <div className="flex gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">Notifications</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      </p>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {filterOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === opt.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" strokeWidth={1} />
          <p className="text-sm font-medium text-foreground">
            {filter === 'all' ? 'No notifications yet' : `No ${filterOptions.find(f => f.key === filter)?.label.toLowerCase()} notifications`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Your transaction alerts and updates will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map((alert, i) => {
              const alertType = (alert.type as keyof typeof colorMap) || 'info';
              const Icon = getIcon(alert);
              const colors = colorMap[alertType] || colorMap.info;
              return (
                <motion.div
                  key={alert.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  className={`flex items-start gap-3 rounded-xl border p-4 transition-colors cursor-pointer ${
                    alert.is_read ? 'bg-card' : 'bg-primary/5 border-primary/20'
                  }`}
                  onClick={() => !alert.is_read && markAsRead(alert.id)}
                >
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colors}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                      {!alert.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground/60">{formatTime(alert.created_at)}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default BankAlerts;
