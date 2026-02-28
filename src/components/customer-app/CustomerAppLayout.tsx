import React, { useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { CustomerTenantProvider } from './CustomerTenantProvider';
import { CustomerBottomNav } from './CustomerBottomNav';
import { useOneSignal } from '@/hooks/useOneSignal';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';

export const CustomerAppLayout: React.FC = () => {
  const basePath = '/app';
  const queryClient = useQueryClient();

  // Register user with OneSignal for push notifications (platform-level)
  useOneSignal(undefined);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 500));
  }, [queryClient]);

  return (
    <CustomerTenantProvider>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="flex-1 pb-20">
            <Outlet />
          </div>
        </PullToRefresh>
        <CustomerBottomNav basePath={basePath} />
      </div>
    </CustomerTenantProvider>
  );
};
