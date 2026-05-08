import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { detectEnv } from '@/lib/firebase';
import { setAdminOTPSettings } from '@/lib/otpProviderConfig';

export interface OTPProviderSettingRow {
  id: string;
  environment: 'development' | 'preview' | 'production';
  role_scope: 'all' | 'admin' | 'user';
  firebase_enabled: boolean;
  sms_fallback_enabled: boolean;
  notes: string | null;
  updated_at: string;
}

/**
 * Loads the admin-configured OTP provider settings for the current
 * environment and pushes them into the in-memory cache used by
 * `resolveOTPSettings()`. Runs once on mount.
 */
export function useOTPProviderSettings() {
  const [settings, setSettings] = useState<OTPProviderSettingRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const env = detectEnv();
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('otp_provider_settings')
          .select('*')
          .eq('environment', env)
          .order('role_scope', { ascending: true });
        if (cancelled) return;
        if (error) {
          console.warn('[otp-provider-settings] fetch failed', error.message);
        }
        // Prefer 'all' for now; future role-aware lookup is a no-op upgrade.
        const row = (data || []).find((r: any) => r.role_scope === 'all') || (data || [])[0] || null;
        if (row) {
          setAdminOTPSettings({
            firebase_enabled: !!row.firebase_enabled,
            sms_fallback_enabled: !!row.sms_fallback_enabled,
            role_scope: row.role_scope,
          });
          setSettings(row as OTPProviderSettingRow);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { settings, loading };
}
