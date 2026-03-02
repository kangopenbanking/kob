import React, { useCallback } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { BottomNavigation } from '@/components/pwa/BottomNavigation';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeBalanceSync } from '@/hooks/useRealtimeBalanceSync';
import { useEffect, useState } from 'react';
import { BankingAppAuthGuard } from '@/components/auth/BankingAppAuthGuard';
import { SessionGuard } from '@/components/auth/SessionGuard';

export const BankingAppLayout: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const basePath = `/bank/${institutionId}`;
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  useRealtimeBalanceSync(userId, institutionId);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 500));
  }, [queryClient]);

  return (
    <BankingAppAuthGuard>
      <SessionGuard logoutPath={`/bank/${institutionId}/auth`} appName="Banking">
        <TenantProvider>
          <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background pwa-large-text" style={{ '--pwa-font-multiplier': 0.7 } as React.CSSProperties}>
            <PullToRefresh onRefresh={handleRefresh}>
              <div className="flex-1 pb-16">
                <Outlet />
              </div>
            </PullToRefresh>
            <BottomNavigation basePath={basePath} />
          </div>
        </TenantProvider>
      </SessionGuard>
    </BankingAppAuthGuard>
  );
};
