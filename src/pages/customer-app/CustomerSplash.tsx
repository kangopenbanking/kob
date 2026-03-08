import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerTenantProvider, useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';
import { SplashScreen } from '@/components/pwa/SplashScreen';
import { WalkthroughCarousel } from '@/components/pwa/WalkthroughCarousel';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';
import { supabase } from '@/integrations/supabase/client';

const WALKTHROUGH_KEY = 'walkthrough_seen_kang-customer';

const CustomerSplashInner: React.FC = () => {
  const navigate = useNavigate();
  const tenant = useCustomerTenant();
  const [phase, setPhase] = useState<'loading' | 'splash' | 'walkthrough' | 'install'>('loading');

  // On mount: check if walkthrough was already seen
  useEffect(() => {
    const checkState = async () => {
      const seen = localStorage.getItem(WALKTHROUGH_KEY) === 'true';
      if (seen) {
        // Skip walkthrough — route based on session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('linked_account_type')
            .eq('id', session.user.id)
            .maybeSingle();
        const lat = (profile as any)?.linked_account_type;
          if (lat && lat !== 'none') {
            navigate('/app/home', { replace: true });
          } else {
            navigate('/app/onboarding', { replace: true });
          }
        } else {
          navigate('/app/auth', { replace: true });
        }
      } else {
        setPhase('splash');
      }
    };
    checkState();
  }, [navigate]);

  const handleWalkthroughComplete = () => {
    // Mark walkthrough as seen
    try { localStorage.setItem(WALKTHROUGH_KEY, 'true'); } catch {}
    setPhase('install');
  };

  const handleInstallComplete = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('linked_account_type')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile && (profile as any).linked_account_type) {
        navigate('/app/home', { replace: true });
      } else {
        navigate('/app/onboarding', { replace: true });
      }
    } else {
      navigate('/app/auth', { replace: true });
    }
  };

  if (phase === 'loading') return null;

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
        onComplete={handleWalkthroughComplete}
      />
    );
  }

  return (
    <PWAInstallPrompt
      onContinue={handleInstallComplete}
      appName="Kang"
      logoUrl="/kang-app-logo.png"
      accentColor={tenant.walkthroughConfig?.accent_color}
      tagline={tenant.tagline || 'Your unified financial companion'}
      appKey="kang-customer"
    />
  );
};

const CustomerSplash: React.FC = () => {
  return (
    <CustomerTenantProvider>
      <CustomerSplashInner />
    </CustomerTenantProvider>
  );
};

export default CustomerSplash;
