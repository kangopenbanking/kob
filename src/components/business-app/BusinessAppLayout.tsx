import React, { useCallback } from 'react';
import { Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { Home, ScanLine, Wallet, Monitor, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionGuard } from '@/components/auth/SessionGuard';

const BusinessBottomNav: React.FC<{ basePath: string }> = ({ basePath }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const items = [
    { label: 'Home', icon: Home, path: `${basePath}/home` },
    { label: 'Wallet', icon: Wallet, path: `${basePath}/wallet` },
    { label: 'Scan', icon: ScanLine, path: `${basePath}/receive` },
    { label: 'Orders', icon: ShoppingBag, path: `${basePath}/orders` },
    { label: 'More', icon: MoreHorizontal, path: `${basePath}/more` },
  ];

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

const BusinessAppInner: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const basePath = merchantId ? `/biz/${merchantId}` : '/biz';
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 500));
  }, [queryClient]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background pwa-large-text">
      <OfflineIndicator />
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex-1 pb-16">
          <Outlet />
        </div>
      </PullToRefresh>
      <BusinessBottomNav basePath={basePath} />
    </div>
  );
};

export const BusinessAppLayout: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const basePath = merchantId ? `/biz/${merchantId}` : '/biz';

  return (
    <SessionGuard logoutPath={`${basePath}/auth`} appName="Business" appContext={merchantId ? `biz:${merchantId}` : 'biz'}>
      <TenantProvider>
        <BusinessAppInner />
      </TenantProvider>
    </SessionGuard>
  );
};
