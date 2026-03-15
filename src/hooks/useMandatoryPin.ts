import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PIN_JUST_SET_KEY = 'pin_just_set';

interface MandatoryPinState {
  isLoading: boolean;
  requiresPinSetup: boolean;
}

/**
 * Checks if the current user has a PIN set by looking at profiles.pin_code_hash.
 * Returns whether they need to set one up.
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
      // If PIN was just set in this session, skip the DB check
      if (sessionStorage.getItem(PIN_JUST_SET_KEY) === 'true') {
        sessionStorage.removeItem(PIN_JUST_SET_KEY);
        setState({ isLoading: false, requiresPinSetup: false });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState({ isLoading: false, requiresPinSetup: false });
        return;
      }

      // Check if user has a PIN set directly from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('pin_code_hash')
        .eq('id', user.id)
        .maybeSingle();

      const hasPin = !!profile?.pin_code_hash;

      setState({ isLoading: false, requiresPinSetup: !hasPin });
    } catch (error) {
      console.error('Error checking mandatory PIN:', error);
      setState({ isLoading: false, requiresPinSetup: false });
    }
  };

  return state;
}

/** Call before navigating away after a successful PIN set */
export function markPinAsJustSet() {
  sessionStorage.setItem(PIN_JUST_SET_KEY, 'true');
}
