// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user', email: 'test@test.com', user_metadata: { full_name: 'Test User' } } },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => <div ref={ref} {...props} />),
    button: React.forwardRef((props: any, ref: any) => <button ref={ref} {...props} />),
    h1: React.forwardRef((props: any, ref: any) => <h1 ref={ref} {...props} />),
    p: React.forwardRef((props: any, ref: any) => <p ref={ref} {...props} />),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/hooks/useBankingData', () => ({
  useBankAccounts: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useBankTransactions: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useSavingsAccounts: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useLoanApplications: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useCreditScore: vi.fn().mockReturnValue({ data: null, isLoading: false }),
  useVirtualCards: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));

vi.mock('@/components/pwa/PWATopBar', () => ({
  PWATopBar: () => <div data-testid="pwa-topbar">TopBar</div>,
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

// ─── MediaBanner Tests ───
describe('MediaBanner Component', () => {
  it('renders nothing when items array is empty', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    const { container } = render(<MediaBanner items={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders an image banner', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    render(
      <MediaBanner
        items={[
          { id: 'img1', type: 'image', url: 'https://example.com/promo.jpg', title: 'Summer Sale', position: 0 },
        ]}
      />
    );
    const img = screen.getByAltText('Summer Sale');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/promo.jpg');
    expect(screen.getByText('Summer Sale')).toBeInTheDocument();
  });

  it('renders a YouTube video embed', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    const { container } = render(
      <MediaBanner
        items={[
          { id: 'yt1', type: 'video', url: 'https://youtube.com/watch?v=abc123', provider: 'youtube', video_id: 'abc123', title: 'Tutorial', position: 0 },
        ]}
      />
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('src')).toContain('youtube.com/embed/abc123');
  });

  it('renders a Vimeo video embed', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    const { container } = render(
      <MediaBanner
        items={[
          { id: 'vim1', type: 'video', url: 'https://vimeo.com/99999', provider: 'vimeo', video_id: '99999', title: 'Demo', position: 0 },
        ]}
      />
    );
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toContain('player.vimeo.com/video/99999');
  });

  it('renders X/Twitter as a link-out', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    render(
      <MediaBanner
        items={[
          { id: 'x1', type: 'video', url: 'https://x.com/user/status/123', provider: 'x', title: 'X Post', position: 0 },
        ]}
      />
    );
    expect(screen.getByText('Watch on X')).toBeInTheDocument();
  });

  it('renders LinkedIn as a link-out', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    render(
      <MediaBanner
        items={[
          { id: 'li1', type: 'video', url: 'https://linkedin.com/video/123', provider: 'linkedin', title: 'LI Video', position: 0 },
        ]}
      />
    );
    expect(screen.getByText('Watch on LinkedIn')).toBeInTheDocument();
  });

  it('renders custom video with <video> tag', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    const { container } = render(
      <MediaBanner
        items={[
          { id: 'cv1', type: 'video', url: 'https://cdn.example.com/video.mp4', provider: 'custom', title: 'Custom', position: 0 },
        ]}
      />
    );
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video?.getAttribute('src')).toBe('https://cdn.example.com/video.mp4');
  });

  it('shows navigation arrows for multiple items', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    render(
      <MediaBanner
        items={[
          { id: 'a', type: 'image', url: 'a.jpg', title: 'First', position: 0 },
          { id: 'b', type: 'image', url: 'b.jpg', title: 'Second', position: 1 },
        ]}
      />
    );
    // Two nav buttons should exist
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2);
  });

  it('cycles through slides on nav click', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    render(
      <MediaBanner
        items={[
          { id: 'a', type: 'image', url: 'a.jpg', title: 'Slide A', position: 0 },
          { id: 'b', type: 'image', url: 'b.jpg', title: 'Slide B', position: 1 },
        ]}
      />
    );
    expect(screen.getByText('Slide A')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    // Click next
    fireEvent.click(buttons[1]);
    expect(screen.getByText('Slide B')).toBeInTheDocument();
  });

  it('applies card size height classes', async () => {
    const { MediaBanner } = await import('@/components/pwa/MediaBanner');
    const { container: small } = render(
      <MediaBanner cardSize="small" items={[{ id: 's', type: 'image', url: 's.jpg', position: 0 }]} />
    );
    expect(small.querySelector('.h-32')).toBeInTheDocument();

    const { container: large } = render(
      <MediaBanner cardSize="large" items={[{ id: 'l', type: 'image', url: 'l.jpg', position: 0 }]} />
    );
    expect(large.querySelector('.h-56')).toBeInTheDocument();
  });
});

// ─── detectProvider Tests ───
describe('detectProvider utility', () => {
  it('detects YouTube URLs', async () => {
    const { detectProvider } = await import('@/components/pwa/MediaBanner');
    expect(detectProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ provider: 'youtube', video_id: 'dQw4w9WgXcQ' });
    expect(detectProvider('https://youtu.be/dQw4w9WgXcQ')).toEqual({ provider: 'youtube', video_id: 'dQw4w9WgXcQ' });
  });

  it('detects Vimeo URLs', async () => {
    const { detectProvider } = await import('@/components/pwa/MediaBanner');
    expect(detectProvider('https://vimeo.com/123456789')).toEqual({ provider: 'vimeo', video_id: '123456789' });
  });

  it('detects Facebook URLs', async () => {
    const { detectProvider } = await import('@/components/pwa/MediaBanner');
    expect(detectProvider('https://www.facebook.com/watch?v=123').provider).toBe('facebook');
  });

  it('detects X/Twitter URLs', async () => {
    const { detectProvider } = await import('@/components/pwa/MediaBanner');
    expect(detectProvider('https://x.com/user/status/123').provider).toBe('x');
    expect(detectProvider('https://twitter.com/user/status/456').provider).toBe('x');
  });

  it('detects Instagram URLs', async () => {
    const { detectProvider } = await import('@/components/pwa/MediaBanner');
    const result = detectProvider('https://www.instagram.com/p/ABC123/');
    expect(result.provider).toBe('instagram');
    expect(result.video_id).toBe('ABC123');
  });

  it('detects LinkedIn URLs', async () => {
    const { detectProvider } = await import('@/components/pwa/MediaBanner');
    expect(detectProvider('https://www.linkedin.com/video/something').provider).toBe('linkedin');
  });

  it('falls back to custom for unknown URLs', async () => {
    const { detectProvider } = await import('@/components/pwa/MediaBanner');
    expect(detectProvider('https://some-cdn.com/video.mp4')).toEqual({ provider: 'custom', video_id: '' });
  });
});

