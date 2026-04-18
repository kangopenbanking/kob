import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowLeftRight, CreditCard, Clock, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from './TenantProvider';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  featureKey?: string;
}

interface BottomNavigationProps {
  basePath: string;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ basePath }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const tenant = useTenant();

  // Virtual Cards intentionally hidden from the Banking app navigation.
  const allItems: NavItem[] = [
    { label: 'Home', icon: Home, path: `${basePath}/home` },
    { label: 'Pay', icon: ArrowLeftRight, path: `${basePath}/payments` },
    { label: 'History', icon: Clock, path: `${basePath}/history` },
    { label: 'More', icon: MoreHorizontal, path: `${basePath}/more` },
  ];

  const items = allItems.filter((item) => {
    if (!item.featureKey) return true;
    return tenant.features[item.featureKey as keyof typeof tenant.features] !== false;
  });

  // Remove unused icon warning
  void CreditCard;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {items.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {active ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
              ) : (
                <Icon className="h-5 w-5" strokeWidth={1.5} />
              )}
              <span className={cn("text-[11px]", active ? "font-bold" : "font-medium")}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
