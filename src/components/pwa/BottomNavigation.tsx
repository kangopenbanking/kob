import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowLeftRight, CreditCard, Clock, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface BottomNavigationProps {
  basePath: string;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ basePath }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const items: NavItem[] = [
    { label: 'Home', icon: Home, path: `${basePath}/home` },
    { label: 'Pay', icon: ArrowLeftRight, path: `${basePath}/payments` },
    { label: 'Cards', icon: CreditCard, path: `${basePath}/cards` },
    { label: 'History', icon: Clock, path: `${basePath}/history` },
    { label: 'More', icon: MoreHorizontal, path: `${basePath}/more` },
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-around px-2">
        {items.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
