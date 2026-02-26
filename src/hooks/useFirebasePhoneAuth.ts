import { useState, useRef, useCallback } from 'react';
import { signInWithPhoneNumber, ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { getFirebaseAuth, setupRecaptchaVerifier, isFirebaseConfigured } from '@/lib/firebase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FirebaseOTPStep = 'phone' | 'otp' | 'verifying';

export function useFirebasePhoneAuth() {
  const [step, setStep] = useState<FirebaseOTPStep>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const sendOTP = useCallback(async (phoneNumber: string) => {
    setLoading(true);
    setError(null);
    try {
      // Fully clean up previous verifier and DOM element
      if (recaptchaRef.current) {
        try { recaptchaRef.current.clear(); } catch (_) { /* ignore */ }
        recaptchaRef.current = null;
      }
      // Reset the container DOM so reCAPTCHA doesn't see "already rendered"
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }
      recaptchaRef.current = setupRecaptchaVerifier();
      
      const confirmation = await signInWithPhoneNumber(
        getFirebaseAuth(),
        phoneNumber,
        recaptchaRef.current
      );
      confirmationRef.current = confirmation;
      setStep('otp');
      toast.success('Verification code sent!');
    } catch (err: any) {
      console.error('Firebase sendOTP error:', err);
      const msg = err.code === 'auth/too-many-requests'
        ? 'Too many attempts. Please try again later.'
        : err.code === 'auth/invalid-phone-number'
        ? 'Invalid phone number format.'
        : err.code === 'auth/billing-not-enabled'
        ? 'Phone authentication requires Firebase Blaze plan billing to be enabled and Phone sign-in method activated in Firebase Console.'
        : err.message || 'Failed to send verification code';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOTP = useCallback(async (code: string): Promise<boolean> => {
    if (!confirmationRef.current) {
      setError('No verification in progress');
      return false;
    }

    setLoading(true);
    setError(null);
    setStep('verifying');
    try {
      const result = await confirmationRef.current.confirm(code);
      const idToken = await result.user.getIdToken();

      // Bridge to Supabase session via edge function
      const { data, error: fnError } = await supabase.functions.invoke('firebase-phone-verify', {
        body: { firebase_id_token: idToken },
      });

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Verification failed');

      // Use the magic link to create Supabase session
      if (data.magic_link) {
        const url = new URL(data.magic_link);
        const token = url.searchParams.get('token');
        const type = url.searchParams.get('type');
        if (token && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as any,
          });
          if (verifyError) throw verifyError;
        }
      }

      await supabase.auth.refreshSession();
      toast.success('Verified successfully!');
      return true;
    } catch (err: any) {
      console.error('Firebase verifyOTP error:', err);
      const msg = err.code === 'auth/invalid-verification-code'
        ? 'Invalid code. Please try again.'
        : err.message || 'Verification failed';
      setError(msg);
      setStep('otp');
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setStep('phone');
    setError(null);
    setLoading(false);
    confirmationRef.current = null;
    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
      recaptchaRef.current = null;
    }
  }, []);

  return { step, loading, error, sendOTP, verifyOTP, reset };
}
