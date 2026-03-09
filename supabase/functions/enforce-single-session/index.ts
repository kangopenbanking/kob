import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!

    // Verify the user with their token
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser(token)
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const userId = claimsData.user.id
    const { session_id, device_info, app_context } = await req.json()
    const ctx = app_context || 'customer'

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // 1. Get all existing sessions for this user in the same app context
    const { data: existingSessions } = await adminClient
      .from('user_active_sessions')
      .select('id, session_id')
      .eq('user_id', userId)
      .eq('app_context', ctx)

    // 2. Delete old sessions from the table
    if (existingSessions && existingSessions.length > 0) {
      const oldSessionIds = existingSessions.map(s => s.id)
      await adminClient
        .from('user_active_sessions')
        .delete()
        .in('id', oldSessionIds)

      // 3. Try to sign out old sessions via admin API
      for (const oldSession of existingSessions) {
        if (oldSession.session_id !== session_id) {
          try {
            await adminClient.auth.admin.signOut(oldSession.session_id, 'local')
          } catch {
            // Session may already be expired, ignore
          }
        }
      }
    }

    // 4. Delete any existing row for this user+context
    await adminClient
      .from('user_active_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('app_context', ctx)

    // Also delete any stale row with the same session_id (cross-context reuse)
    await adminClient
      .from('user_active_sessions')
      .delete()
      .eq('session_id', session_id)

    // 5. Upsert to handle any remaining race conditions on session_id uniqueness
    const { error: upsertError } = await adminClient
      .from('user_active_sessions')
      .upsert(
        {
          user_id: userId,
          session_id,
          device_info: device_info || null,
          last_active_at: new Date().toISOString(),
          app_context: ctx,
        },
        { onConflict: 'session_id' }
      )

    if (upsertError) {
      console.error('Failed to upsert session:', upsertError)
      return new Response(JSON.stringify({ error: 'Failed to register session' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('enforce-single-session error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
