import React, { useCallback, useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import {
  Home, ShoppingBag, Package, MoreHorizontal, Plus, ScanLine,
  Monitor, Wallet, Zap, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SessionGuard } from '@/components/auth/SessionGuard';
import { TranslationHarvester } from '@/components/i18n/TranslationHarvester';
import { LanguagePrompt } from '@/components/i18n/LanguagePrompt';
import { loadAppNamespaces } from '@/lib/i18n/i18next';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { motion } from 'framer-motion';

const basePath = '/biz';

/* ── Quick-action bottom sheet ─────────────────────────────── */
const QuickActionSheet: React.FC<{
  open: boolean;
  onOpenChange: (o: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const actions = [
    { icon: ShoppingBag, label: 'New Order', subtitle: 'Create a manual order', path: `${basePath}/quick-order`, color: 'bg-emerald-500/10 text-emerald-600' },
    { icon: Package, label: 'Add Product', subtitle: 'Add to your catalog', path: `${basePath}/products/new`, color: 'bg-violet-500/10 text-violet-600' },
    { icon: ScanLine, label: 'Receive Payment', subtitle: 'QR code payment', path: `${basePath}/receive`, color: 'bg-sky-500/10 text-sky-600' },
    { icon: Monitor, label: 'Open Till', subtitle: 'Point of sale', path: `${basePath}/till`, color: 'bg-amber-500/10 text-amber-600' },
    { icon: Wallet, label: 'Wallet', subtitle: 'View balances', path: `${basePath}/wallet`, color: 'bg-rose-500/10 text-rose-600' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[2rem] border-t-0 px-5 pb-10">
        <SheetHeader className="pb-2">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />
          <SheetTitle className="text-lg font-semibold tracking-tight text-left">Quick Actions</SheetTitle>
        </SheetHeader>
        <div className="mt-2 grid grid-cols-1 gap-1">
          {actions.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.button
                key={a.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="flex items-center gap-4 rounded-2xl p-3.5 text-left transition-colors hover:bg-muted/60 active:scale-[0.98]"
                onClick={() => { onOpenChange(false); navigate(a.path); }}
              >
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', a.color)}>
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-foreground">{a.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.subtitle}</p>
                </div>
                <Zap className="h-3.5 w-3.5 text-muted-foreground/40" />
              </motion.button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

/* ── Bottom navigation ─────────────────────────────────────── */
const BusinessBottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);

  const items = [
    { label: 'Home', icon: Home, path: `${basePath}/home` },
    { label: 'Orders', icon: FileText, path: `${basePath}/orders` },
    { label: '', icon: Plus, path: '', isFab: true },
    { label: 'Products', icon: Package, path: `${basePath}/products` },
    { label: 'More', icon: MoreHorizontal, path: `${basePath}/more` },
  ];

  const isActive = (path: string) =>
    path && (location.pathname === path || location.pathname.startsWith(path + '/'));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t border-border/40">
        <div className="mx-auto flex h-[4.25rem] max-w-lg items-end justify-around px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {items.map((item) => {
            if (item.isFab) {
              return (
                <button
                  key="fab"
                  onClick={() => setShowActions(true)}
                  className="relative -top-3 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[1.1rem] bg-foreground text-background shadow-lg shadow-foreground/15 active:scale-95 transition-transform"
                >
                  <Plus className="h-6 w-6" strokeWidth={2.5} />
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
                  'flex flex-col items-center justify-center gap-0.5 px-3 py-1 transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
                  active && 'bg-foreground/8',
                )}>
                  <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active ? 2.2 : 1.6} />
                </div>
                <span className={cn('text-[10px] leading-tight', active ? 'font-bold' : 'font-medium')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      <QuickActionSheet open={showActions} onOpenChange={setShowActions} />
    </>
  );
};

/* ── Inner wrapper ─────────────────────────────────────────── */
const BusinessAppInner: React.FC = () => {
  const queryClient = useQueryClient();

  // Per-app namespace scoping: Business loads only general+auto+business bundles.
  useEffect(() => { void loadAppNamespaces('business'); }, []);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 500));
  }, [queryClient]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background pwa-large-text">
      <TranslationHarvester category="business" />
      <LanguagePrompt />
      <OfflineIndicator />
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex-1 pb-20">
          <Outlet />
        </div>
      </PullToRefresh>
      <BusinessBottomNav />
    </div>
  );
};

/* ── Layout root ───────────────────────────────────────────── */
export const BusinessAppLayout: React.FC = () => {
  return (
    <SessionGuard logoutPath="/biz/auth" appName="Business" appContext="biz">
      <TenantProvider>
        <BusinessAppInner />
      </TenantProvider>
    </SessionGuard>
  );
};
