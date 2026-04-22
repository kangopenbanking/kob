// @ts-nocheck
/**
 * Smoke test: SupportAgentLogin renders without crashing and exposes
 * the diagnostic marker used by E2E + uptime probes.
 *
 * Guards against the regression where /support-agent silently fell through
 * to the SPA's NotFound page after a deploy.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupportAgentLogin from '@/pages/SupportAgentLogin';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
    rpc: () => Promise.resolve({ data: false }),
  },
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

describe('SupportAgentLogin', () => {
  it('renders the branded sign-in landing page', () => {
    render(
      <MemoryRouter initialEntries={['/support-agent']}>
        <SupportAgentLogin />
      </MemoryRouter>
    );
    expect(screen.getByTestId('support-agent-login-root')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Sign in to support$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
  });

  it('exposes the machine-readable health marker for uptime probes', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/support-agent']}>
        <SupportAgentLogin />
      </MemoryRouter>
    );
    const marker = container.querySelector('#support-agent-health');
    expect(marker).not.toBeNull();
    expect(marker?.getAttribute('data-state')).toBe('ok');
  });
});
