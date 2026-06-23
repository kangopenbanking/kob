import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WalkthroughCarousel } from '@/components/pwa/WalkthroughCarousel';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [] }) }) }) }) },
}));

vi.mock('@/components/pwa/TenantProvider', async () => {
  const React = await import('react');
  return {
    useTenant: () => ({ walkthroughConfig: {}, logoUrl: null }),
    TenantProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

describe('WalkthroughCarousel media fills the section', () => {
  it('renders image with object-cover and absolute fill', () => {
    render(
      <MemoryRouter>
        <WalkthroughCarousel
          onComplete={() => {}}
          slides={[
            { title: 'T', description: 'D', media_type: 'image', media_url: 'https://example.com/a.jpg' },
          ]}
        />
      </MemoryRouter>,
    );
    const img = screen.getByAltText('T') as HTMLImageElement;
    expect(img.className).toContain('object-cover');
    expect(img.className).toContain('absolute');
    expect(img.className).toContain('h-full');
    expect(img.className).toContain('w-full');
  });

  it('renders video with object-cover and absolute fill', () => {
    const { container } = render(
      <MemoryRouter>
        <WalkthroughCarousel
          onComplete={() => {}}
          slides={[
            { title: 'V', description: 'D', media_type: 'video', media_url: 'https://example.com/a.mp4' },
          ]}
        />
      </MemoryRouter>,
    );
    const video = container.querySelector('video')!;
    expect(video).toBeTruthy();
    expect(video.className).toContain('object-cover');
    expect(video.className).toContain('absolute');
    expect(video.getAttribute('src')).toBe('https://example.com/a.mp4');
  });
});
