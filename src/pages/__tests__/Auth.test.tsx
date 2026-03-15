import { describe, it, expect, vi } from 'vitest';
// @ts-ignore - screen is re-exported from @testing-library/dom
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      eq: vi.fn(() => ({ data: [], error: null })),
    })),
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

const renderWithProviders = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

describe('Auth Page - Firebase OTP Integration', () => {
  it('renders the auth page with KOB branding', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    renderWithProviders(<Auth />);
    
    const headings = screen.getAllByText('Welcome to KOB');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Sign In and Create Account buttons', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    renderWithProviders(<Auth />);
    
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByText('Create Account')).toBeInTheDocument();
  });

  it('renders the recaptcha container', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    renderWithProviders(<Auth />);
    
    expect(document.getElementById('recaptcha-container')).toBeInTheDocument();
  });
});
