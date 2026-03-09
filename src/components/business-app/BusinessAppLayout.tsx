import React, { useCallback, useState } from 'react';
import { Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { Home, ShoppingBag, Package, MoreHorizontal, Plus, ScanLine, Monitor, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionGuard } from '@/components/auth/SessionGuard';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

const QuickActionSheet: React.FC<{ open: boolean; onOpenChange: (o: boolean) => void; basePath: string }> = ({ open, onOpenChange, basePath }) => {
  const navigate = useNavigate();
  const actions = [
    { icon: ShoppingBag, label: 'New Order', subtitle: 'Create a manual order', path: `${basePath}/quick-order` },
    { icon: Package, label: 'Add Product', subtitle: 'Add to your catalog', path: `${basePath}/products/new` },
    { icon: ScanLine, label: 'Receive Payment', subtitle: 'QR code payment', path: `${basePath}/receive` },
    { icon: Monitor, label: 'Open Till', subtitle: 'Point of sale', path: `${basePath}/till` },
    { icon: Wallet, label: 'Wallet', subtitle: 'View balances', path: `${basePath}/wallet` },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[60vh]">
        <SheetHeader>
          <SheetTitle>Quick Actions</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-1">
          {actions.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                className="w-full flex items-center gap-3 rounded-xl p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => { onOpenChange(false); navigate(a.path); }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const BusinessBottomNav: React.FC<{ basePath: string }> = ({ basePath }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);

  const items = [
    { label: 'Home', icon: Home, path: `${basePath}/home` },
    { label: 'Orders', icon: ShoppingBag, path: `${basePath}/orders` },
    { label: 'Create', icon: Plus, path: '', isFab: true },
    { label: 'Products', icon: Package, path: `${basePath}/products` },
    { label: 'More', icon: MoreHorizontal, path: `${basePath}/more` },
  ];

  const isActive = (path: string) => path && (location.pathname === path || location.pathname.startsWith(path + '/'));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          {items.map((item) => {
            if (item.isFab) {
              return (
                <button
                  key="fab"
                  onClick={() => setShowActions(true)}
                  className="flex flex-col items-center justify-center gap-1 py-1.5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                    <Plus className="h-6 w-6" strokeWidth={2} />
                  </div>
                </button>
              );
            }
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
      <QuickActionSheet open={showActions} onOpenChange={setShowActions} basePath={basePath} />
    </>
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
