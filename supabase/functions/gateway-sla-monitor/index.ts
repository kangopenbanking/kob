import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

/**
 * SLA Monitoring API
 * 
 * GET  ?action=status          — Current service status overview
 * GET  ?action=uptime          — Uptime % over period (default 30d)
 * GET  ?action=latency         — p50/p95/p99 latency per service
 * GET  ?action=incidents       — Active/recent incidents
 * POST ?action=check           — Run health checks and record metrics (cron)
 * POST ?action=incident        — Create/update incident (admin)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    // Auth check for non-cron calls
    const authHeader = req.headers.get('Authorization');
    let isAdmin = false;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (user) {
        const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
        isAdmin = !!role;
      }
    }

    // GET: Current status
    if (req.method === 'GET' && action === 'status') {
      if (!isAdmin) return problem(403, 'Forbidden', 'Admin access required');

      // Get latest check per service
      const { data: latestChecks } = await supabase.rpc('get_latest_sla_checks' as any).catch(() => ({ data: null }));

      // Fallback: manual query
      const services = ['gateway-api', 'auth-service', 'webhook-delivery', 'payout-engine', 'compliance-screen'];
      const statusMap: Record<string, unknown> = {};

      for (const svc of services) {
        const { data: latest } = await supabase.from('sla_metrics')
          .select('*').eq('service_name', svc)
          .order('checked_at', { ascending: false }).limit(1).single();
        statusMap[svc] = latest || { status: 'unknown', service_name: svc };
      }

      // Active incidents
      const { data: activeIncidents } = await supabase.from('sla_incidents')
        .select('*').neq('status', 'resolved')
        .order('started_at', { ascending: false });

      return new Response(JSON.stringify({
        overall_status: Object.values(statusMap).some((s: any) => s.status === 'down') ? 'major_outage'
          : Object.values(statusMap).some((s: any) => s.status === 'degraded') ? 'degraded'
          : 'operational',
        services: statusMap,
        active_incidents: activeIncidents || [],
        checked_at: new Date().toISOString(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // GET: Uptime
    if (req.method === 'GET' && action === 'uptime') {
      if (!isAdmin) return problem(403, 'Forbidden', 'Admin access required');

      const days = parseInt(url.searchParams.get('days') || '30');
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const { data: metrics } = await supabase.from('sla_metrics')
        .select('service_name, success, checked_at')
        .gte('checked_at', since);

      const uptimeMap: Record<string, { total: number; successful: number; uptime_pct: number }> = {};
      for (const m of metrics || []) {
        if (!uptimeMap[m.service_name]) uptimeMap[m.service_name] = { total: 0, successful: 0, uptime_pct: 0 };
        uptimeMap[m.service_name].total++;
        if (m.success) uptimeMap[m.service_name].successful++;
      }
      for (const svc in uptimeMap) {
        uptimeMap[svc].uptime_pct = uptimeMap[svc].total > 0
          ? Math.round((uptimeMap[svc].successful / uptimeMap[svc].total) * 10000) / 100
          : 100;
      }

      return new Response(JSON.stringify({ period_days: days, uptime: uptimeMap }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET: Latency percentiles
    if (req.method === 'GET' && action === 'latency') {
      if (!isAdmin) return problem(403, 'Forbidden', 'Admin access required');

      const hours = parseInt(url.searchParams.get('hours') || '24');
      const since = new Date(Date.now() - hours * 3600000).toISOString();

      const { data: metrics } = await supabase.from('sla_metrics')
        .select('service_name, response_time_ms')
        .gte('checked_at', since)
        .not('response_time_ms', 'is', null)
        .order('response_time_ms', { ascending: true });

      const latencyMap: Record<string, { p50: number; p95: number; p99: number; avg: number; count: number }> = {};
      const grouped: Record<string, number[]> = {};
      for (const m of metrics || []) {
        if (!grouped[m.service_name]) grouped[m.service_name] = [];
        grouped[m.service_name].push(m.response_time_ms);
      }

      for (const svc in grouped) {
        const sorted = grouped[svc].sort((a, b) => a - b);
        const len = sorted.length;
        latencyMap[svc] = {
          p50: sorted[Math.floor(len * 0.5)] || 0,
          p95: sorted[Math.floor(len * 0.95)] || 0,
          p99: sorted[Math.floor(len * 0.99)] || 0,
          avg: Math.round(sorted.reduce((a, b) => a + b, 0) / len),
          count: len,
        };
      }

      return new Response(JSON.stringify({ period_hours: hours, latency: latencyMap }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET: Incidents
    if (req.method === 'GET' && action === 'incidents') {
      if (!isAdmin) return problem(403, 'Forbidden', 'Admin access required');

      const status = url.searchParams.get('status');
      let q = supabase.from('sla_incidents').select('*').order('started_at', { ascending: false }).limit(50);
      if (status) q = q.eq('status', status);

      const { data: incidents } = await q;
      return new Response(JSON.stringify({ data: incidents || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST: Run health checks (cron-triggered)
    if (req.method === 'POST' && action === 'check') {
      const baseUrl = Deno.env.get('SUPABASE_URL')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      const services = [
        { name: 'gateway-api', endpoint: `${baseUrl}/functions/v1/api-health` },
        { name: 'auth-service', endpoint: `${baseUrl}/auth/v1/health` },
      ];

      const results = [];
      for (const svc of services) {
        const start = Date.now();
        let success = false;
        let errorMsg: string | null = null;
        let responseTime = 0;

        try {
          const resp = await fetch(svc.endpoint, {
            headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` },
            signal: AbortSignal.timeout(10000),
          });
          responseTime = Date.now() - start;
          success = resp.ok;
          if (!resp.ok) errorMsg = `HTTP ${resp.status}`;
          await resp.text().catch(() => null);
        } catch (e) {
          responseTime = Date.now() - start;
          errorMsg = e.message;
        }

        const status = !success ? 'down' : responseTime > 5000 ? 'degraded' : 'healthy';

        await supabase.from('sla_metrics').insert({
          service_name: svc.name,
          check_type: 'availability',
          status,
          response_time_ms: responseTime,
          success,
          error_message: errorMsg,
        });

        results.push({ service: svc.name, status, response_time_ms: responseTime });
      }

      return new Response(JSON.stringify({ checks: results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST: Manage incidents
    if (req.method === 'POST' && action === 'incident') {
      if (!isAdmin) return problem(403, 'Forbidden', 'Admin access required');

      const body = await req.json();
      const { incident_id, operation = 'create' } = body;

      if (operation === 'create') {
        const { service_name, severity, title, description } = body;
        if (!service_name || !title) return problem(400, 'Bad Request', 'service_name and title required');

        const { data: incident, error } = await supabase.from('sla_incidents').insert({
          service_name, severity: severity || 'minor', title, description,
        }).select().single();
        if (error) throw error;

        return new Response(JSON.stringify(incident), {
          status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (operation === 'update' && incident_id) {
        const updates: Record<string, unknown> = {};
        if (body.status) updates.status = body.status;
        if (body.resolution_notes) updates.resolution_notes = body.resolution_notes;
        if (body.status === 'resolved') updates.resolved_at = new Date().toISOString();

        const { data: updated, error } = await supabase.from('sla_incidents')
          .update(updates).eq('id', incident_id).select().single();
        if (error) throw error;

        return new Response(JSON.stringify(updated), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return problem(400, 'Bad Request', 'Invalid operation');
    }

    return problem(405, 'Method Not Allowed', `${req.method} with action=${action} not supported`);
  } catch (err) {
    return problem(500, 'Internal Server Error', err.message);
  }
});
