import React, { useCallback } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { BottomNavigation } from '@/components/pwa/BottomNavigation';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';

export const BankingAppLayout: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const basePath = `/bank/${institutionId}`;
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 500));
  }, [queryClient]);

  return (
    <TenantProvider>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="flex-1 pb-16">
            <Outlet />
          </div>
        </PullToRefresh>
        <BottomNavigation basePath={basePath} />
      </div>
    </TenantProvider>
  );
};
