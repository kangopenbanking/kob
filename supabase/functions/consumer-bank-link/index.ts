// Consumer Bank Link — AISP-style first-party account linking
// Lets a consumer link an external bank (registered in `banks`) to their KOB profile.
// Backed by the existing `bank_psu_links` table. Sandbox flow auto-authorises;
// production flow would redirect the user to the bank for SCA before activation.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  try {
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ─── GET / authorize_callback (production SCA redirect from bank) ───
    // The bank redirects the user's browser here with link_id + status.
    // No JWT — this is the redirect leg of an OAuth-style flow.
    const qsAction = url.searchParams.get('action');
    if (req.method === 'GET' || qsAction === 'authorize_callback') {
      const linkId = url.searchParams.get('link_id');
      const intentId = url.searchParams.get('intent_id');
      const status = (url.searchParams.get('status') || 'success').toLowerCase();
      const errorCode = url.searchParams.get('error');
      const ok = !errorCode && (status === 'success' || status === 'authorized' || status === 'completed');
      const appOrigin = Deno.env.get('APP_PUBLIC_URL') || (req.headers.get('referer') ? new URL(req.headers.get('referer')!).origin : 'https://kob.lovable.app');

      // Bank-link confirmation
      if (linkId) {
        const { data: link } = await supa.from('bank_psu_links').select('id, status').eq('id', linkId).maybeSingle();
        if (!link) {
          return Response.redirect(`${appOrigin}/app/linked-accounts?bank_link=not_found`, 302);
        }
        await supa.from('bank_psu_links').update({
          status: ok ? 'active' : 'revoked',
          linked_at: ok ? new Date().toISOString() : null,
        }).eq('id', linkId);
        return Response.redirect(`${appOrigin}/app/linked-accounts?bank_link=${ok ? 'success' : 'failed'}`, 302);
      }

      // Pay-by-bank intent SCA completion (forward to /pay/authorize for the in-app authorize action)
      if (intentId) {
        return Response.redirect(`${appOrigin}/pay/authorize?intent_id=${intentId}&sca=${ok ? 'success' : 'failed'}`, 302);
      }

      return json({ error: 'missing_link_id_or_intent_id' }, 400);
    }

    // ─── POST actions require JWT ───
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supa.auth.getUser(token);
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ─── LIST banks available for linking ───
    if (action === 'list_banks') {
      const { data: banks } = await supa
        .from('banks')
        .select('id, display_name, status')
        .eq('status', 'active')
        .order('display_name');
      return json({ banks: banks || [] });
    }

    // ─── LIST current links ───
    if (action === 'list_links') {
      const { data: links } = await supa
        .from('bank_psu_links')
        .select('id, bank_id, status, linked_at, created_at, banks(display_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return json({ links: links || [] });
    }

    // ─── INIT a new link ───
    if (action === 'init') {
      const bankId = body.bank_id as string;
      if (!bankId) return json({ error: 'missing_bank_id' }, 400);

      const { data: bank } = await supa.from('banks').select('id, display_name, status').eq('id', bankId).maybeSingle();
      if (!bank || bank.status !== 'active') return json({ error: 'bank_unavailable' }, 404);

      const { data: existing } = await supa
        .from('bank_psu_links')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('bank_id', bankId)
        .maybeSingle();

      if (existing?.status === 'active') return json({ link_id: existing.id, status: 'active', message: 'Already linked' });

      const linkId = existing?.id ?? crypto.randomUUID();
      const upsert = {
        id: linkId,
        user_id: user.id,
        bank_id: bankId,
        status: 'pending',
      };
      const { error: upErr } = await supa.from('bank_psu_links').upsert(upsert, { onConflict: 'user_id,bank_id' });
      if (upErr) return json({ error: 'init_failed', detail: upErr.message }, 500);

      // Build authorization redirect (production: real bank SCA URL via bank_connector_instances)
      const baseUrl = Deno.env.get('SUPABASE_URL')!;
      const authorizationUrl = `${baseUrl}/functions/v1/consumer-bank-link?action=authorize_callback&link_id=${linkId}`;

      return json({
        link_id: linkId,
        bank_id: bankId,
        bank_name: bank.display_name,
        status: 'pending',
        authorization_url: authorizationUrl,
      });
    }

    // ─── CONFIRM (sandbox auto-authorise) ───
    if (action === 'confirm') {
      const linkId = body.link_id as string;
      if (!linkId) return json({ error: 'missing_link_id' }, 400);

      const { data: link } = await supa.from('bank_psu_links').select('id, user_id, status').eq('id', linkId).maybeSingle();
      if (!link || link.user_id !== user.id) return json({ error: 'not_found' }, 404);

      const { error: updErr } = await supa
        .from('bank_psu_links')
        .update({ status: 'active', linked_at: new Date().toISOString() })
        .eq('id', linkId);
      if (updErr) return json({ error: 'confirm_failed', detail: updErr.message }, 500);

      return json({ link_id: linkId, status: 'active' });
    }

    // ─── REVOKE ───
    if (action === 'revoke') {
      const linkId = body.link_id as string;
      if (!linkId) return json({ error: 'missing_link_id' }, 400);
      const { error } = await supa
        .from('bank_psu_links')
        .update({ status: 'revoked' })
        .eq('id', linkId)
        .eq('user_id', user.id);
      if (error) return json({ error: 'revoke_failed', detail: error.message }, 500);
      return json({ link_id: linkId, status: 'revoked' });
    }

    return json({ error: 'invalid_action', message: 'Use list_banks | list_links | init | confirm | revoke' }, 400);
  } catch (err: any) {
    console.error('consumer-bank-link error:', err);
    return json({ error: 'internal_error', detail: err?.message }, 500);
  }
});
