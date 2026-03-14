import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('IdentityGuide', () => {
  it('renders page title', async () => {
    const Component = (await import('@/pages/developer/IdentityGuide')).default;
    render(<Component />);
    expect(screen.getByText('Identity & Security Guide')).toBeInTheDocument();
  });

  it('renders all 4 tabs', async () => {
    const Component = (await import('@/pages/developer/IdentityGuide')).default;
    render(<Component />);
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('MFA')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('renders auth methods in default tab', async () => {
    const Component = (await import('@/pages/developer/IdentityGuide')).default;
    render(<Component />);
    expect(screen.getByText('Phone OTP')).toBeInTheDocument();
    expect(screen.getByText('PIN Login')).toBeInTheDocument();
    expect(screen.getByText('Email + Password')).toBeInTheDocument();
    expect(screen.getByText('OAuth 2.0')).toBeInTheDocument();
  });

  it('renders unified login endpoint example', async () => {
    const Component = (await import('@/pages/developer/IdentityGuide')).default;
    render(<Component />);
    expect(screen.getByText('Unified Login Endpoint')).toBeInTheDocument();
  });
});
