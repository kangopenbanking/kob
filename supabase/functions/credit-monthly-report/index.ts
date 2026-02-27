import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Get all users with credit events in the past month
    const { data: events } = await supabase
      .from('credit_events')
      .select('user_id, event_type, value_numeric')
      .gte('event_time', monthStart)
      .lte('event_time', monthEnd);

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ message: 'No events to report', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group by user
    const userEvents: Record<string, typeof events> = {};
    for (const e of events) {
      if (!userEvents[e.user_id]) userEvents[e.user_id] = [];
      userEvents[e.user_id].push(e);
    }

    let sent = 0;
    for (const [userId, userEvts] of Object.entries(userEvents)) {
      const onTime = userEvts.filter(e => e.event_type.includes('ON_TIME')).length;
      const missed = userEvts.filter(e => e.event_type.includes('MISSED')).length;
      const late = userEvts.filter(e => e.event_type.includes('LATE')).length;
      const total = onTime + missed + late;
      const onTimePercent = total > 0 ? Math.round((onTime / total) * 100) : 0;

      // Get score delta
      const { data: profile } = await supabase
        .from('credit_profiles')
        .select('current_score')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: snapshots } = await supabase
        .from('credit_score_snapshots')
        .select('score')
        .eq('user_id', userId)
        .gte('computed_at', monthStart)
        .order('computed_at', { ascending: true })
        .limit(1);

      const currentScore = profile?.current_score || 500;
      const startScore = snapshots?.[0]?.score || currentScore;
      const delta = currentScore - startScore;

      const advice = `You made ${onTime}/${total} payments on time (${onTimePercent}%). ${missed > 0 ? `${missed} missed. ` : ''}Your score ${delta >= 0 ? 'improved' : 'decreased'} by ${delta >= 0 ? '+' : ''}${delta} this month.`;

      // Send push notification
      try {
        await supabase.functions.invoke('push-notification', {
          body: {
            user_id: userId,
            title: 'Monthly Credit Report',
            message: advice,
          },
        });
      } catch (e) { console.error('Push failed for', userId, e); }

      // Create in-app notification
      await supabase.from('app_notifications').insert({
        user_id: userId,
        type: 'info',
        title: 'Monthly Credit Report',
        message: advice,
        icon: 'credit_report',
        metadata: { on_time: onTime, missed, late, delta, score: currentScore },
      });

      sent++;
    }

    console.log(`credit-monthly-report: sent ${sent} reports`);
    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
