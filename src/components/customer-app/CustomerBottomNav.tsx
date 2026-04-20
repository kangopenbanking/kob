import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import homeIcon from '@/assets/nav-icons/home.png';
import activitiesIcon from '@/assets/nav-icons/activities.png';
import cardIcon from '@/assets/nav-icons/card.png';
import moreIcon from '@/assets/nav-icons/more.png';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

interface NavItem {
  label: string;
  iconSrc?: string;
  isCenter?: boolean;
  path: string;
}

interface CustomerBottomNavProps {
  basePath: string;
}

export const CustomerBottomNav: React.FC<CustomerBottomNavProps> = ({ basePath }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const tr = useHarvestedT('customer');

  const items: NavItem[] = [
    { label: tr('Home'), iconSrc: homeIcon, path: `${basePath}/home` },
    { label: tr('Activity'), iconSrc: activitiesIcon, path: `${basePath}/activity` },
    { label: tr('Scan'), isCenter: true, path: `${basePath}/scan` },
    { label: tr('Accounts'), iconSrc: cardIcon, path: `${basePath}/linked-accounts` },
    { label: tr('More'), iconSrc: moreIcon, path: `${basePath}/more` },
  ];

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {items.map((item) => {
          const active = isActive(item.path);

          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg">
                  <ScanLine className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
                </div>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 transition-opacity',
                active ? 'opacity-100' : 'opacity-40'
              )}
            >
              <img
                src={item.iconSrc}
                alt={item.label}
                className="h-6 w-6"
              />
              <span className="text-[10px] font-medium text-foreground">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
