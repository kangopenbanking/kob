import { describe, it, expect, vi } from 'vitest';

// Mock firebase modules before imports
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  RecaptchaVerifier: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
}));

describe('Firebase Config', () => {
  it('initializes Firebase app', async () => {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    
    // Import the module to trigger initialization
    await import('@/lib/firebase');
    
    expect(getApps).toHaveBeenCalled();
    expect(initializeApp).toHaveBeenCalled();
    expect(getAuth).toHaveBeenCalled();
  });

  it('exports setupRecaptchaVerifier function', async () => {
    const { setupRecaptchaVerifier } = await import('@/lib/firebase');
    expect(typeof setupRecaptchaVerifier).toBe('function');
  });
});
