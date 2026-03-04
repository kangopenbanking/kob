import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TenantProvider, useTenant } from '@/components/pwa/TenantProvider';
import { SplashScreen } from '@/components/pwa/SplashScreen';
import { WalkthroughCarousel } from '@/components/pwa/WalkthroughCarousel';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';
import { supabase } from '@/integrations/supabase/client';

const BankSplashInner: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const tenant = useTenant();
  const walkthroughKey = `walkthrough_seen_bank-${institutionId}`;
  const [phase, setPhase] = useState<'loading' | 'splash' | 'walkthrough' | 'install'>('loading');

  useEffect(() => {
    const checkState = async () => {
      const seen = localStorage.getItem(walkthroughKey) === 'true';
      if (seen) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate(`/bank/${institutionId}/home`, { replace: true });
        } else {
          navigate(`/bank/${institutionId}/auth`, { replace: true });
        }
      } else {
        setPhase('splash');
      }
    };
    checkState();
  }, [navigate, institutionId, walkthroughKey]);

  const handleWalkthroughComplete = () => {
    try { localStorage.setItem(walkthroughKey, 'true'); } catch {}
    setPhase('install');
  };

  if (phase === 'loading') return null;

  if (phase === 'splash') {
    return <SplashScreen onComplete={() => setPhase('walkthrough')} />;
  }

  if (phase === 'walkthrough') {
    return <WalkthroughCarousel onComplete={handleWalkthroughComplete} />;
  }

  return (
    <PWAInstallPrompt
      onContinue={() => navigate(`/bank/${institutionId}/auth`)}
      appName={tenant.name}
      logoUrl={tenant.logoUrl}
      accentColor={tenant.walkthroughConfig?.accent_color}
      tagline={tenant.tagline || undefined}
      appKey={`bank-${institutionId}`}
    />
  );
};

const BankSplash: React.FC = () => {
  return (
    <TenantProvider>
      <BankSplashInner />
    </TenantProvider>
  );
};

export default BankSplash;
