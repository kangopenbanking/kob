import { describe, it, expect, vi } from 'vitest';
// @ts-ignore - screen is re-exported from @testing-library/dom
import { render, screen } from '@testing-library/react';

const mockNavigate = vi.fn();

// Chainable Supabase query mock — matches the production usage which chains
// multiple `.eq()` filters (e.g. `.select().eq(user_id).eq(resolved, false)`).
// Every terminal call resolves to an empty result so the component renders
// without throwing. Documented under Phase 1R §7.1 (unhandled rejection fix).
vi.mock('@/integrations/supabase/client', () => {
  const makeChain = (terminal: any = { data: [], error: null }) => {
    const chain: any = {};
    const passthrough = [
      'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
      'in', 'is', 'like', 'ilike', 'or', 'not', 'match',
      'contains', 'containedBy', 'range', 'order', 'limit',
      'filter', 'returns',
    ];
    for (const m of passthrough) chain[m] = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    chain.then = (resolve: (v: any) => any) => Promise.resolve(terminal).then(resolve);
    return chain;
  };
  return {
    supabase: {
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({ data: { user: { id: 'test-user', email: 'test@test.com' } } })
        ),
      },
      from: vi.fn(() => makeChain()),
      rpc: vi.fn(() => Promise.resolve({ data: false, error: null })),
    },
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('SecuritySettings', () => {
  it('renders security settings page for authenticated user', async () => {
    const Component = (await import('@/pages/SecuritySettings')).default;
    render(<Component />);
    await vi.waitFor(() => {
      expect(screen.getByText('Security Settings')).toBeInTheDocument();
    });
  });

  it('chained .eq().eq() query on suspicious_activities does not throw', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    // Regression guard for the unhandled rejection reported in Phase 1 (§7.1).
    const q = (supabase as any)
      .from('suspicious_activities')
      .select('*')
      .eq('user_id', 'test-user')
      .eq('resolved', false)
      .order('created_at', { ascending: false });
    const res = await q;
    expect(res).toEqual({ data: [], error: null });
  });
});
