export type StorefrontTemplateId = 'classic' | 'modern' | 'bold' | 'minimal';

export interface StorefrontTemplate {
  id: StorefrontTemplateId;
  name: string;
  description: string;
  preview: {
    bannerHeight: string;
    radius: string;
    overlayOpacity: number; // 0-100
    logoShape: 'rounded' | 'circle' | 'square';
    layout: 'overlay' | 'stacked' | 'side';
    accentBar?: boolean;
  };
}

export const STOREFRONT_TEMPLATES: StorefrontTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Balanced banner with overlapping logo. Familiar and trusted.',
    preview: { bannerHeight: 'h-36', radius: 'rounded-2xl', overlayOpacity: 20, logoShape: 'rounded', layout: 'overlay' },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Tall banner, soft rounding, subtle overlay. Clean and contemporary.',
    preview: { bannerHeight: 'h-44', radius: 'rounded-3xl', overlayOpacity: 10, logoShape: 'circle', layout: 'overlay', accentBar: true },
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'High-impact full banner with strong overlay and centered branding.',
    preview: { bannerHeight: 'h-48', radius: 'rounded-2xl', overlayOpacity: 45, logoShape: 'square', layout: 'stacked' },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'No banner. Side-by-side logo and details. Fast and focused.',
    preview: { bannerHeight: 'h-0', radius: 'rounded-xl', overlayOpacity: 0, logoShape: 'rounded', layout: 'side' },
  },
];

export function getTemplate(id?: string | null): StorefrontTemplate {
  return STOREFRONT_TEMPLATES.find((t) => t.id === id) ?? STOREFRONT_TEMPLATES[0];
}
