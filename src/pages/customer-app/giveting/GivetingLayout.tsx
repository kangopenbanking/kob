import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Heart, Compass, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/app/giveting', label: 'Fundraise', icon: Heart, end: true },
  { to: '/app/giveting/discover', label: 'Discover', icon: Compass, end: false },
  { to: '/app/giveting/notifications', label: 'Alerts', icon: Bell, end: false },
  { to: '/app/giveting/profile', label: 'Profile', icon: User, end: false },
];

export const GivetingLayout: React.FC = () => {
  const location = useLocation();
  const hideNav =
    /\/app\/giveting\/(c|new|manage|donate|withdraw|updates)/.test(location.pathname);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {!hideNav && (
        <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto max-w-lg px-3 py-2.5">
            <nav
              role="tablist"
              aria-label="Giveting sections"
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-none"
            >
              {tabs.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  role="tab"
                  className={({ isActive }) =>
                    cn(
                      'group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition-all',
                      isActive
                        ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-card text-foreground/70 hover:border-primary/40 hover:text-foreground'
                    )
                  }
                >
                  <t.icon className="h-4 w-4" strokeWidth={2} />
                  <span>{t.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
};

export default GivetingLayout;
