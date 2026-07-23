import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Heart, Compass, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

// Each tab has its own accent HSL — used for the active-state background so
// the top nav feels colourful yet remains part of the design system.
const tabs = [
  { to: '/app/giveting',               label: 'Fundraise', icon: Heart,   hsl: '350 78% 52%', end: true  },
  { to: '/app/giveting/discover',      label: 'Discover',  icon: Compass, hsl: '198 82% 48%', end: false },
  { to: '/app/giveting/notifications', label: 'Alerts',    icon: Bell,    hsl: '32 88% 48%',  end: false },
  { to: '/app/giveting/profile',       label: 'Profile',   icon: User,    hsl: '160 62% 40%', end: false },
];

export const GivetingLayout: React.FC = () => {
  const location = useLocation();
  const hideNav =
    /\/app\/giveting\/(c|new|manage|donate|withdraw|updates)/.test(location.pathname);

  return (
    <div className="giveting-theme flex min-h-[calc(100vh-4rem)] flex-col">
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
                  style={{ ['--tab' as any]: t.hsl }}
                  className={({ isActive }) =>
                    cn(
                      'group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition-all',
                      isActive
                        ? 'border-transparent text-white shadow-sm bg-[hsl(var(--tab))]'
                        : 'border-border bg-card text-foreground/75 hover:border-[hsl(var(--tab))]/50 hover:text-[hsl(var(--tab))]'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <t.icon
                        className="h-4 w-4"
                        strokeWidth={2}
                        color={isActive ? 'currentColor' : `hsl(${t.hsl})`}
                      />
                      <span>{t.label}</span>
                    </>
                  )}
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
