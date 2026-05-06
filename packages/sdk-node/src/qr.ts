// QR Merchant Directory helper (v4.31.x) — public, unauthenticated.
// Cursor-paginated auto-fetch with a 5-minute in-memory cache so a partner
// virtual-card app can call `directory.list()` on every scan without thrash.

const FN_BASE = 'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1';
const TTL_MS = 5 * 60 * 1000;

export interface QRDirectoryMerchant {
  merchant_id: string;
  name: string;
  environment: string;
  status: string;
  mcc: string | null;
  country: string | null;
  logo_url: string | null;
  verified: boolean;
  created_at: string;
}

export interface QRDirectoryFilters {
  country?: string;
  category?: string;
  hardCap?: number; // default 1000
}

let cache: { data: QRDirectoryMerchant[]; ts: number; key: string } | null = null;

async function fetchAll(filters: QRDirectoryFilters): Promise<QRDirectoryMerchant[]> {
  const cap = filters.hardCap ?? 1000;
  const out: QRDirectoryMerchant[] = [];
  let cursor: string | null = null;
  while (out.length < cap) {
    const url = new URL(`${FN_BASE}/merchants-qr-directory`);
    url.searchParams.set('limit', '100');
    if (filters.country) url.searchParams.set('country', filters.country);
    if (filters.category) url.searchParams.set('category', filters.category);
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`KOB QR directory error: HTTP ${res.status}`);
    const json = await res.json() as { data: QRDirectoryMerchant[]; has_more?: boolean; next_cursor?: string | null };
    out.push(...(json.data ?? []));
    if (!json.has_more || !json.next_cursor) break;
    cursor = json.next_cursor;
  }
  return out;
}

export const qr = {
  directory: {
    /** Returns the full active merchant directory. Cached for 5 minutes. */
    async list(filters: QRDirectoryFilters = {}): Promise<QRDirectoryMerchant[]> {
      const key = JSON.stringify(filters);
      if (cache && cache.key === key && Date.now() - cache.ts < TTL_MS) return cache.data;
      const data = await fetchAll(filters);
      cache = { data, ts: Date.now(), key };
      return data;
    },
    /** Force-refresh ignoring the cache. */
    async sync(filters: QRDirectoryFilters = {}): Promise<QRDirectoryMerchant[]> {
      cache = null;
      return this.list(filters);
    },
    /** Convenience map for O(1) merchant_id lookups after a scan. */
    async byId(filters: QRDirectoryFilters = {}): Promise<Map<string, QRDirectoryMerchant>> {
      const list = await this.list(filters);
      return new Map(list.map((m) => [m.merchant_id, m]));
    },
  },
  merchant: {
    async get(merchantId: string, opts: { amount?: string; ref?: string } = {}) {
      const url = new URL(`${FN_BASE}/merchants-qr-get`);
      url.searchParams.set('id', merchantId);
      if (opts.amount) url.searchParams.set('amount', opts.amount);
      if (opts.ref) url.searchParams.set('ref', opts.ref);
      const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`KOB merchant QR error: HTTP ${res.status}`);
      return res.json();
    },
  },
};
