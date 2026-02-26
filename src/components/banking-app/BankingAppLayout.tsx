import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { BottomNavigation } from '@/components/pwa/BottomNavigation';

export const BankingAppLayout: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const basePath = `/bank/${institutionId}`;

  return (
    <TenantProvider>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
        <div className="flex-1 pb-14">
          <Outlet />
        </div>
        <BottomNavigation basePath={basePath} />
      </div>
    </TenantProvider>
  );
};
