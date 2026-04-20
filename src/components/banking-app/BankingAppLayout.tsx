import React, { useCallback } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { TenantProvider, useTenant } from '@/components/pwa/TenantProvider';
import { BottomNavigation } from '@/components/pwa/BottomNavigation';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeBalanceSync } from '@/hooks/useRealtimeBalanceSync';
import { useEffect, useState } from 'react';
import { BankingAppAuthGuard } from '@/components/auth/BankingAppAuthGuard';
import { SessionGuard } from '@/components/auth/SessionGuard';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { useAppCacheClear } from '@/hooks/useAppCacheClear';
import { HealthBanner } from '@/components/HealthBanner';
import { useBankingWebhookEvents } from '@/hooks/useBankingWebhookEvents';
import { TranslationHarvester } from '@/components/i18n/TranslationHarvester';

const BankingAppInner: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const basePath = `/bank/${institutionId}`;
  const queryClient = useQueryClient();
  const tenant = useTenant();
  useAppCacheClear();

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 500));
  }, [queryClient]);

  return (
    <div
      className="mx-auto flex min-h-screen max-w-lg flex-col bg-background pwa-large-text"
      style={{ '--pwa-font-multiplier': tenant.fontSizeMultiplier } as React.CSSProperties}
    >
      <HealthBanner />
      <OfflineIndicator />
      <TranslationHarvester category="banking" />
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex-1 pb-16">
          <Outlet />
        </div>
      </PullToRefresh>
      <BottomNavigation basePath={basePath} />
    </div>
  );
};

export const BankingAppLayout: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  useRealtimeBalanceSync(userId, institutionId);
  useBankingWebhookEvents(institutionId);

  return (
    <BankingAppAuthGuard>
      <SessionGuard logoutPath={`/bank/${institutionId}/auth`} appName="Banking" appContext={`banking:${institutionId}`}>
        <TenantProvider>
          <BankingAppInner />
        </TenantProvider>
      </SessionGuard>
    </BankingAppAuthGuard>
  );
};
