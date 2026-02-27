import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Clock, ScanLine, CreditCard, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  isCenter?: boolean;
}

interface CustomerBottomNavProps {
  basePath: string;
}

export const CustomerBottomNav: React.FC<CustomerBottomNavProps> = ({ basePath }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const items: NavItem[] = [
    { label: 'Home', icon: Home, path: `${basePath}/home` },
    { label: 'Activity', icon: Clock, path: `${basePath}/activity` },
    { label: 'Scan', icon: ScanLine, path: `${basePath}/scan`, isCenter: true },
    { label: 'Cards', icon: CreditCard, path: `${basePath}/cards` },
    { label: 'More', icon: MoreHorizontal, path: `${basePath}/more` },
  ];

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {items.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center gap-1 -mt-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg">
                  <Icon className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
                </div>
                <span className="text-[10px] font-bold text-primary">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2 : 1.5}
              />
              <span className={cn('text-[11px]', active ? 'font-bold' : 'font-medium')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
