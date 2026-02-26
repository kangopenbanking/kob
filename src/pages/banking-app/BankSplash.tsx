import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { SplashScreen } from '@/components/pwa/SplashScreen';
import { WalkthroughCarousel } from '@/components/pwa/WalkthroughCarousel';

const BankSplash: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'splash' | 'walkthrough'>('splash');

  if (phase === 'splash') {
    return (
      <TenantProvider>
        <SplashScreen onComplete={() => setPhase('walkthrough')} />
      </TenantProvider>
    );
  }

  return (
    <TenantProvider>
      <WalkthroughCarousel
        onComplete={() => navigate(`/bank/${institutionId}/auth`)}
      />
    </TenantProvider>
  );
};

export default BankSplash;
