// Merchant QR code service
// Actions:
//   issue        — merchant creates/rotates a stable static or dynamic QR (auth required)
//   list         — merchant lists their QR codes (auth)
//   resolve      — anyone resolves a slug → public merchant info + signed payload (no auth)
//   verify       — server-side HMAC verification helper used by pos-qr-payment
//   deactivate   — merchant deactivates a QR (auth)
//   stats        — merchant fetches scan/payment counters (auth)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const enc = new TextEncoder();

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function genSecret(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function genSlug(businessName: string): string {
  const base = (businessName || 'biz').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'biz';
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base}-${rand}`;
}

function publicAppUrl(slug: string): string {
  const origin = Deno.env.get('PUBLIC_APP_URL') || 'https://kob.lovable.app';
  return `${origin}/pay/m/${slug}`;
}

async function buildSignedPayload(qr: any, merchantName: string): Promise<{ payload: string; decoded: any; url: string }> {
  const url = publicAppUrl(qr.slug);
  const decoded: Record<string, any> = {
    type: 'kob_pos_pay',
    v: 2,
    slug: qr.slug,
    merchant_id: qr.merchant_id,
    merchant_name: merchantName,
    qr_id: qr.id,
    qr_type: qr.qr_type,
    currency: qr.currency,
  };
  if (qr.amount != null) decoded.amount = Number(qr.amount);
  if (qr.order_id) decoded.order_id = qr.order_id;
  if (qr.description) decoded.description = qr.description;
  if (qr.expires_at) decoded.expires_at = qr.expires_at;
  // Sign the deterministic JSON canonical form
  const canonical = JSON.stringify(Object.keys(decoded).sort().reduce((o: any, k) => (o[k] = decoded[k], o), {}));
  decoded.sig = await hmacSign(qr.signing_secret, canonical);
  decoded.url = url;
  return { payload: JSON.stringify(decoded), decoded, url };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const url = new URL(req.url);
    let body: any = {};
    if (req.method !== 'GET') {
      try { body = await req.json(); } catch { body = {}; }
    }
    const action = url.searchParams.get('action') || body.action;

    // --- PUBLIC: resolve slug ---
    if (action === 'resolve') {
      const slug = (url.searchParams.get('slug') || body.slug || '').trim();
      if (!slug) return new Response(JSON.stringify({ error: 'slug_required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

      const { data: qr } = await supabase.from('merchant_qr_codes')
        .select('id, merchant_id, slug, qr_type, amount, currency, description, order_id, signing_secret, is_active, expires_at')
        .eq('slug', slug).maybeSingle();

      if (!qr || !qr.is_active) {
        return new Response(JSON.stringify({ error: 'qr_not_found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'qr_expired' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('business_name, status').eq('id', qr.merchant_id).maybeSingle();
      if (!merchant || merchant.status !== 'active') {
        return new Response(JSON.stringify({ error: 'merchant_unavailable' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // log scan (no user yet)
      await supabase.from('merchant_qr_scan_log').insert({
        qr_id: qr.id, merchant_id: qr.merchant_id, scan_outcome: 'scanned',
        amount: qr.amount, order_id: qr.order_id,
        ip_address: req.headers.get('x-forwarded-for'),
        user_agent: req.headers.get('user-agent'),
      });
      await supabase.from('merchant_qr_codes')
        .update({ last_scanned_at: new Date().toISOString() })
        .eq('id', qr.id);
      // Atomic counter increment via RPC
      await supabase.rpc('increment_qr_scan', { _qr_id: qr.id }).catch(() => {});

      const built = await buildSignedPayload(qr, merchant.business_name);
      return new Response(JSON.stringify({
        merchant_id: qr.merchant_id,
        merchant_name: merchant.business_name,
        qr_type: qr.qr_type,
        amount: qr.amount,
        currency: qr.currency,
        description: qr.description,
        order_id: qr.order_id,
        slug: qr.slug,
        url: built.url,
        payload: built.payload,
        decoded: built.decoded,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- PUBLIC: verify a signed payload (used by pos-qr-payment) ---
    if (action === 'verify') {
      const { decoded } = body;
      if (!decoded || !decoded.slug || !decoded.sig) {
        return new Response(JSON.stringify({ valid: false, reason: 'missing_signature' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: qr } = await supabase.from('merchant_qr_codes')
        .select('id, merchant_id, signing_secret, is_active, expires_at, amount, qr_type, order_id')
        .eq('slug', decoded.slug).maybeSingle();

      if (!qr) return new Response(JSON.stringify({ valid: false, reason: 'unknown_slug' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      if (!qr.is_active) return new Response(JSON.stringify({ valid: false, reason: 'inactive' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      if (qr.expires_at && new Date(qr.expires_at) < new Date()) {
        return new Response(JSON.stringify({ valid: false, reason: 'expired' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { sig, url: _u, ...rest } = decoded;
      const canonical = JSON.stringify(Object.keys(rest).sort().reduce((o: any, k) => (o[k] = rest[k], o), {}));
      const expected = await hmacSign(qr.signing_secret, canonical);
      const valid = expected === sig;

      return new Response(JSON.stringify({
        valid, qr_id: qr.id, merchant_id: qr.merchant_id, qr_type: qr.qr_type,
        canonical_amount: qr.amount, canonical_order_id: qr.order_id,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- AUTH-required actions below ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    const merchantId = body.merchant_id || url.searchParams.get('merchant_id');
    if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id_required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    // Auth check: owner or active staff
    const { data: ownerRow } = await supabase.from('gateway_merchants')
      .select('id, business_name').eq('id', merchantId).eq('user_id', user.id).maybeSingle();
    let merchantName = ownerRow?.business_name;
    if (!ownerRow) {
      const { data: staff } = await supabase.from('merchant_pos_staff')
        .select('id').eq('merchant_id', merchantId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
      if (!staff) return new Response(JSON.stringify({ error: 'not_authorized' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      const { data: m } = await supabase.from('gateway_merchants')
        .select('business_name').eq('id', merchantId).maybeSingle();
      merchantName = m?.business_name || 'Merchant';
    }

    // --- ISSUE ---
    if (action === 'issue') {
      const { qr_type = 'static', amount, description, order_id, expires_at, rotate } = body;

      // For static: reuse existing active static unless rotate=true
      if (qr_type === 'static' && !rotate) {
        const { data: existing } = await supabase.from('merchant_qr_codes')
          .select('*').eq('merchant_id', merchantId).eq('qr_type', 'static').eq('is_active', true).maybeSingle();
        if (existing) {
          const built = await buildSignedPayload(existing, merchantName!);
          return new Response(JSON.stringify({
            ...existing, payload: built.payload, decoded: built.decoded, url: built.url, signing_secret: undefined,
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Rotate: deactivate prior active static
      if (qr_type === 'static' && rotate) {
        await supabase.from('merchant_qr_codes')
          .update({ is_active: false }).eq('merchant_id', merchantId).eq('qr_type', 'static').eq('is_active', true);
      }

      // generate unique slug
      let slug = genSlug(merchantName!);
      for (let i = 0; i < 5; i++) {
        const { data: clash } = await supabase.from('merchant_qr_codes').select('id').eq('slug', slug).maybeSingle();
        if (!clash) break;
        slug = genSlug(merchantName!);
      }

      const { data: created, error: insErr } = await supabase.from('merchant_qr_codes').insert({
        merchant_id: merchantId,
        slug,
        qr_type,
        amount: amount != null ? Number(amount) : null,
        currency: 'XAF',
        description: description || null,
        order_id: order_id || null,
        signing_secret: genSecret(),
        expires_at: expires_at || null,
        created_by: user.id,
      }).select('*').single();

      if (insErr) throw insErr;
      const built = await buildSignedPayload(created, merchantName!);
      return new Response(JSON.stringify({
        ...created, payload: built.payload, decoded: built.decoded, url: built.url, signing_secret: undefined,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- LIST ---
    if (action === 'list') {
      const { data, error } = await supabase.from('merchant_qr_codes')
        .select('id, slug, qr_type, amount, currency, description, order_id, is_active, expires_at, scan_count, payment_count, last_scanned_at, last_paid_at, created_at')
        .eq('merchant_id', merchantId).order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ qr_codes: data || [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- DEACTIVATE ---
    if (action === 'deactivate') {
      const { qr_id } = body;
      if (!qr_id) return new Response(JSON.stringify({ error: 'qr_id_required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      await supabase.from('merchant_qr_codes')
        .update({ is_active: false }).eq('id', qr_id).eq('merchant_id', merchantId);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- RECENT SCANS (audit trail for the Business app) ---
    if (action === 'recent_scans') {
      const limit = Math.min(Number(body.limit || url.searchParams.get('limit') || 20), 100);
      const { data, error } = await supabase.from('merchant_qr_scan_log')
        .select('id, qr_id, scanned_by_user, scan_outcome, amount, order_id, error_reason, ip_address, user_agent, created_at')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      // Normalize legacy field names for the client
      const scans = (data || []).map((s: any) => ({
        ...s,
        user_id: s.scanned_by_user,
        failure_reason: s.error_reason,
      }));
      return new Response(JSON.stringify({ scans }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- STATS ---
    if (action === 'stats') {
      const { data: log } = await supabase.from('merchant_qr_scan_log')
        .select('scan_outcome, amount, created_at')
        .eq('merchant_id', merchantId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      const totals = { scanned: 0, paid: 0, failed: 0, total_paid_amount: 0 };
      (log || []).forEach((r: any) => {
        if (r.scan_outcome === 'scanned') totals.scanned++;
        if (r.scan_outcome === 'paid') { totals.paid++; totals.total_paid_amount += Number(r.amount || 0); }
        if (r.scan_outcome === 'failed' || r.scan_outcome === 'tampered') totals.failed++;
      });
      return new Response(JSON.stringify({ stats: totals }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'invalid_action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('merchant-qr error:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: err instanceof Error ? err.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
