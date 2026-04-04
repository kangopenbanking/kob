import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const url = new URL(req.url);

    let body: Record<string, unknown> = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch { /* ok */ } }

    const action = (body.action as string) || url.searchParams.get('action') || 'lookup';
    const merchantId = (body.merchant_id as string) || url.searchParams.get('merchant_id');
    const searchQuery = (body.q as string) || url.searchParams.get('q');

    // LOOKUP - Public business identity by merchant_id (no auth required)
    if (action === 'lookup') {
      if (!merchantId) {
        return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: profile } = await supabase
        .from('public_business_profiles')
        .select('id, merchant_id, business_name, business_type, industry, country, city, trust_tier, verification_badge, verified_since, public_description, website_url, registration_country')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .maybeSingle();

      if (!profile) {
        return new Response(JSON.stringify({ error: 'profile_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get public trust score if available
      const { data: trustScore } = await supabase
        .from('merchant_trust_scores')
        .select('overall_score, trust_tier, risk_level, factors_summary, last_calculated_at')
        .eq('merchant_id', merchantId)
        .eq('is_public', true)
        .maybeSingle();

      return new Response(JSON.stringify({
        data: {
          ...profile,
          trust_score: trustScore ? {
            score: trustScore.overall_score,
            tier: trustScore.trust_tier,
            risk_level: trustScore.risk_level,
            factors: trustScore.factors_summary,
            last_updated: trustScore.last_calculated_at,
          } : null,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // SEARCH - Public business directory search (no auth required)
    if (action === 'search') {
      if (!searchQuery || searchQuery.length < 2) {
        return new Response(JSON.stringify({ error: 'query must be at least 2 characters', param: 'q' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const industry = (body.industry as string) || url.searchParams.get('industry');
      const country = (body.country as string) || url.searchParams.get('country');
      const tier = (body.tier as string) || url.searchParams.get('tier');
      const limit = Math.min(parseInt((body.limit as string) || url.searchParams.get('limit') || '20'), 50);
      const offset = parseInt((body.offset as string) || url.searchParams.get('offset') || '0');

      let query = supabase
        .from('public_business_profiles')
        .select('id, merchant_id, business_name, business_type, industry, country, city, trust_tier, verification_badge, verified_since', { count: 'exact' })
        .eq('is_active', true)
        .ilike('business_name', `%${searchQuery}%`);

      if (industry) query = query.eq('industry', industry);
      if (country) query = query.eq('country', country);
      if (tier) query = query.eq('trust_tier', tier);

      const { data, count, error } = await query.order('trust_tier', { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;

      return new Response(JSON.stringify({
        data,
        pagination: { total: count || 0, limit, offset, has_more: (count || 0) > offset + limit },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // BADGE - Get verification badge details (no auth required)
    if (action === 'badge') {
      if (!merchantId) {
        return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: profile } = await supabase
        .from('public_business_profiles')
        .select('merchant_id, business_name, trust_tier, verification_badge, verified_since')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .maybeSingle();

      if (!profile) {
        return new Response(JSON.stringify({ data: { verified: false, merchant_id: merchantId } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: trustScore } = await supabase
        .from('merchant_trust_scores')
        .select('overall_score, trust_tier, risk_level')
        .eq('merchant_id', merchantId)
        .eq('is_public', true)
        .maybeSingle();

      return new Response(JSON.stringify({
        data: {
          verified: profile.verification_badge !== 'none',
          merchant_id: merchantId,
          business_name: profile.business_name,
          badge: profile.verification_badge,
          tier: profile.trust_tier,
          verified_since: profile.verified_since,
          trust_score: trustScore?.overall_score || null,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // VERIFY_STATUS - Public verification status check (no auth required)
    if (action === 'verify_status') {
      if (!merchantId) {
        return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: merchant } = await supabase
        .from('gateway_merchants')
        .select('id, business_name, kyb_status, status')
        .eq('id', merchantId)
        .single();

      if (!merchant) {
        return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        data: {
          merchant_id: merchant.id,
          business_name: merchant.business_name,
          kyb_verified: merchant.kyb_status === 'approved',
          platform_status: merchant.status === 'verified' ? 'active' : 'pending',
          verification_level: merchant.kyb_status === 'approved' ? 'full' : merchant.kyb_status === 'submitted' ? 'pending' : 'none',
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- ADMIN-ONLY ACTIONS (require auth) ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!adminRole) return new Response(JSON.stringify({ error: 'admin_only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // PUBLISH - Admin publishes a business profile
    if (action === 'publish') {
      if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: merchant } = await supabase.from('gateway_merchants').select('id, business_name, kyb_status, status, metadata').eq('id', merchantId).single();
      if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: kyc } = await supabase.from('business_kyc').select('business_type, industry, business_address, business_description, registration_country').eq('user_id', (await supabase.from('gateway_merchants').select('user_id').eq('id', merchantId).single()).data?.user_id).maybeSingle();

      const { data: trustScore } = await supabase.from('merchant_trust_scores').select('overall_score, trust_tier').eq('merchant_id', merchantId).maybeSingle();

      const tier = trustScore?.trust_tier || (merchant.kyb_status === 'approved' ? 'bronze' : 'unverified');

      const { data: profile, error } = await supabase.from('public_business_profiles').upsert({
        merchant_id: merchantId,
        business_name: merchant.business_name,
        business_type: kyc?.business_type || (body.business_type as string) || null,
        industry: kyc?.industry || (body.industry as string) || null,
        country: kyc?.registration_country || (body.country as string) || 'CM',
        city: (body.city as string) || null,
        trust_tier: tier,
        verification_badge: merchant.kyb_status === 'approved' ? 'verified' : 'none',
        verified_since: merchant.kyb_status === 'approved' ? new Date().toISOString() : null,
        public_description: kyc?.business_description || (body.description as string) || null,
        website_url: (body.website_url as string) || null,
        registration_country: kyc?.registration_country || null,
        is_active: true,
      }, { onConflict: 'merchant_id' }).select().single();

      if (error) throw error;

      // Make trust score public
      if (trustScore) {
        await supabase.from('merchant_trust_scores').update({ is_public: true }).eq('merchant_id', merchantId);
      }

      await supabase.from('audit_logs').insert({
        action_type: 'business_profile_published', entity_type: 'public_business_profile', entity_id: profile.id,
        performed_by: user.id, details: { merchant_id: merchantId, business_name: merchant.business_name, tier },
      });

      return new Response(JSON.stringify({ data: profile }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'invalid_action', valid: ['lookup', 'search', 'badge', 'verify_status', 'publish'] }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] public-business-identity error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
