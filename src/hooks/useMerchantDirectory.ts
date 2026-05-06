import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// PERMANENT — Direct Backend Mandate
const FN_BASE = 'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1';
const CACHE_KEY = 'kob_merchant_dir_v1';
const PAGE_LIMIT = 100;
const HARD_CAP = 1000;

export interface DirectoryMerchant {
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

interface DirectoryFilters {
  country?: string;
  category?: string;
}

async function fetchAllPages(filters: DirectoryFilters): Promise<DirectoryMerchant[]> {
  const out: DirectoryMerchant[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < Math.ceil(HARD_CAP / PAGE_LIMIT); i++) {
    const url = new URL(`${FN_BASE}/merchants-qr-directory`);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    if (filters.country) url.searchParams.set('country', filters.country);
    if (filters.category) url.searchParams.set('category', filters.category);
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`directory_${res.status}`);
    const json = await res.json();
    out.push(...(json.data ?? []));
    if (!json.has_more || !json.next_cursor) break;
    cursor = json.next_cursor;
  }
  return out;
}

function readCache(): { data: DirectoryMerchant[]; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(data: DirectoryMerchant[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export function useMerchantDirectory(filters: DirectoryFilters = {}) {
  const queryClient = useQueryClient();
  const queryKey = ['merchant-directory', filters];
  const initial = useRef(readCache()?.data);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await fetchAllPages(filters);
      writeCache(data);
      return data;
    },
    initialData: initial.current,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Realtime: invalidate when any merchant row changes
  useEffect(() => {
    const channel = supabase
      .channel('merchant-directory-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gateway_merchants' },
        () => queryClient.invalidateQueries({ queryKey: ['merchant-directory'] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const byId = useMemo(() => {
    const m = new Map<string, DirectoryMerchant>();
    (query.data ?? []).forEach((r) => m.set(r.merchant_id, r));
    return m;
  }, [query.data]);

  return {
    merchants: query.data ?? [],
    byId,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    lastSyncedAt: query.dataUpdatedAt,
  };
}

export function searchMerchants(list: DirectoryMerchant[], q: string): DirectoryMerchant[] {
  const term = q.trim().toLowerCase();
  if (!term) return list;
  return list.filter((m) =>
    m.name?.toLowerCase().includes(term) ||
    m.merchant_id.toLowerCase().startsWith(term)
  );
}
