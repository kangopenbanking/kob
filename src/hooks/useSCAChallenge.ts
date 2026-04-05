/**
 * useSCAChallenge — Strong Customer Authentication hook
 * 
 * Wraps POST /v1/security/sca/initiate and /verify
 * Used before all payment operations in Consumer App
 * 
 * Standards: FAPI 1.0 Advanced, PSD2 SCA requirement
 */

import { useState, useCallback } from 'react';
import { kobApi, KOBApiError } from '@/lib/kob-api-client';
import { toast } from 'sonner';

interface SCAChallenge {
  challenge_id: string;
  method: 'otp' | 'pin' | 'biometric';
  expires_at: string;
}

interface SCAState {
  isOpen: boolean;
  challenge: SCAChallenge | null;
  loading: boolean;
  verifying: boolean;
  error: string | null;
}

export function useSCAChallenge() {
  const [state, setState] = useState<SCAState>({
    isOpen: false,
    challenge: null,
    loading: false,
    verifying: false,
    error: null,
  });

  const [pendingResolve, setPendingResolve] = useState<((value: boolean) => void) | null>(null);

  /**
   * Initiate SCA challenge. Returns a promise that resolves to true/false
   * based on whether the user successfully completed the challenge.
   */
  const requireSCA = useCallback((): Promise<boolean> => {
    return new Promise(async (resolve) => {
      setState(s => ({ ...s, loading: true, error: null }));
      setPendingResolve(() => resolve);

      try {
        const data = await kobApi.post<SCAChallenge>('security/sca/initiate');
        setState({
          isOpen: true,
          challenge: data,
          loading: false,
          verifying: false,
          error: null,
        });
      } catch (err) {
        const message = err instanceof KOBApiError
          ? err.problem.detail || 'Failed to initiate authentication'
          : 'Connection error. Please try again.';
        setState(s => ({ ...s, loading: false, error: message }));
        toast.error(message);
        resolve(false);
        setPendingResolve(null);
      }
    });
  }, []);

  /**
   * Verify the SCA challenge with user input
   */
  const verifySCA = useCallback(async (response: string) => {
    if (!state.challenge) return;

    setState(s => ({ ...s, verifying: true, error: null }));

    try {
      await kobApi.post('security/sca/verify', {
        challenge_id: state.challenge.challenge_id,
        response,
      });

      setState({
        isOpen: false,
        challenge: null,
        loading: false,
        verifying: false,
        error: null,
      });

      pendingResolve?.(true);
      setPendingResolve(null);
    } catch (err) {
      const message = err instanceof KOBApiError
        ? err.problem.detail || 'Authentication failed'
        : 'Verification error. Please try again.';
      setState(s => ({ ...s, verifying: false, error: message }));
    }
  }, [state.challenge, pendingResolve]);

  /**
   * Cancel SCA challenge
   */
  const cancelSCA = useCallback(() => {
    setState({
      isOpen: false,
      challenge: null,
      loading: false,
      verifying: false,
      error: null,
    });
    pendingResolve?.(false);
    setPendingResolve(null);
  }, [pendingResolve]);

  return {
    isOpen: state.isOpen,
    challenge: state.challenge,
    loading: state.loading,
    verifying: state.verifying,
    error: state.error,
    requireSCA,
    verifySCA,
    cancelSCA,
  };
}
