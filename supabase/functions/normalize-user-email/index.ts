import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Normalizes the authenticated user's email to the canonical
 * `{kang_id}@kang.id` placeholder, but ONLY when the current email is itself a
 * placeholder (legacy `@temp.kob.cm` or current `@kang.id`). Real customer
 * email addresses are never modified.
 *
 * The KANG ID is auto-assigned by a DB trigger when the profile row is
 * inserted, so it is always present by the time this function is invoked.
 */
const PLACEHOLDER_DOMAINS = ['@kang.id', '@temp.kob.cm'];

function isPlaceholder(email: string): boolean {
  const e = email.toLowerCase();
  return PLACEHOLDER_DOMAINS.some((d) => e.endsWith(d));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentEmail = (user.email || '').toLowerCase();
    if (currentEmail && !isPlaceholder(currentEmail)) {
      return new Response(JSON.stringify({ normalized: false, reason: 'real_email' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the user's permanent KANG ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('kang_id')
      .eq('id', user.id)
      .maybeSingle();

    const kangId = (profile as any)?.kang_id as string | undefined;
    if (!kangId) {
      return new Response(JSON.stringify({ error: 'No KANG ID found for user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const canonical = `${kangId.toLowerCase()}@kang.id`;
    if (currentEmail === canonical) {
      return new Response(JSON.stringify({ normalized: false, reason: 'already_canonical', kang_id: kangId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
      email: canonical,
      email_confirm: true,
    });

    if (updErr) {
      console.error('normalize-user-email update failed:', updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('profiles').update({ email: canonical }).eq('id', user.id);

    return new Response(JSON.stringify({ normalized: true, email: canonical, kang_id: kangId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('normalize-user-email error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
