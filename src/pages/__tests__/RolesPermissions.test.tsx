import { describe, it, expect } from 'vitest';
// @ts-ignore - screen is re-exported from @testing-library/dom
import { render, screen } from '@testing-library/react';

describe('RolesPermissions', () => {
  it('renders page title', async () => {
    const Component = (await import('@/pages/developer/RolesPermissions')).default;
    render(<Component />);
    expect(screen.getByText('Roles & Permissions')).toBeInTheDocument();
  });

  it('renders RBAC architecture card', async () => {
    const Component = (await import('@/pages/developer/RolesPermissions')).default;
    render(<Component />);
    expect(screen.getByText('RBAC Architecture')).toBeInTheDocument();
  });

  it('renders all role categories', async () => {
    const Component = (await import('@/pages/developer/RolesPermissions')).default;
    render(<Component />);
    expect(screen.getByText('Platform Roles')).toBeInTheDocument();
    expect(screen.getByText('Institution Roles')).toBeInTheDocument();
    expect(screen.getByText('Merchant Roles')).toBeInTheDocument();
    expect(screen.getByText('Developer Roles')).toBeInTheDocument();
    expect(screen.getByText('Personal Roles')).toBeInTheDocument();
  });

  it('renders permission scopes', async () => {
    const Component = (await import('@/pages/developer/RolesPermissions')).default;
    render(<Component />);
    expect(screen.getByText('Permission Scopes')).toBeInTheDocument();
    expect(screen.getByText('accounts.read')).toBeInTheDocument();
    expect(screen.getByText('payments.initiate')).toBeInTheDocument();
    expect(screen.getByText('api_keys.manage')).toBeInTheDocument();
  });

  it('renders individual roles', async () => {
    const Component = (await import('@/pages/developer/RolesPermissions')).default;
    render(<Component />);
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('tpp')).toBeInTheDocument();
  });
});
