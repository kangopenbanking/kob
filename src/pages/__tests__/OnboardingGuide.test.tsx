import { describe, it, expect } from 'vitest';
// @ts-ignore - screen is re-exported from @testing-library/dom
import { render, screen } from '@testing-library/react';

describe('OnboardingGuide', () => {
  it('renders page title', async () => {
    const Component = (await import('@/pages/developer/OnboardingGuide')).default;
    render(<Component />);
    expect(screen.getByText('Onboarding & KYB/KYC Guide')).toBeInTheDocument();
  });

  it('renders status flow diagram', async () => {
    const Component = (await import('@/pages/developer/OnboardingGuide')).default;
    render(<Component />);
    expect(screen.getByText('Application Status Flow')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('submitted')).toBeInTheDocument();
    expect(screen.getByText('under review')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
    expect(screen.getByText('rejected')).toBeInTheDocument();
  });

  it('renders all 4 account type tabs', async () => {
    const Component = (await import('@/pages/developer/OnboardingGuide')).default;
    render(<Component />);
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Merchant')).toBeInTheDocument();
    expect(screen.getByText('Institution')).toBeInTheDocument();
    expect(screen.getByText('Developer')).toBeInTheDocument();
  });

  it('renders personal KYC tiers in default tab', async () => {
    const Component = (await import('@/pages/developer/OnboardingGuide')).default;
    render(<Component />);
    expect(screen.getByText(/Tier 1 — Basic/)).toBeInTheDocument();
    expect(screen.getByText(/Tier 2 — Standard/)).toBeInTheDocument();
    expect(screen.getByText(/Tier 3 — Premium/)).toBeInTheDocument();
  });
});
