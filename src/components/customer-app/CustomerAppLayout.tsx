import React, { useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { CustomerTenantProvider, useCustomerTenant } from './CustomerTenantProvider';
import { CustomerBottomNav } from './CustomerBottomNav';
import { useOneSignal } from '@/hooks/useOneSignal';
import { PullToRefresh } from '@/components/pwa/PullToRefresh';
import { useQueryClient } from '@tanstack/react-query';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useRealtimeBalanceSync } from '@/hooks/useRealtimeBalanceSync';
import { CustomerAppAuthGuard } from '@/components/auth/CustomerAppAuthGuard';
import { SessionGuard } from '@/components/auth/SessionGuard';
import { useAppCacheClear } from '@/hooks/useAppCacheClear';
import { HealthBanner } from '@/components/HealthBanner';
import { useConsumerWebhookEvents } from '@/hooks/useConsumerWebhookEvents';
import { TranslationHarvester } from '@/components/i18n/TranslationHarvester';
import { LanguagePrompt } from '@/components/i18n/LanguagePrompt';
import { loadAppNamespaces } from '@/lib/i18n/i18next';
import { ScreenshotGuard } from '@/components/security/ScreenshotGuard';
import { useEffect } from 'react';

const CustomerAppInner: React.FC = () => {
  const basePath = '/app';
  const queryClient = useQueryClient();
  const { user } = useCustomerAuth();
  const tenant = useCustomerTenant();
  useAppCacheClear();

  // Per-app namespace scoping: Consumer loads only general+auto+customer bundles.
  useEffect(() => { void loadAppNamespaces('customer'); }, []);

  useOneSignal(undefined);
  useRealtimeBalanceSync(user?.id);
  useConsumerWebhookEvents(user?.id);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 500));
  }, [queryClient]);

  const typo = tenant.typographyConfig;
  const multiplier = typo.global_font_size_multiplier || 1;

  return (
    <div
      className="mx-auto flex min-h-screen max-w-lg flex-col bg-background pwa-large-text"
      style={{
        '--pwa-font-multiplier': multiplier,
        '--pwa-heading-color': typo.global_heading_color || '#000000',
        '--pwa-body-color': typo.global_body_color || '#000000',
        '--pwa-heading-color-dark': '#fafafa',
        '--pwa-body-color-dark': '#cccccc',
      } as React.CSSProperties}
    >
      <HealthBanner />
      <TranslationHarvester category="customer" />
      <LanguagePrompt />
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex-1 pb-20">
          <Outlet />
        </div>
      </PullToRefresh>
      <CustomerBottomNav basePath={basePath} />
    </div>
  );
};

export const CustomerAppLayout: React.FC = () => {
  return (
    <CustomerAppAuthGuard>
      <SessionGuard logoutPath="/app/auth" appName="Kang" appContext="customer">
        <CustomerTenantProvider>
          <CustomerAppInner />
        </CustomerTenantProvider>
      </SessionGuard>
    </CustomerAppAuthGuard>
  );
};
