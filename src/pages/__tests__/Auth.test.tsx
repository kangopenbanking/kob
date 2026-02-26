import { describe, it, expect, vi } from 'vitest';
// @ts-ignore - screen is re-exported from @testing-library/dom
import { render, screen } from '@testing-library/react';

// Mock dependencies
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  RecaptchaVerifier: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({
  firebaseAuth: {},
  setupRecaptchaVerifier: vi.fn(() => ({ clear: vi.fn() })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({
        data: { question: '2 + 3', session_id: 'test-session' },
        error: null,
      })),
    },
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null } })),
      verifyOtp: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('Auth Page - Firebase OTP Integration', () => {
  it('renders auth method selection with One Time Code option', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    render(<Auth />);
    
    expect(screen.getByText('One Time Code')).toBeInTheDocument();
  });

  it('shows Recommended badge for Cameroon', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    render(<Auth />);
    
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('shows PIN / WhatsApp OTP as alternative', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    render(<Auth />);
    
    expect(screen.getByText('PIN / WhatsApp OTP')).toBeInTheDocument();
  });

  it('renders security check captcha', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    render(<Auth />);
    
    expect(screen.getByText('Security Check')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your answer')).toBeInTheDocument();
  });

  it('renders Welcome Back title for login mode', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    render(<Auth />);
    
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });
});
