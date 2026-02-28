import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomerTenantProvider, useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';
import { SplashScreen } from '@/components/pwa/SplashScreen';
import { WalkthroughCarousel } from '@/components/pwa/WalkthroughCarousel';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';
import { supabase } from '@/integrations/supabase/client';

/**
 * Inner component that consumes CustomerTenantProvider context
 * but maps it to the shape SplashScreen/Walkthrough expect via TenantProvider.
 */
const CustomerSplashInner: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const tenant = useCustomerTenant();
  const [phase, setPhase] = useState<'splash' | 'walkthrough' | 'install'>('splash');

  const handleInstallComplete = async () => {
    // Check if user is already authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('linked_account_type')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile && (profile as any).linked_account_type) {
        navigate(`/app/${institutionId}/home`, { replace: true });
      } else {
        navigate(`/app/${institutionId}/onboarding`, { replace: true });
      }
    } else {
      navigate(`/app/${institutionId}/auth`, { replace: true });
    }
  };

  if (phase === 'splash') {
    return (
      <SplashScreen
        onComplete={() => setPhase('walkthrough')}
        duration={2500}
      />
    );
  }

  if (phase === 'walkthrough') {
    return (
      <WalkthroughCarousel
        onComplete={() => setPhase('install')}
      />
    );
  }

  return (
    <PWAInstallPrompt
      onContinue={handleInstallComplete}
      appName={tenant.name}
      logoUrl={tenant.logoUrl}
      accentColor={tenant.walkthroughConfig?.accent_color}
    />
  );
};

/**
 * CustomerSplash wraps with CustomerTenantProvider BUT also needs TenantProvider
 * for SplashScreen and WalkthroughCarousel which depend on useTenant().
 */
import { TenantProvider } from '@/components/pwa/TenantProvider';

const CustomerSplash: React.FC = () => {
  return (
    <CustomerTenantProvider>
      <TenantProvider>
        <CustomerSplashInner />
      </TenantProvider>
    </CustomerTenantProvider>
  );
};

export default CustomerSplash;
