import { useQuery } from '@tanstack/react-query';

const FN_BASE = 'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1';

interface QROptions {
  amount?: string;
  ref?: string;
  enabled?: boolean;
}

export interface MerchantQRPayload {
  merchant: {
    id: string;
    name: string;
    country: string | null;
    mcc: string | null;
    logo_url: string | null;
  };
  emvco: string;        // raw EMVCo MPQR string
  qr_kind: 'static' | 'dynamic';
}

export function useMerchantQR(merchantId?: string | null, opts: QROptions = {}) {
  const enabled = (opts.enabled ?? true) && !!merchantId;
  return useQuery({
    queryKey: ['merchant-qr', merchantId, opts.amount ?? null, opts.ref ?? null],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<MerchantQRPayload> => {
      const url = new URL(`${FN_BASE}/merchants-qr-get`);
      url.searchParams.set('id', merchantId!);
      if (opts.amount) url.searchParams.set('amount', opts.amount);
      if (opts.ref) url.searchParams.set('ref', opts.ref);
      const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`merchant_qr_${res.status}`);
      return res.json();
    },
  });
}