// ─── TenantProvider Types & Defaults ───
describe('TenantProvider customization types', () => {
  it('exports correct layout style types and defaults', async () => {
    const tenant = await import('@/components/pwa/TenantProvider');
    // defaultSectionOrder should exist and include known keys
    expect(tenant.defaultSectionOrder).toContain('balance_card');
    expect(tenant.defaultSectionOrder).toContain('quick_actions');
    expect(tenant.defaultSectionOrder).toContain('financial_services');
    expect(tenant.defaultSectionOrder).toContain('recent_transactions');
  });
});

// ─── BankHome Layout Rendering ───
describe('BankHome Enhanced Layout', () => {
  // Mock TenantProvider to return different layout styles
  const mockTenant = (overrides: any = {}) => {
    vi.doMock('@/components/pwa/TenantProvider', () => ({
      useTenant: () => ({
        id: 'test-inst',
        name: 'Test Bank',
        logoUrl: null,
        primaryColor: '217 91% 35%',
        tagline: 'Test',
        isLoading: false,
        features: { cards: true, savings: true, loans: true, credit_score: true, mobile_money: true, qr_payments: true, bill_payments: true },
        homeLayout: { show_balance_card: true, show_account_carousel: true, show_financial_services: true, show_recent_transactions: true },
        sectionOrder: ['balance_card', 'quick_actions', 'financial_services', 'recent_transactions'],
        layoutStyle: 'modern',
        sectionStyles: {},
        mediaSections: [],
        walkthroughConfig: {},
        ...overrides,
      }),
      HomeSectionKey: {},
      defaultSectionOrder: ['balance_card', 'account_carousel', 'quick_actions', 'financial_services', 'recent_transactions'],
    }));
  };

  beforeEach(() => {
    vi.resetModules();
  });

  it('renders Total Balance in modern layout', async () => {
    mockTenant({ layoutStyle: 'modern' });
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
  });

  it('renders Total Balance in bold layout', async () => {
    mockTenant({ layoutStyle: 'bold' });
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
  });

  it('renders Total Balance in gradient layout', async () => {
    mockTenant({ layoutStyle: 'gradient' });
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
  });

  it('renders Total Balance in classic layout', async () => {
    mockTenant({ layoutStyle: 'classic' });
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
  });

  it('renders Total Balance in minimal layout', async () => {
    mockTenant({ layoutStyle: 'minimal' });
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
  });

  it('renders quick actions (Send, Receive, MoMo, QR Pay)', async () => {
    mockTenant();
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.getByText('Send')).toBeInTheDocument();
    expect(screen.getByText('Receive')).toBeInTheDocument();
    expect(screen.getByText('MoMo')).toBeInTheDocument();
    expect(screen.getByText('QR Pay')).toBeInTheDocument();
  });

  it('renders Financial Services section', async () => {
    mockTenant();
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.getByText('Financial Services')).toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();
    expect(screen.getByText('Loans')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('renders media_banner section when in sectionOrder', async () => {
    mockTenant({
      sectionOrder: ['balance_card', 'media_banner', 'quick_actions'],
      mediaSections: [
        { id: 'promo', type: 'image', url: 'https://example.com/img.jpg', title: 'Promo Banner', position: 0 },
      ],
    });
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.getByText('Promo Banner')).toBeInTheDocument();
  });

  it('hides features when disabled', async () => {
    mockTenant({
      features: { cards: true, savings: false, loans: false, credit_score: false, mobile_money: false, qr_payments: false, bill_payments: true },
    });
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.queryByText('Savings')).not.toBeInTheDocument();
    expect(screen.queryByText('Loans')).not.toBeInTheDocument();
    expect(screen.queryByText('MoMo')).not.toBeInTheDocument();
  });

  it('shows empty state for transactions', async () => {
    mockTenant();
    const BankHome = (await import('@/pages/banking-app/BankHome')).default;
    render(<BankHome />, { wrapper: Wrapper });
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });
});

// ─── SplashScreen Walkthrough Config ───
describe('SplashScreen with walkthrough config', () => {
  it('renders institution name and tagline', async () => {
    vi.doMock('@/components/pwa/TenantProvider', () => ({
      useTenant: () => ({
        name: 'MyBank',
        tagline: 'Your partner in finance',
        isLoading: false,
        logoUrl: null,
        walkthroughConfig: {},
      }),
    }));
    vi.resetModules();
    const { SplashScreen } = await import('@/components/pwa/SplashScreen');
    render(<SplashScreen onComplete={() => {}} />);
    expect(screen.getByText('MyBank')).toBeInTheDocument();
    expect(screen.getByText('Your partner in finance')).toBeInTheDocument();
  });
});
