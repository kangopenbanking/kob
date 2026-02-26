import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface TenantBranding {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string;
  isLoading: boolean;
}

const defaultBranding: TenantBranding = {
  id: '',
  name: 'Kang Open Banking',
  logoUrl: null,
  primaryColor: '217 91% 35%',
  tagline: 'Your trusted banking partner',
  isLoading: true,
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
        .select('id, institution_name, logo_url, primary_color, tagline')
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

      setBranding({
        id: data.id,
        name: data.institution_name,
        logoUrl: data.logo_url ?? null,
        primaryColor: data.primary_color ?? '217 91% 35%',
        tagline: data.tagline ?? 'Your trusted banking partner',
        isLoading: false,
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
