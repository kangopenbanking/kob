import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MediaSection } from '@/components/pwa/MediaBanner';
import type { LayoutStyle, CardColors, WalkthroughConfig } from '@/components/pwa/TenantProvider';

export interface CustomerAppFeatures {
  qr_scan: boolean;
  transfer: boolean;
  request: boolean;
  bills: boolean;
  invoices: boolean;
  bank: boolean;
  split_bills: boolean;
  pay_links: boolean;
  cash_out: boolean;
  recurring: boolean;
  rewards: boolean;
  piggy_bank: boolean;
  njangi: boolean;
  rent_reporting: boolean;
  credit_score: boolean;
  cards: boolean;
}

export type CustomerSectionKey =
  | 'balance_card'
  | 'quick_actions'
  | 'media_banner'
  | 'upcoming_bills'
  | 'spending_stats'
  | 'recent_activities';

export interface HeroActionColors {
  accounts: string;
  cash_out: string;
  request: string;
  pay_links: string;
}

interface CustomerTenantBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string;
  isLoading: boolean;
  features: CustomerAppFeatures;
  sectionOrder: CustomerSectionKey[];
  layoutStyle: LayoutStyle;
  mediaSections: MediaSection[];
  walkthroughConfig: WalkthroughConfig;
  cardColors: CardColors;
  supportPhone: string;
  supportEmail: string;
  heroBgColor: string;
  heroBgImage: string | null;
  heroActionColors: HeroActionColors;
}

const defaultFeatures: CustomerAppFeatures = {
  qr_scan: true,
  transfer: true,
  request: true,
  bills: true,
  invoices: true,
  bank: true,
  split_bills: true,
  pay_links: true,
  cash_out: true,
  recurring: true,
  rewards: true,
  piggy_bank: true,
  njangi: true,
  rent_reporting: true,
  credit_score: true,
  cards: true,
};

const defaultSectionOrder: CustomerSectionKey[] = [
  'balance_card',
  'quick_actions',
  'upcoming_bills',
  'spending_stats',
  'media_banner',
  'recent_activities',
];

// Kang platform ID — the main institution that owns the unified Customer App
const KANG_PLATFORM_ID = 'f493095b-037a-40cf-82bc-3a3ab74550dd';

const defaultHeroActionColors: HeroActionColors = {
  accounts: '#ffffff',
  cash_out: '#ffffff',
  request: '#ffffff',
  pay_links: '#ffffff',
};

const defaultBranding: CustomerTenantBranding = {
  id: KANG_PLATFORM_ID,
  name: 'Kang',
  logoUrl: null,
  primaryColor: '217 91% 35%',
  tagline: 'Your money, your way',
  isLoading: true,
  features: defaultFeatures,
  sectionOrder: defaultSectionOrder,
  layoutStyle: 'modern',
  mediaSections: [],
  walkthroughConfig: { skip_enabled: true },
  cardColors: {},
  supportPhone: '',
  supportEmail: '',
  heroBgColor: '',
  heroBgImage: null,
  heroActionColors: defaultHeroActionColors,
};

const CustomerTenantContext = createContext<CustomerTenantBranding>(defaultBranding);

export const useCustomerTenant = () => useContext(CustomerTenantContext);

export const CustomerTenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<CustomerTenantBranding>(defaultBranding);

  useEffect(() => {
    const fetchPlatformConfig = async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, institution_name, logo_url, primary_color, tagline, app_config')
        .eq('id', KANG_PLATFORM_ID)
        .maybeSingle();

      if (error || !data) {
        setBranding({ ...defaultBranding, isLoading: false });
        return;
      }

      const inst = data as any;
      const appConfig = inst.app_config || {};
      const customerConfig = appConfig.customer_app_config || {};

      const features = { ...defaultFeatures, ...(customerConfig.features || {}) };
      const sectionOrder: CustomerSectionKey[] = Array.isArray(customerConfig.section_order)
        ? customerConfig.section_order
        : defaultSectionOrder;
      const layoutStyle: LayoutStyle = (['modern', 'classic', 'minimal', 'bold', 'gradient'] as const).includes(customerConfig.layout_style)
        ? customerConfig.layout_style
        : 'modern';
      const mediaSections: MediaSection[] = Array.isArray(customerConfig.media_sections)
        ? customerConfig.media_sections
        : [];
      const walkthroughConfig: WalkthroughConfig = customerConfig.walkthrough_config || { skip_enabled: true };
      const cardColors: CardColors = customerConfig.card_colors || {};
      const supportPhone: string = customerConfig.support_phone || appConfig.support_phone || '';
      const supportEmail: string = customerConfig.support_email || appConfig.support_email || '';

      const heroBgColor: string = customerConfig.hero_bg_color || '';
      const heroBgImage: string | null = customerConfig.hero_bg_image || null;
      const heroActionColors: HeroActionColors = { ...defaultHeroActionColors, ...(customerConfig.hero_action_colors || {}) };

      setBranding({
        id: inst.id,
        name: inst.institution_name || 'Kang',
        logoUrl: inst.logo_url ?? null,
        primaryColor: inst.primary_color ?? '217 91% 35%',
        tagline: inst.tagline ?? 'Your money, your way',
        isLoading: false,
        features,
        sectionOrder,
        layoutStyle,
        mediaSections,
        walkthroughConfig,
        cardColors,
        supportPhone,
        supportEmail,
        heroBgColor,
        heroBgImage,
        heroActionColors,
      });
    };

    fetchPlatformConfig();
  }, []);

  useEffect(() => {
    if (!branding.isLoading && branding.primaryColor) {
      document.documentElement.style.setProperty('--pwa-primary', branding.primaryColor);
    }
    return () => {
      document.documentElement.style.removeProperty('--pwa-primary');
    };
  }, [branding.isLoading, branding.primaryColor]);

  return (
    <CustomerTenantContext.Provider value={branding}>
      {children}
    </CustomerTenantContext.Provider>
  );
};
