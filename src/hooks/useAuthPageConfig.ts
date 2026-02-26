import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthPageConfig {
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
  login_title: string;
  login_subtitle: string;
  signup_title: string;
  signup_subtitle: string;
  logo_url: string;
}

const defaults: AuthPageConfig = {
  hero_title: 'Welcome to KOB',
  hero_subtitle: 'Secure Open Banking Platform',
  hero_image_url: '',
  login_title: 'Welcome Back',
  login_subtitle: 'Sign in to your account using your phone number',
  signup_title: 'Create Account',
  signup_subtitle: 'Sign up with phone only - add email later from Profile Settings',
  logo_url: '/kob-logo.png',
};

export function useAuthPageConfig() {
  const [config, setConfig] = useState<AuthPageConfig>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('auth_page_config')
          .select('config_key, config_value');

        if (error) throw error;

        if (data && data.length > 0) {
          const configMap = { ...defaults };
          data.forEach((row: { config_key: string; config_value: string }) => {
            if (row.config_key in configMap) {
              (configMap as any)[row.config_key] = row.config_value || (defaults as any)[row.config_key];
            }
          });
          setConfig(configMap);
        }
      } catch (err) {
        console.error('Failed to load auth page config:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return { config, loading };
}
