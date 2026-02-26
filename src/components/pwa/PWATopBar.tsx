import React from 'react';
import { Bell, Building2 } from 'lucide-react';
import { useTenant } from './TenantProvider';

interface PWATopBarProps {
  userName?: string;
}

export const PWATopBar: React.FC<PWATopBarProps> = ({ userName }) => {
  const tenant = useTenant();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-background/95 px-4 backdrop-blur-sm border-b">
      <div className="flex items-center gap-3">
        {tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded-lg object-contain" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{getGreeting()}</span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {userName || 'Welcome'}
          </span>
        </div>
      </div>

      <button className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted">
        <Bell className="h-4 w-4 text-foreground" strokeWidth={1.5} />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive" />
      </button>
    </header>
  );
};
