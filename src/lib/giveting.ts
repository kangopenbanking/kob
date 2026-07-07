import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export type GivetingCurrency = 'XAF' | 'XOF' | 'EUR' | 'USD' | 'GBP';

export const GIVETING_CURRENCIES: { code: GivetingCurrency; symbol: string; label: string }[] = [
  { code: 'XAF', symbol: 'FCFA', label: 'CFA franc (XAF)' },
  { code: 'XOF', symbol: 'CFA', label: 'CFA franc (XOF)' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'GBP', symbol: '£', label: 'Pound Sterling' },
];

// Each category has a distinct HSL color used for icons and the "selected"
// state background on the category picker. Values are HSL triplets so they
// compose with Tailwind arbitrary-value opacity syntax: hsl(var / 0.12).
export type GivetingCategory = {
  slug: string;
  label: string;
  icon: string;
  hsl: string;
};

export const GIVETING_CATEGORIES: GivetingCategory[] = [
  { slug: 'medical',      label: 'Medical',       icon: 'heart-pulse',     hsl: '350 78% 52%' },
  { slug: 'emergencies',  label: 'Emergencies',   icon: 'life-buoy',       hsl: '14 88% 52%'  },
  { slug: 'memorial',     label: 'Memorial',      icon: 'flower',          hsl: '272 55% 55%' },
  { slug: 'education',    label: 'Education',     icon: 'graduation-cap',  hsl: '221 72% 52%' },
  { slug: 'community',    label: 'Community',     icon: 'users',           hsl: '188 78% 42%' },
  { slug: 'animals',      label: 'Animals',       icon: 'paw-print',       hsl: '32 88% 48%'  },
  { slug: 'business',     label: 'Business',      icon: 'briefcase',       hsl: '215 28% 32%' },
  { slug: 'faith',        label: 'Faith',         icon: 'church',          hsl: '38 72% 45%'  },
  { slug: 'family',       label: 'Family',        icon: 'home',            hsl: '340 72% 55%' },
  { slug: 'sports',       label: 'Sports',        icon: 'trophy',          hsl: '42 92% 48%'  },
  { slug: 'travel',       label: 'Travel',        icon: 'plane',           hsl: '198 82% 48%' },
  { slug: 'volunteer',    label: 'Volunteer',     icon: 'hand-heart',      hsl: '160 62% 40%' },
  { slug: 'wishes',       label: 'Wishes',        icon: 'sparkles',        hsl: '292 62% 55%' },
  { slug: 'competitions', label: 'Competitions',  icon: 'medal',           hsl: '48 92% 48%'  },
  { slug: 'creative',     label: 'Creative',      icon: 'palette',         hsl: '312 68% 55%' },
  { slug: 'events',       label: 'Events',        icon: 'calendar',        hsl: '258 68% 58%' },
  { slug: 'environment',  label: 'Environment',   icon: 'leaf',            hsl: '142 62% 38%' },
];

export function categoryColor(slug: string): string {
  return GIVETING_CATEGORIES.find((c) => c.slug === slug)?.hsl ?? '215 20% 40%';
}

export function formatMoney(amountMinor: number | string, currency: string): string {
  const n = Number(amountMinor) / 100;
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'XAF' || currency === 'XOF' ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString()}`;
  }
}

export function toMinor(amount: number | string, currency: string): number {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  const zeroDecimal = currency === 'XAF' || currency === 'XOF';
  return Math.round(n * (zeroDecimal ? 100 : 100));
}

export function fromMinor(amountMinor: number | string): number {
  return Number(amountMinor) / 100;
}

export function progressPct(raised: number | string, goal: number | string): number {
  const r = Number(raised);
  const g = Number(goal);
  if (!g) return 0;
  return Math.min(100, Math.round((r / g) * 100));
}

/**
 * Invoke the `giveting` edge function and surface real backend error codes
 * (e.g. `kyc_required`) instead of the generic
 * "Edge Function returned a non-2xx status code" message that
 * `supabase.functions.invoke` throws for any 4xx/5xx response.
 */
export async function giveting<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('giveting', {
    body: { action, ...body },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const parsed = await error.context.json();
        const msg = parsed?.error || parsed?.message || 'request_failed';
        const wrapped = new Error(msg);
        (wrapped as any).details = parsed;
        throw wrapped;
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'request_failed') throw parseErr;
      }
    }
    throw error;
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export function newIdempotencyKey(): string {
  return (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Upload a cover image to the private `giveting-covers` bucket under the
 * user's own folder (RLS enforces this) and return a long-lived signed URL
 * suitable for storing on `giveting_campaigns.cover_media_url`.
 */
export async function uploadGivetingCover(file: File): Promise<string> {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('not_authenticated');

  const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
  if (file.size > MAX_BYTES) throw new Error('image_too_large');
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error('unsupported_image_type');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('giveting-covers')
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (upErr) throw new Error(upErr.message);

  // 10-year signed URL — cover images are meant to be viewable for the life
  // of the campaign. The bucket is private so getPublicUrl() cannot be used.
  const { data: signed, error: signErr } = await supabase.storage
    .from('giveting-covers')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !signed) throw new Error(signErr?.message || 'sign_failed');
  return signed.signedUrl;
}
