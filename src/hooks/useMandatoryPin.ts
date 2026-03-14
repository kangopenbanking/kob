import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
