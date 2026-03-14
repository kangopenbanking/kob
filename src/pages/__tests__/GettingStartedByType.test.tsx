import { describe, it, expect, vi } from 'vitest';
// @ts-ignore - screen is re-exported from @testing-library/dom
import { render, screen } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

describe('GettingStartedByType', () => {
  it('renders all 4 account type cards', async () => {
    const Component = (await import('@/pages/developer/GettingStartedByType')).default;
    render(<Component />);
    expect(screen.getByText('Personal Account')).toBeInTheDocument();
    expect(screen.getByText('Merchant / Business')).toBeInTheDocument();
    expect(screen.getByText('Financial Institution')).toBeInTheDocument();
    expect(screen.getByText('Developer / TPP')).toBeInTheDocument();
  });

  it('renders features for each card', async () => {
    const Component = (await import('@/pages/developer/GettingStartedByType')).default;
    render(<Component />);
    expect(screen.getByText('Mobile money transfers')).toBeInTheDocument();
    expect(screen.getByText('Payment gateway')).toBeInTheDocument();
    expect(screen.getByText('AISP/PISP APIs')).toBeInTheDocument();
    expect(screen.getByText('Sandbox environment')).toBeInTheDocument();
  });

  it('renders onboarding steps', async () => {
    const Component = (await import('@/pages/developer/GettingStartedByType')).default;
    render(<Component />);
    expect(screen.getByText('Create account with phone or email')).toBeInTheDocument();
    expect(screen.getByText('Register your business')).toBeInTheDocument();
  });

  it('renders security badges', async () => {
    const Component = (await import('@/pages/developer/GettingStartedByType')).default;
    render(<Component />);
    expect(screen.getByText('COBAC Compliant')).toBeInTheDocument();
    expect(screen.getByText('OAuth 2.0 + PKCE')).toBeInTheDocument();
    expect(screen.getByText('Cameroon / CEMAC')).toBeInTheDocument();
  });

  it('renders sign-in section', async () => {
    const Component = (await import('@/pages/developer/GettingStartedByType')).default;
    render(<Component />);
    expect(screen.getByText('Already have an account?')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('has 4 Get Started buttons', async () => {
    const Component = (await import('@/pages/developer/GettingStartedByType')).default;
    render(<Component />);
    const buttons = screen.getAllByText('Get Started');
    expect(buttons).toHaveLength(4);
  });
});
