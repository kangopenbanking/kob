import React, { useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { SessionGuard } from '@/components/auth/SessionGuard';
import { BusinessAppAuthGuard } from '@/components/auth/BusinessAppAuthGuard';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useMerchantRealtime } from '@/hooks/useMerchantRealtime';
import { BusinessMobileNav } from './BusinessMobileNav';
import { BusinessDesktopSidebar } from './BusinessDesktopSidebar';
import { BusinessTopBar } from './BusinessTopBar';
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

/* ── Inner wrapper ─────────────────────────────────────────── */
const UnifiedBusinessInner: React.FC = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { merchantId } = useMerchantContext();

  // Layout-level realtime: every page in /biz reacts live to orders, payments,
  // wallet, payouts, catalog, inventory, storefront, coupons, staff & disputes.
  useMerchantRealtime(merchantId);

  // Persistently swap manifest to business-specific PWA config
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const original = link?.getAttribute('href');
    if (link) link.setAttribute('href', '/manifest-biz.json');
    return () => { if (link && original) link.setAttribute('href', original); };
  }, []);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 500));
  }, [queryClient]);

  if (isMobile) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
        <OfflineIndicator />
        <BusinessTopBar />
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="flex-1 pb-20">
            <Outlet />
          </div>
        </PullToRefresh>
        <BusinessMobileNav />
      </div>
    );
  }

  // Desktop layout with sidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <BusinessDesktopSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/40 bg-background/80 backdrop-blur-xl px-4">
            <SidebarTrigger className="shrink-0" />
            <BusinessTopBar isDesktop />
          </header>
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

/* ── Layout root ───────────────────────────────────────────── */
export const UnifiedBusinessLayout: React.FC = () => {
  return (
    <SessionGuard logoutPath="/biz/auth" appName="Kang Business" appContext="biz">
      <BusinessAppAuthGuard>
        <TenantProvider>
          <UnifiedBusinessInner />
        </TenantProvider>
      </BusinessAppAuthGuard>
    </SessionGuard>
  );
};
