import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Heart, Compass, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/app/giveting', label: 'Fundraise', icon: Heart, end: true },
  { to: '/app/giveting/discover', label: 'Discover', icon: Compass, end: false },
  { to: '/app/giveting/notifications', label: 'Notifications', icon: Bell, end: false },
  { to: '/app/giveting/profile', label: 'Profile', icon: User, end: false },
];

export const GivetingLayout: React.FC = () => {
  const location = useLocation();
  // Hide sub-nav on nested detail/manage/donate routes
  const hideNav =
    /\/app\/giveting\/(c|new|manage|donate|withdraw|updates)/.test(location.pathname);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="flex-1 pb-24">
        <Outlet />
      </div>
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-16 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex max-w-lg items-center justify-around px-2">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-opacity',
                    isActive ? 'text-foreground opacity-100' : 'text-muted-foreground opacity-70 hover:opacity-100'
                  )
                }
              >
                <t.icon className="h-5 w-5" strokeWidth={1.8} />
                <span className="font-medium">{t.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};

export default GivetingLayout;
