import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock firebase
const mockSignInWithPhoneNumber = vi.fn();
const mockConfirm = vi.fn();
const mockGetIdToken = vi.fn();
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
  setupRecaptchaVerifier: vi.fn(() => ({ clear: mockClear })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({
        data: { success: true, magic_link: 'https://example.com?token=abc&type=magiclink' },
        error: null,
      })),
    },
    auth: {
      verifyOtp: vi.fn(() => Promise.resolve({ error: null })),
      refreshSession: vi.fn(() => Promise.resolve({})),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useFirebasePhoneAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with phone step', async () => {
    const { useFirebasePhoneAuth } = await import('@/hooks/useFirebasePhoneAuth');
    const { result } = renderHook(() => useFirebasePhoneAuth());
    
    expect(result.current.step).toBe('phone');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sendOTP transitions to otp step on success', async () => {
    mockSignInWithPhoneNumber.mockResolvedValueOnce({
      confirm: mockConfirm,
    });

    const { useFirebasePhoneAuth } = await import('@/hooks/useFirebasePhoneAuth');
    const { result } = renderHook(() => useFirebasePhoneAuth());

    await act(async () => {
      await result.current.sendOTP('+237612345678');
    });

    expect(result.current.step).toBe('otp');
    expect(mockSignInWithPhoneNumber).toHaveBeenCalled();
  });

  it('sendOTP handles errors gracefully', async () => {
    mockSignInWithPhoneNumber.mockRejectedValueOnce({
      code: 'auth/invalid-phone-number',
      message: 'Invalid phone',
    });

    const { useFirebasePhoneAuth } = await import('@/hooks/useFirebasePhoneAuth');
    const { result } = renderHook(() => useFirebasePhoneAuth());

    await act(async () => {
      await result.current.sendOTP('invalid');
    });

    expect(result.current.step).toBe('phone');
    expect(result.current.error).toBeTruthy();
  });

  it('reset returns to phone step', async () => {
    const { useFirebasePhoneAuth } = await import('@/hooks/useFirebasePhoneAuth');
    const { result } = renderHook(() => useFirebasePhoneAuth());

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe('phone');
    expect(result.current.error).toBeNull();
  });
});
