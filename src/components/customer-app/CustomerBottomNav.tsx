import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';
import { useBottomNavItems, DEFAULT_NAV_ITEMS } from '@/hooks/useBottomNavItems';
import { NavIcon } from '@/components/nav/NavIcon';

interface CustomerBottomNavProps {
  basePath: string;
}

export const CustomerBottomNav: React.FC<CustomerBottomNavProps> = ({ basePath }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const tr = useHarvestedT('customer');
  const { data } = useBottomNavItems('customer');
  const items = (data && data.length > 0 ? data : DEFAULT_NAV_ITEMS.customer)
    .filter((i) => i.is_enabled);

  // Honor admin-configured absolute paths (e.g. /app/budget) by rewriting basePath if needed
  const resolvePath = (p: string) => {
    if (p.startsWith('/')) return p.replace(/^\/app/, basePath);
    return `${basePath}/${p}`;
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-1">
        {items.map((item) => {
          const path = resolvePath(item.path);
          const active = isActive(path);
          const renderIcon = (extraClass = '') => (
            <NavIcon icon={item.icon} className={extraClass} />
          );

          if (item.is_center) {
            return (
              <button
                key={item.id}
                onClick={() => navigate(path)}
                aria-label={tr(item.label)}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg">
                  <Icon className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
                </div>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => navigate(path)}
              aria-label={tr(item.label)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-opacity',
                active ? 'opacity-100' : 'opacity-40'
              )}
            >
              <Icon className="h-6 w-6 text-foreground" strokeWidth={1.75} />
              <span className="text-[10px] font-medium text-foreground">{tr(item.label)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
