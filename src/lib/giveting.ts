import { supabase } from '@/integrations/supabase/client';

export type GivetingCurrency = 'XAF' | 'XOF' | 'EUR' | 'USD' | 'GBP';

export const GIVETING_CURRENCIES: { code: GivetingCurrency; symbol: string; label: string }[] = [
  { code: 'XAF', symbol: 'FCFA', label: 'CFA franc (XAF)' },
  { code: 'XOF', symbol: 'CFA', label: 'CFA franc (XOF)' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'GBP', symbol: '£', label: 'Pound Sterling' },
];

export const GIVETING_CATEGORIES = [
  { slug: 'medical', label: 'Medical', icon: 'heart-pulse' },
  { slug: 'emergencies', label: 'Emergencies', icon: 'life-buoy' },
  { slug: 'memorial', label: 'Memorial', icon: 'flower' },
  { slug: 'education', label: 'Education', icon: 'graduation-cap' },
  { slug: 'community', label: 'Community', icon: 'users' },
  { slug: 'animals', label: 'Animals', icon: 'paw-print' },
  { slug: 'business', label: 'Business', icon: 'briefcase' },
  { slug: 'faith', label: 'Faith', icon: 'church' },
  { slug: 'family', label: 'Family', icon: 'home' },
  { slug: 'sports', label: 'Sports', icon: 'trophy' },
  { slug: 'travel', label: 'Travel', icon: 'plane' },
  { slug: 'volunteer', label: 'Volunteer', icon: 'hand-heart' },
  { slug: 'wishes', label: 'Wishes', icon: 'sparkles' },
  { slug: 'competitions', label: 'Competitions', icon: 'medal' },
  { slug: 'creative', label: 'Creative', icon: 'palette' },
  { slug: 'events', label: 'Events', icon: 'calendar' },
  { slug: 'environment', label: 'Environment', icon: 'leaf' },
];

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

export async function giveting<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('giveting', {
    body: { action, ...body },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export function newIdempotencyKey(): string {
  return (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
