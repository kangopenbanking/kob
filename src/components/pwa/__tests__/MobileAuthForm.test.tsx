import { describe, it, expect, vi } from 'vitest';
// @ts-ignore - screen is re-exported from @testing-library/dom
import { render, screen } from '@testing-library/react';

// Mock all dependencies
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
    functions: { invoke: vi.fn() },
    auth: {
      verifyOtp: vi.fn(),
      refreshSession: vi.fn(),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null } })),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/pwa/TenantProvider', () => ({
  useTenant: () => ({ name: 'Test Bank', primaryColor: '#000' }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('MobileAuthForm', () => {
  it('renders phone and email tabs', async () => {
    const { MobileAuthForm } = await import('@/components/pwa/MobileAuthForm');
    render(<MobileAuthForm onAuthSuccess={vi.fn()} />);
    
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows Recommended badge for phone tab (default +237)', async () => {
    const { MobileAuthForm } = await import('@/components/pwa/MobileAuthForm');
    render(<MobileAuthForm onAuthSuccess={vi.fn()} />);
    
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('shows phone number input on phone tab', async () => {
    const { MobileAuthForm } = await import('@/components/pwa/MobileAuthForm');
    render(<MobileAuthForm onAuthSuccess={vi.fn()} />);
    
    expect(screen.getByPlaceholderText('6 XX XX XX XX')).toBeInTheDocument();
  });

  it('shows Send Verification Code button', async () => {
    const { MobileAuthForm } = await import('@/components/pwa/MobileAuthForm');
    render(<MobileAuthForm onAuthSuccess={vi.fn()} />);
    
    expect(screen.getByText('Send Verification Code')).toBeInTheDocument();
  });
});
