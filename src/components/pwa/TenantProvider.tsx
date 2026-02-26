import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface AppFeatures {
  cards: boolean;
  savings: boolean;
  loans: boolean;
  credit_score: boolean;
  mobile_money: boolean;
  qr_payments: boolean;
  bill_payments: boolean;
}

export type LayoutStyle = 'modern' | 'classic' | 'minimal';

export type HomeSectionKey = 'balance_card' | 'account_carousel' | 'quick_actions' | 'financial_services' | 'recent_transactions';

export const defaultSectionOrder: HomeSectionKey[] = [
  'balance_card',
  'account_carousel',
  'quick_actions',
  'financial_services',
  'recent_transactions',
];

export interface HomeLayout {
  show_balance_card: boolean;
  show_account_carousel: boolean;
  show_financial_services: boolean;
  show_recent_transactions: boolean;
}

interface TenantBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string;
  isLoading: boolean;
  features: AppFeatures;
  homeLayout: HomeLayout;
  sectionOrder: HomeSectionKey[];
  layoutStyle: LayoutStyle;
}

const defaultFeatures: AppFeatures = {
  cards: true,
  savings: true,
  loans: true,
  credit_score: true,
  mobile_money: true,
  qr_payments: true,
  bill_payments: true,
};

const defaultHomeLayout: HomeLayout = {
  show_balance_card: true,
  show_account_carousel: true,
  show_financial_services: true,
  show_recent_transactions: true,
};

const defaultBranding: TenantBranding = {
  id: '',
  name: 'Kang Open Banking',
  logoUrl: null,
  primaryColor: '217 91% 35%',
  tagline: 'Your trusted banking partner',
  isLoading: true,
  features: defaultFeatures,
  homeLayout: defaultHomeLayout,
  sectionOrder: defaultSectionOrder,
  layoutStyle: 'modern',
};

const TenantContext = createContext<TenantBranding>(defaultBranding);

export const useTenant = () => useContext(TenantContext);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const [branding, setBranding] = useState<TenantBranding>(defaultBranding);

  useEffect(() => {
    if (!institutionId) {
      setBranding({ ...defaultBranding, isLoading: false });
      return;
    }

    const fetchInstitution = async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, institution_name, logo_url, primary_color, tagline, app_config')
        .eq('id', institutionId)
        .single();

      if (error || !data) {
        setBranding({
          ...defaultBranding,
          id: institutionId,
          isLoading: false,
        });
        return;
      }

      const inst = data as any;
      const appConfig = inst.app_config || {};
      const features = { ...defaultFeatures, ...(appConfig.features || {}) };
      const homeLayout = { ...defaultHomeLayout, ...(appConfig.home_layout || {}) };
      const sectionOrder: HomeSectionKey[] = Array.isArray(appConfig.section_order) ? appConfig.section_order : defaultSectionOrder;
      const layoutStyle: LayoutStyle = (['modern', 'classic', 'minimal'] as const).includes(appConfig.layout_style) ? appConfig.layout_style : 'modern';

      setBranding({
        id: inst.id,
        name: inst.institution_name,
        logoUrl: inst.logo_url ?? null,
        primaryColor: inst.primary_color ?? '217 91% 35%',
        tagline: inst.tagline ?? 'Your trusted banking partner',
        isLoading: false,
        features,
        homeLayout,
        sectionOrder,
        layoutStyle,
      });
    };

    fetchInstitution();
  }, [institutionId]);

  // Apply tenant primary color as CSS variable
  useEffect(() => {
    if (!branding.isLoading && branding.primaryColor) {
      document.documentElement.style.setProperty('--pwa-primary', branding.primaryColor);
    }
    return () => {
      document.documentElement.style.removeProperty('--pwa-primary');
    };
  }, [branding.isLoading, branding.primaryColor]);

  return (
    <TenantContext.Provider value={branding}>
      {children}
    </TenantContext.Provider>
  );
};
