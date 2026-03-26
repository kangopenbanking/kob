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
    if (!isFirebaseConfigured) {
      const msg = 'Phone OTP is not available right now. Please use PIN login or try again later.';
      setError(msg);
      toast.error(msg);
      return;
    }
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
        : err.code === 'auth/captcha-check-failed'
        ? 'Domain not authorized in Firebase. Please add this domain to Firebase Console → Authentication → Authorized domains.'
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

      // Set session using tokens returned by edge function (same pattern as PIN login)
      if (data.session?.access_token && data.session?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) throw sessionError;
      }
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
