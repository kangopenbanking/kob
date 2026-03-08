import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant, AppFeatures } from '@/components/pwa/TenantProvider';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeatureGateProps {
  featureKey: keyof AppFeatures;
  children: React.ReactNode;
  /** If true, redirect instead of showing fallback message */
  redirect?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ featureKey, children, redirect = false }) => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const tenant = useTenant();

  const isDisabled = !tenant.isLoading && tenant.features[featureKey] === false;

  useEffect(() => {
    if (isDisabled && redirect) {
      toast.error('This feature is not available for this institution');
    }
  }, [isDisabled, redirect]);

  if (tenant.isLoading) return null;

  if (isDisabled) {
    if (redirect) {
      navigate(`/bank/${institutionId}/home`, { replace: true });
      return null;
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Feature Not Available</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          This feature has not been enabled by your institution. Please contact your bank for more information.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
