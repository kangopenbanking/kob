import { useState, useRef, useCallback } from 'react';
import { signInWithPhoneNumber, ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import {
  getFirebaseAuth,
  setupRecaptchaVerifier,
  isFirebaseConfigured,
  checkRuntimeDomainAuthorized,
} from '@/lib/firebase';
import { mapFirebaseAuthError, type FirebaseErrorCategory } from '@/lib/firebaseErrors';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FirebaseOTPStep = 'phone' | 'otp' | 'verifying';
export type OTPProvider = 'firebase' | 'vonage';

export interface UseFirebasePhoneAuthOptions {
  otpType?: 'login' | 'signup';
  fullName?: string;
  pinCode?: string;
  countryCode?: string;
}

async function autoSolveCaptcha(): Promise<string | null> {
  try {
    const { data: c, error } = await supabase.functions.invoke('captcha-generate', { body: {} });
    if (error || !c?.session_id) return null;
    const m = String(c.question || '').match(/(\d+)\s*([+\-*])\s*(\d+)/);
    let answer = 0;
    if (m) {
      const [, a, op, b] = m;
      const x = parseInt(a, 10), y = parseInt(b, 10);
      answer = op === '+' ? x + y : op === '-' ? x - y : x * y;
    }
    const { error: vErr } = await supabase.functions.invoke('captcha-verify', {
      body: { session_id: c.session_id, answer },
    });
    if (vErr) return null;
    return c.session_id as string;
  } catch {
    return null;
  }
}

export function useFirebasePhoneAuth(options: UseFirebasePhoneAuthOptions = {}) {
  const [step, setStep] = useState<FirebaseOTPStep>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCategory, setErrorCategory] = useState<FirebaseErrorCategory | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [provider, setProvider] = useState<OTPProvider>('firebase');
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const phoneRef = useRef<string>('');
  const optsRef = useRef<UseFirebasePhoneAuthOptions>(options);
  optsRef.current = options;

  const sendViaVonage = useCallback(async (phoneNumber: string): Promise<boolean> => {
    const captchaSid = await autoSolveCaptcha();
    if (!captchaSid) {
      const m = 'SMS fallback unavailable (captcha service down). Please try again.';
      setError(m);
      toast.error(m);
      return false;
    }
    const { data, error: fnErr } = await supabase.functions.invoke('phone-auth-send-otp', {
      body: {
        phone_number: phoneNumber,
        otp_type: optsRef.current.otpType || 'login',
        delivery_method: 'sms',
        captcha_session_id: captchaSid,
      },
    });
    if (fnErr || !data?.success) {
      const m = data?.error || data?.details || fnErr?.message || 'Failed to send SMS code.';
      setError(m);
      toast.error(m);
      return false;
    }
    setProvider('vonage');
    setStep('otp');
    toast.success('Verification code sent via SMS (fallback)');
    return true;
  }, []);

  const sendOTP = useCallback(async (phoneNumber: string) => {
    phoneRef.current = phoneNumber;
    setLoading(true);
    setError(null);
    setErrorCategory(null);
    setErrorHint(null);

    // If Firebase isn't configured at all, go straight to Vonage.
    if (!isFirebaseConfigured) {
      try {
        await sendViaVonage(phoneNumber);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Pre-flight: warn about unauthorized domain (non-blocking).
    checkRuntimeDomainAuthorized();

    try {
      if (recaptchaRef.current) {
        try { recaptchaRef.current.clear(); } catch (_) { /* ignore */ }
        recaptchaRef.current = null;
      }
      const container = document.getElementById('recaptcha-container');
      if (container) container.innerHTML = '';

      recaptchaRef.current = setupRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(
        getFirebaseAuth(),
        phoneNumber,
        recaptchaRef.current,
      );
      confirmationRef.current = confirmation;
      setProvider('firebase');
      setStep('otp');
      toast.success('Verification code sent.');
    } catch (err: any) {
      console.error('Firebase sendOTP error:', err);
      const mapped = mapFirebaseAuthError(err);
      setErrorCategory(mapped.category);
      setErrorHint(mapped.hint || null);

      if (!mapped.shouldFallback) {
        setError(mapped.userMessage);
        toast.error(mapped.userMessage);
      } else {
        // Show the specific cause then auto-fallback.
        toast.message(mapped.userMessage, { description: mapped.hint });
        const ok = await sendViaVonage(phoneNumber);
        if (!ok) setError(mapped.userMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [sendViaVonage]);

  const verifyOTP = useCallback(async (code: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setStep('verifying');

    try {
      if (provider === 'vonage') {
        const opts = optsRef.current;
        const { data, error: fnErr } = await supabase.functions.invoke('phone-auth-verify-otp', {
          body: {
            phone_number: phoneRef.current,
            otp_code: code,
            otp_type: opts.otpType || 'login',
            full_name: opts.fullName,
            pin_code: opts.pinCode,
            country_code: opts.countryCode,
          },
        });
        if (fnErr) throw fnErr;
        if (!data?.success) throw new Error(data?.error || data?.message || 'Verification failed');

        if (!data.session?.access_token || !data.session?.refresh_token) {
          throw new Error('Verification succeeded but session could not be created. Please try logging in again.');
        }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) throw sessionError;
        toast.success('Verified successfully!');
        return true;
      }

      // Firebase path
      if (!confirmationRef.current) {
        setError('No verification in progress');
        return false;
      }
      const result = await confirmationRef.current.confirm(code);
      const idToken = await result.user.getIdToken();
      const { data, error: fnError } = await supabase.functions.invoke('firebase-phone-verify', {
        body: { firebase_id_token: idToken },
      });
      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || 'Verification failed');

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
      console.error('verifyOTP error:', err);
      const mapped = mapFirebaseAuthError(err);
      setError(mapped.userMessage);
      setErrorCategory(mapped.category);
      setErrorHint(mapped.hint || null);
      setStep('otp');
      toast.error(mapped.userMessage, mapped.hint ? { description: mapped.hint } : undefined);
      return false;
    } finally {
      setLoading(false);
    }
  }, [provider]);

  const reset = useCallback(() => {
    setStep('phone');
    setError(null);
    setErrorCategory(null);
    setErrorHint(null);
    setLoading(false);
    setProvider('firebase');
    confirmationRef.current = null;
    if (recaptchaRef.current) {
      try { recaptchaRef.current.clear(); } catch (_) { /* ignore */ }
      recaptchaRef.current = null;
    }
  }, []);

  return { step, loading, error, errorCategory, errorHint, provider, sendOTP, verifyOTP, reset };
}
