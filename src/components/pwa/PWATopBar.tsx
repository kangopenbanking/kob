import React from 'react';
import { Bell, Building2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTenant } from './TenantProvider';
import { useNotifications } from '@/hooks/useNotifications';
import { useOneSignal } from '@/hooks/useOneSignal';
import { SafeImage } from "@/components/common/SafeImage";

interface PWATopBarProps {
  userName?: string;
}

export const PWATopBar: React.FC<PWATopBarProps> = ({ userName }) => {
  const tenant = useTenant();
  const navigate = useNavigate();
  const { institutionId } = useParams();
  const { unreadCount } = useNotifications(institutionId, true);

  // Register user with OneSignal for this institution
  useOneSignal(institutionId);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-background/95 px-4 backdrop-blur-md border-b">
      <div className="flex items-center gap-3">
        {tenant.logoUrl ? (
          <SafeImage src={tenant.logoUrl} alt={tenant.name} className="h-10 w-10 rounded-2xl object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary">
            <Building2 className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted-foreground">{getGreeting()}</span>
          <span className="text-base font-bold tracking-tight text-foreground">
            {userName || 'Welcome'}
          </span>
        </div>
      </div>

      <button
        onClick={() => navigate(`/bank/${institutionId}/more/alerts`)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-muted"
      >
        <Bell className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
};
