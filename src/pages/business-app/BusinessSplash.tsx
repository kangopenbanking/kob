import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TenantProvider, useTenant } from '@/components/pwa/TenantProvider';
import { SplashScreen } from '@/components/pwa/SplashScreen';
import { WalkthroughCarousel } from '@/components/pwa/WalkthroughCarousel';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';
import { supabase } from '@/integrations/supabase/client';
import kobLogo from '@/assets/kob-logo.png';
import {
  Store, CreditCard, BarChart3, Users,
} from 'lucide-react';

const WALKTHROUGH_KEY = 'walkthrough_seen_kang-business';

const businessSlides = [
  {
    icon: Store,
    title: 'Manage Your Business',
    description: 'Everything you need to run your business — orders, products, inventory, and storefront — all in one place.',
  },
  {
    icon: CreditCard,
    title: 'Accept Payments Anywhere',
    description: 'QR codes, mobile money, bank transfers, and POS till. Get paid instantly with real-time notifications.',
  },
  {
    icon: BarChart3,
    title: 'Track Performance',
    description: 'Revenue analytics, customer insights, and detailed reports to help you grow smarter.',
  },
  {
    icon: Users,
    title: 'Grow Your Team',
    description: 'Add staff members with role-based access. Manage multiple locations from a single dashboard.',
  },
];

const BusinessSplashInner: React.FC = () => {
  const navigate = useNavigate();
  const tenant = useTenant();
  const [phase, setPhase] = useState<'loading' | 'splash' | 'walkthrough' | 'install'>('loading');

  // Swap manifest to business-specific one
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const original = link?.getAttribute('href');
    if (link) link.setAttribute('href', '/manifest-biz.json');
    return () => { if (link && original) link.setAttribute('href', original); };
  }, []);

  useEffect(() => {
    const checkState = async () => {
      const seen = localStorage.getItem(WALKTHROUGH_KEY) === 'true';
      if (seen) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate('/biz/home', { replace: true });
        } else {
          navigate('/biz/auth', { replace: true });
        }
      } else {
        setPhase('splash');
      }
    };
    checkState();
  }, [navigate]);

  const handleWalkthroughComplete = () => {
    try { localStorage.setItem(WALKTHROUGH_KEY, 'true'); } catch {}
    setPhase('install');
  };

  const handleInstallComplete = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate('/biz/home', { replace: true });
    } else {
      navigate('/biz/auth', { replace: true });
    }
  };

  if (phase === 'loading') return null;

  if (phase === 'splash') {
    return (
      <SplashScreen
        onComplete={() => setPhase('walkthrough')}
        duration={2500}
        name="Kang Business"
        logoUrl={kobLogo}
        tagline="Run your business, your way"
      />
    );
  }

  if (phase === 'walkthrough') {
    return (
      <WalkthroughCarousel
        slides={businessSlides}
        onComplete={handleWalkthroughComplete}
      />
    );
  }

  return (
    <PWAInstallPrompt
      onContinue={handleInstallComplete}
      appName="Kang Business"
      logoUrl={kobLogo}
      tagline="Your business management app"
      appKey="kob-business"
      defaultInstallUrl="https://kangopenbanking.com/biz"
    />
  );
};

const BusinessSplash: React.FC = () => (
  <TenantProvider>
    <BusinessSplashInner />
  </TenantProvider>
);

export default BusinessSplash;
