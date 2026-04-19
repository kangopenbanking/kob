import { Store, Sparkles, Palette, Zap } from 'lucide-react';

export type StorefrontTemplateId = 'classic' | 'modern' | 'bold' | 'minimal';

export interface StorefrontTemplate {
  id: StorefrontTemplateId;
  name: string;
  description: string;
  icon: any;
  preview: {
    bannerHeight: 'h-28' | 'h-36' | 'h-44';
    radius: 'rounded-lg' | 'rounded-2xl' | 'rounded-3xl';
    overlayOpacity: number; // 0-100
    badgeStyle: 'pill' | 'square';
    showBannerOverlay: boolean;
  };
}

export const STOREFRONT_TEMPLATES: StorefrontTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Balanced layout with clear product cards. Best for traditional retail.',
    icon: Store,
    preview: { bannerHeight: 'h-36', radius: 'rounded-2xl', overlayOpacity: 20, badgeStyle: 'pill', showBannerOverlay: true },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Soft cards with breathing room. Ideal for fashion and lifestyle brands.',
    icon: Sparkles,
    preview: { bannerHeight: 'h-44', radius: 'rounded-3xl', overlayOpacity: 10, badgeStyle: 'pill', showBannerOverlay: false },
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Strong banner, vivid accents. Great for restaurants, bars, entertainment.',
    icon: Zap,
    preview: { bannerHeight: 'h-44', radius: 'rounded-2xl', overlayOpacity: 40, badgeStyle: 'square', showBannerOverlay: true },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean typography, no clutter. Perfect for premium and professional services.',
    icon: Palette,
    preview: { bannerHeight: 'h-28', radius: 'rounded-lg', overlayOpacity: 0, badgeStyle: 'square', showBannerOverlay: false },
  },
];

export const getTemplate = (id?: string | null): StorefrontTemplate =>
  STOREFRONT_TEMPLATES.find(t => t.id === id) || STOREFRONT_TEMPLATES[0];
