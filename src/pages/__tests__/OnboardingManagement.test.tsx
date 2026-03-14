import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    functions: { invoke: vi.fn(() => Promise.resolve({ data: {}, error: null })) },
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: null } })) },
  },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

describe('OnboardingManagement', () => {
  it('renders page title and description', async () => {
    const Component = (await import('@/pages/admin/OnboardingManagement')).default;
    render(<Component />);
    expect(screen.getByText('Onboarding Management')).toBeInTheDocument();
    expect(screen.getByText(/Review and manage onboarding applications/)).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    const Component = (await import('@/pages/admin/OnboardingManagement')).default;
    render(<Component />);
    expect(screen.getByText('Total Applications')).toBeInTheDocument();
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders filter controls', async () => {
    const Component = (await import('@/pages/admin/OnboardingManagement')).default;
    render(<Component />);
    expect(screen.getByPlaceholderText('Search by ID or user...')).toBeInTheDocument();
  });

  it('shows empty state when no applications', async () => {
    const Component = (await import('@/pages/admin/OnboardingManagement')).default;
    render(<Component />);
    await vi.waitFor(() => {
      expect(screen.getByText('No applications found')).toBeInTheDocument();
    });
  });
});
