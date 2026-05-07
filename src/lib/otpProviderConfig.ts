/**
 * OTP provider mode toggle.
 *
 * Controls whether the phone-auth flow may fall back to Vonage SMS when
 * Firebase fails. Useful for QA / CI runs that need to test Firebase in
 * isolation, or for rolling Firebase out gradually.
 *
 * Resolution order (highest priority first):
 *  1. ?otpMode=firebase-only | fallback   (URL param — per-session override)
 *  2. localStorage 'kob.otpMode'          (persists across reloads)
 *  3. VITE_OTP_MODE env var               (build-time default)
 *  4. 'fallback' (production default)
 */
export type OTPMode = 'firebase-only' | 'fallback';

const STORAGE_KEY = 'kob.otpMode';

function readUrlParam(): OTPMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = new URLSearchParams(window.location.search).get('otpMode');
    if (v === 'firebase-only' || v === 'fallback') return v;
  } catch { /* noop */ }
  return null;
}

function readStorage(): OTPMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'firebase-only' || v === 'fallback') return v;
  } catch { /* noop */ }
  return null;
}

function readEnv(): OTPMode | null {
  const v = (import.meta as any).env?.VITE_OTP_MODE;
  if (v === 'firebase-only' || v === 'fallback') return v;
  return null;
}

export function getOTPMode(): OTPMode {
  return readUrlParam() ?? readStorage() ?? readEnv() ?? 'fallback';
}

export function setOTPMode(mode: OTPMode): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* noop */ }
}

export function isFirebaseOnly(): boolean {
  return getOTPMode() === 'firebase-only';
}
