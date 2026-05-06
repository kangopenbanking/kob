// merchants-qr-get — Returns a KOB merchant + a freshly built EMVCo MPQR payload.
//
// GET /functions/v1/merchants-qr-get?id=<merchant_uuid>&amount=<num>&ref=<txref>&currency=XAF
//
// Public. If amount is provided returns a *dynamic* QR (POI=12), otherwise *static* (POI=11).
// Standing Order P1 (Public First).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';
import { crc16ccitt } from '../_shared/emvco-qr.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CURRENCY_TO_NUMERIC: Record<string, string> = {
  XAF: '950', XOF: '952', USD: '840', EUR: '978',
};

function tlv(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, '0')}${value}`;
}

function buildEmvco(opts: {
  merchantId: string; merchantName: string; country: string; mcc: string;
  currency: string; amount?: string; ref?: string;
}): string {
  const numeric = CURRENCY_TO_NUMERIC[opts.currency] || '950';
  const acct = tlv('00', 'KOB.PAY') + tlv('01', opts.merchantId.slice(0, 30));
  const merchantTag = tlv('29', acct); // tag 29 reserved for KOB merchant ID
  const poi = opts.amount ? '12' : '11';
  let payload = '';
  payload += tlv('00', '01');                          // Payload format indicator
  payload += tlv('01', poi);                           // Point of initiation
  payload += merchantTag;
  payload += tlv('52', opts.mcc.padStart(4, '0').slice(0, 4));
  payload += tlv('53', numeric);
  if (opts.amount) payload += tlv('54', opts.amount);
  payload += tlv('58', opts.country.slice(0, 2));
  payload += tlv('59', opts.merchantName.slice(0, 25));
  payload += tlv('60', 'YAOUNDE'.slice(0, 15));
  if (opts.ref) {
    payload += tlv('62', tlv('05', opts.ref.slice(0, 25)));
  }
  payload += '6304'; // CRC tag header
  const crc = crc16ccitt(payload);
  return payload + crc;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const amount = url.searchParams.get('amount');
  const ref = url.searchParams.get('ref');
  const currency = (url.searchParams.get('currency') || 'XAF').toUpperCase();

  if (!id || !UUID_RE.test(id)) return json({ error: 'invalid_id' }, 400);
  if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) return json({ error: 'invalid_amount' }, 400);
  if (!CURRENCY_TO_NUMERIC[currency]) return json({ error: 'unsupported_currency' }, 400);
  if (ref && !/^[A-Za-z0-9._\-]{1,25}$/.test(ref)) return json({ error: 'invalid_ref' }, 400);

  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await supabase
    .from('merchant_qr_directory')
    .select('merchant_id, name, mcc, country, verified, logo_url')
    .eq('merchant_id', id)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'merchant_not_found' }, 404);

  const qr_payload = buildEmvco({
    merchantId: data.merchant_id,
    merchantName: data.name || 'KOB Merchant',
    country: data.country || 'CM',
    mcc: data.mcc || '5411',
    currency,
    amount: amount ?? undefined,
    ref: ref ?? undefined,
  });

  return json({
    merchant: data,
    qr_type: amount ? 'dynamic' : 'static',
    qr_payload,
    currency,
    amount: amount ? Number(amount) : null,
    reference: ref || null,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
  });
}
