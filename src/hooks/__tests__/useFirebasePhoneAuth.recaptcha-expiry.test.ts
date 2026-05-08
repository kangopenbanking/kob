import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Capture the callbacks passed into setupRecaptchaVerifier so we can
// simulate the reCAPTCHA v2 Invisible expired-callback firing.
let lastCallbacks: { onExpired?: () => void; onSolved?: (t: string) => void } | null = null;

const mockSignInWithPhoneNumber = vi.fn();
const mockClear = vi.fn();

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  RecaptchaVerifier: vi.fn(() => ({ clear: mockClear })),
  signInWithPhoneNumber: (...args: any[]) => mockSignInWithPhoneNumber(...args),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

vi.mock('@/lib/firebase', () => ({
  firebaseAuth: {},
  isFirebaseConfigured: true,
  FIREBASE_ENV: 'preview',
  detectEnv: () => 'preview',
  checkRuntimeDomainAuthorized: () => ({ ok: true, host: 'localhost', expected: ['localhost'] }),
  setupRecaptchaVerifier: vi.fn((_id?: string, cb?: any) => {
    lastCallbacks = cb || {};
    return { clear: mockClear, render: vi.fn().mockResolvedValue('w-1') };
  }),
  getFirebaseAuth: vi.fn(() => ({})),
}));

vi.mock('@/lib/otpProviderConfig', () => ({
  isFirebaseOnly: () => false,
  resolveOTPSettings: () => ({
    mode: 'fallback',
    source: 'default',
    environment: 'preview',
    firebase_enabled: true,
    sms_fallback_enabled: true,
    role_scope: 'all',
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { success: true }, error: null })),
    },
    auth: {
      setSession: vi.fn(() => Promise.resolve({ error: null })),
      verifyOtp: vi.fn(() => Promise.resolve({ error: null })),
      refreshSession: vi.fn(() => Promise.resolve({})),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

const flush = (ms = 350) => new Promise((r) => setTimeout(r, ms));

describe('useFirebasePhoneAuth — reCAPTCHA v2 Invisible expiry auto-resend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastCallbacks = null;
    mockSignInWithPhoneNumber.mockResolvedValue({ confirm: vi.fn() });
  });

  it('triggers an auto-resend when reCAPTCHA expires before submit', async () => {
    const { useFirebasePhoneAuth } = await import('@/hooks/useFirebasePhoneAuth');
    const { result } = renderHook(() => useFirebasePhoneAuth());

    await act(async () => { await result.current.sendOTP('+237655555555'); });
    expect(result.current.step).toBe('otp');
    expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(1);
    expect(typeof lastCallbacks?.onExpired).toBe('function');

    await act(async () => {
      lastCallbacks!.onExpired!();
      await flush();
    });

    expect(result.current.autoResendCount).toBe(1);
    expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(2);
  });

  it('caps auto-resend at 2 retries (3 total send attempts)', async () => {
    const { useFirebasePhoneAuth } = await import('@/hooks/useFirebasePhoneAuth');
    const { result } = renderHook(() => useFirebasePhoneAuth());

    await act(async () => { await result.current.sendOTP('+237655555555'); });

    // Fire expiry 5 times — should only retry up to 2 times.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        lastCallbacks!.onExpired!();
        await flush();
      });
    }

    expect(result.current.autoResendCount).toBe(2);
    // 1 initial + 2 auto-retries = 3
    expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(3);
  });

  it('does NOT auto-resend after the user has submitted the OTP', async () => {
    mockSignInWithPhoneNumber.mockResolvedValue({
      confirm: vi.fn().mockRejectedValue({ code: 'auth/invalid-verification-code' }),
    });

    const { useFirebasePhoneAuth } = await import('@/hooks/useFirebasePhoneAuth');
    const { result } = renderHook(() => useFirebasePhoneAuth());

    await act(async () => { await result.current.sendOTP('+237655555555'); });
    expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(1);

    // User submits — verifyOTP marks submittedRef = true.
    await act(async () => { await result.current.verifyOTP('123456'); });

    // Now expiry fires — must NOT auto-resend.
    await act(async () => {
      lastCallbacks!.onExpired!();
      await flush();
    });

    expect(result.current.autoResendCount).toBe(0);
    expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(1);
  });

  it('reset() clears autoResendCount', async () => {
    const { useFirebasePhoneAuth } = await import('@/hooks/useFirebasePhoneAuth');
    const { result } = renderHook(() => useFirebasePhoneAuth());

    await act(async () => { await result.current.sendOTP('+237655555555'); });
    await act(async () => {
      lastCallbacks!.onExpired!();
      await flush();
    });
    expect(result.current.autoResendCount).toBe(1);

    act(() => { result.current.reset(); });
    expect(result.current.autoResendCount).toBe(0);
    expect(result.current.step).toBe('phone');
  });
});
