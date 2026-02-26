import React, { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTenant, AppFeatures } from '@/components/pwa/TenantProvider';
import { toast } from 'sonner';

interface FeatureGateProps {
  featureKey: keyof AppFeatures;
  children: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ featureKey, children }) => {
  const { institutionId } = useParams();
  const tenant = useTenant();

  const isDisabled = !tenant.isLoading && tenant.features[featureKey] === false;

  useEffect(() => {
    if (isDisabled) {
      toast.error('This feature is not available for this institution');
    }
  }, [isDisabled]);

  if (tenant.isLoading) return null;

  if (isDisabled) {
    return <Navigate to={`/bank/${institutionId}/home`} replace />;
  }

  return <>{children}</>;
};
