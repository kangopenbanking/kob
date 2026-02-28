import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TenantProvider, useTenant } from '@/components/pwa/TenantProvider';
import { SplashScreen } from '@/components/pwa/SplashScreen';
import { WalkthroughCarousel } from '@/components/pwa/WalkthroughCarousel';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';

const BankSplashInner: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const tenant = useTenant();
  const [phase, setPhase] = useState<'splash' | 'walkthrough' | 'install'>('splash');

  if (phase === 'splash') {
    return <SplashScreen onComplete={() => setPhase('walkthrough')} />;
  }

  if (phase === 'walkthrough') {
    return <WalkthroughCarousel onComplete={() => setPhase('install')} />;
  }

  return (
    <PWAInstallPrompt
      onContinue={() => navigate(`/bank/${institutionId}/auth`)}
      appName={tenant.name}
      logoUrl={tenant.logoUrl}
      accentColor={tenant.walkthroughConfig?.accent_color}
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
