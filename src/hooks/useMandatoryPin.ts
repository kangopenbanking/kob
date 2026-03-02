import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MandatoryPinState {
  isLoading: boolean;
  requiresPinSetup: boolean;
}

/**
 * Checks if the system enforces mandatory PIN (2FA) and whether the 
 * current user has a PIN set. Returns whether they need to set one up.
 */
export function useMandatoryPin() {
  const [state, setState] = useState<MandatoryPinState>({
    isLoading: true,
    requiresPinSetup: false,
  });

  useEffect(() => {
    checkPinRequirement();
  }, []);

  const checkPinRequirement = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState({ isLoading: false, requiresPinSetup: false });
        return;
      }

      // Check if system config enforces 2FA (mandatory PIN)
      const { data: configData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'security.mfa_required')
        .maybeSingle();

      const mfaRequired = configData?.value === true;

      if (!mfaRequired) {
        setState({ isLoading: false, requiresPinSetup: false });
        return;
      }

      // Check if user has a PIN set via the phone number
      const phone = user.phone || user.user_metadata?.phone_number;
      if (!phone) {
        // No phone on file — can't check PIN, skip enforcement
        setState({ isLoading: false, requiresPinSetup: false });
        return;
      }

      const { data: pinData } = await supabase.functions.invoke('phone-auth-check-pin', {
        body: { phone_number: phone.startsWith('+') ? phone : `+${phone}` },
      });

      const hasPIN = pinData?.has_pin === true;

      setState({ isLoading: false, requiresPinSetup: !hasPIN });
    } catch (error) {
      console.error('Error checking mandatory PIN:', error);
      setState({ isLoading: false, requiresPinSetup: false });
    }
  };

  return state;
}
