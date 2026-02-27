import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { CustomerTenantProvider } from './CustomerTenantProvider';
import { CustomerBottomNav } from './CustomerBottomNav';

export const CustomerAppLayout: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const basePath = `/app/${institutionId}`;

  return (
    <CustomerTenantProvider>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
        <div className="flex-1 pb-20">
          <Outlet />
        </div>
        <CustomerBottomNav basePath={basePath} />
      </div>
    </CustomerTenantProvider>
  );
};
