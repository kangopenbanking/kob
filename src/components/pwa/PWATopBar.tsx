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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-background/95 px-4 backdrop-blur-md border-b">
      <div className="flex items-center gap-3">
        {tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="h-10 w-10 rounded-2xl object-contain" />
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

      <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
        <Bell className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-[hsl(var(--bank-coral))]" />
      </button>
    </header>
  );
};
