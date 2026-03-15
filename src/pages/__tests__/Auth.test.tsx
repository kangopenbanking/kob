import { describe, it, expect, vi } from 'vitest';
// @ts-ignore - screen is re-exported from @testing-library/dom
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

const mockSelect = vi.fn(() => Promise.resolve({ data: [], error: null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
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

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>);

describe('Auth Page - Firebase OTP Integration', () => {
  it('renders the auth page with KOB branding', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    renderWithProviders(<Auth />);
    
    expect(screen.getByText('Welcome to KOB')).toBeInTheDocument();
  });

  it('renders the Secure Open Banking Platform tagline', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    renderWithProviders(<Auth />);
    
    expect(screen.getByText('Secure Open Banking Platform')).toBeInTheDocument();
  });

  it('renders the recaptcha container', async () => {
    const Auth = (await import('@/pages/Auth')).default;
    renderWithProviders(<Auth />);
    
    expect(document.getElementById('recaptcha-container')).toBeInTheDocument();
  });
});
