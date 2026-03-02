import React, { useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { CustomerTenantProvider } from './CustomerTenantProvider';
import { CustomerBottomNav } from './CustomerBottomNav';
import { useOneSignal } from '@/hooks/useOneSignal';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useRealtimeBalanceSync } from '@/hooks/useRealtimeBalanceSync';
import { CustomerAppAuthGuard } from '@/components/auth/CustomerAppAuthGuard';
import { SessionGuard } from '@/components/auth/SessionGuard';

export const CustomerAppLayout: React.FC = () => {
  const basePath = '/app';
  const queryClient = useQueryClient();
  const { user } = useCustomerAuth();

  // Register user with OneSignal for push notifications (platform-level)
  useOneSignal(undefined);

  // Auto-refresh balances & transactions in realtime
  useRealtimeBalanceSync(user?.id);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 500));
  }, [queryClient]);

  return (
    <CustomerAppAuthGuard>
      <SessionGuard logoutPath="/app/auth" appName="Kang">
        <CustomerTenantProvider>
          <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background pwa-large-text">
            <PullToRefresh onRefresh={handleRefresh}>
              <div className="flex-1 pb-20">
                <Outlet />
              </div>
            </PullToRefresh>
            <CustomerBottomNav basePath={basePath} />
          </div>
        </CustomerTenantProvider>
      </SessionGuard>
    </CustomerAppAuthGuard>
  );
};
