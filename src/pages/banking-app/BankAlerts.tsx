import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertCircle, Info, Bell, RefreshCw, CheckCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';

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
  const { institutionId } = useParams();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications(institutionId);

  const formatTime = (time: string) => {
    try {
      return formatDistanceToNow(new Date(time), { addSuffix: true });
    } catch {
      return time;
    }
  };

  return (
    <div className="flex min-h-screen flex-col px-4 py-6">
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
      <p className="mb-6 text-sm text-muted-foreground">
        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      </p>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" strokeWidth={1} />
          <p className="text-sm font-medium text-foreground">No notifications yet</p>
          <p className="text-xs text-muted-foreground mt-1">Your transaction alerts and updates will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((alert, i) => {
            const alertType = (alert.type as keyof typeof iconMap) || 'info';
            const Icon = iconMap[alertType] || Info;
            const colors = colorMap[alertType] || colorMap.info;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                  alert.is_read ? 'bg-card' : 'bg-primary/5 border-primary/20'
                }`}
                onClick={() => !alert.is_read && markAsRead(alert.id)}
              >
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colors}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{alert.title}</p>
                    {!alert.is_read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/60">{formatTime(alert.created_at)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BankAlerts;
