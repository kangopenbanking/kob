import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const merchantId = body.merchant_id;
    if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const results: any = { services: 0, routes: 0, seating_plans: 0, trips: 0, timetables: 0 };

    // Create services
    const serviceConfigs = [
      { service_type: 'bus', display_name: 'KOB Express Bus', theme_color: '#ffbe0b', description: 'Fast intercity bus travel across Cameroon' },
      { service_type: 'tours', display_name: 'KOB Discovery Tours', theme_color: '#3a86ff', description: 'Guided tours and sightseeing packages' },
      { service_type: 'airlines', display_name: 'KOB Air Connect', theme_color: '#d00000', description: 'Domestic and regional flights across Cameroon' },
      { service_type: 'trains', display_name: 'KOB Rail Express', theme_color: '#000000', description: 'Rail travel across the Cameroon network' },
    ];

    const createdServices: any[] = [];
    for (const cfg of serviceConfigs) {
      const { data: existing } = await supabase.from('travel_services').select('id').eq('merchant_id', merchantId).eq('service_type', cfg.service_type).maybeSingle();
      if (existing) {
        createdServices.push(existing);
        continue;
      }
      const { data, error } = await supabase.from('travel_services').insert({ merchant_id: merchantId, ...cfg }).select('id').single();
      if (data) { createdServices.push(data); results.services++; }
    }

    // Create routes
    const routeConfigs = [
      { origin: 'Douala', destination: 'Yaoundé', distance_km: 243, estimated_duration_minutes: 210 },
      { origin: 'Yaoundé', destination: 'Bamenda', distance_km: 366, estimated_duration_minutes: 360 },
      { origin: 'Douala', destination: 'Limbe', distance_km: 72, estimated_duration_minutes: 90 },
      { origin: 'Douala', destination: 'Buea', distance_km: 67, estimated_duration_minutes: 80 },
      { origin: 'Yaoundé', destination: 'Kribi', distance_km: 185, estimated_duration_minutes: 180 },
    ];

    const createdRoutes: any[] = [];
    for (let si = 0; si < createdServices.length; si++) {
      const svc = createdServices[si];
      // Distribute routes: first 3 for bus, routes 2-4 for tours, routes 0-2 for airlines, routes 3-4 for trains
      const sliceMap = [[0, 3], [2, 5], [0, 3], [3, 5]];
      const [start, end] = sliceMap[si] || [0, 3];
      const routesForSvc = routeConfigs.slice(start, end);
      for (const cfg of routesForSvc) {
        const { data: existing } = await supabase.from('travel_routes').select('id').eq('service_id', svc.id).eq('origin', cfg.origin).eq('destination', cfg.destination).maybeSingle();
        if (existing) { createdRoutes.push({ ...existing, service_id: svc.id }); continue; }
        const { data } = await supabase.from('travel_routes').insert({ service_id: svc.id, ...cfg }).select('id').single();
        if (data) { createdRoutes.push({ ...data, service_id: svc.id }); results.routes++; }
      }
    }

    // Create seating plans
    const planConfigs = [
      { plan_name: '30-Seater Coach', rows: 8, columns: 4, service_idx: 0 },
      { plan_name: '52-Seater Bus', rows: 13, columns: 4, service_idx: 0 },
      { plan_name: '15-Seater Tour Van', rows: 5, columns: 3, service_idx: 1 },
      { plan_name: '120-Seater Aircraft', rows: 20, columns: 6, service_idx: 2 },
      { plan_name: '80-Seater Train Car', rows: 16, columns: 5, service_idx: 3 },
    ];
    ];

    const createdPlans: any[] = [];
    for (const cfg of planConfigs) {
      const sid = createdServices[cfg.service_idx]?.id;
      if (!sid) continue;
      const { data: existing } = await supabase.from('travel_seating_plans').select('id, total_seats').eq('service_id', sid).eq('plan_name', cfg.plan_name).maybeSingle();
      if (existing) { createdPlans.push(existing); continue; }

      const layout: any[] = [];
      let seatCount = 0;
      for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.columns; c++) {
          const isAisle = cfg.columns === 4 && c === 2 && r > 0 && r < cfg.rows - 1;
          const type = isAisle ? 'aisle' : 'seat';
          const label = `${r + 1}${String.fromCharCode(65 + c)}`;
          layout.push({ row: r, col: c, seat_label: label, type });
          if (type === 'seat') seatCount++;
        }
      }

      const { data } = await supabase.from('travel_seating_plans').insert({
        service_id: sid, plan_name: cfg.plan_name, rows: cfg.rows, columns: cfg.columns, layout, total_seats: seatCount,
      }).select('id, total_seats').single();
      if (data) { createdPlans.push(data); results.seating_plans++; }
    }

    // Create trips (future dates)
    const now = new Date();
    let tripCount = 0;
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      for (const route of createdRoutes) {
        const plan = createdPlans[Math.floor(Math.random() * createdPlans.length)];
        if (!plan) continue;
        const hours = [6, 8, 10, 14, 16];
        const hour = hours[Math.floor(Math.random() * hours.length)];
        const dep = new Date(now);
        dep.setDate(dep.getDate() + dayOffset);
        dep.setHours(hour, 0, 0, 0);
        const dur = 120 + Math.floor(Math.random() * 240);
        const arr = new Date(dep.getTime() + dur * 60000);
        const price = [3500, 4000, 5000, 6000, 7500, 10000][Math.floor(Math.random() * 6)];
        const vehicles = ['Bus LT-4523-A', 'Bus CM-7890-B', 'Coach DLA-1234', 'Van YDE-5678', 'Express LT-9012'];

        const { error } = await supabase.from('travel_trips').insert({
          route_id: route.id,
          seating_plan_id: plan.id,
          departure_at: dep.toISOString(),
          arrival_at: arr.toISOString(),
          price,
          currency: 'XAF',
          available_seats: plan.total_seats || 30,
          status: 'scheduled',
          vehicle_info: vehicles[Math.floor(Math.random() * vehicles.length)],
        });
        if (!error) tripCount++;
      }
    }
    results.trips = tripCount;

    // Create timetable entries
    let ttCount = 0;
    for (const route of createdRoutes.slice(0, 4)) {
      for (let day = 1; day <= 5; day++) {
        const times = [{ dep: '06:00', arr: '09:30' }, { dep: '10:00', arr: '13:30' }, { dep: '15:00', arr: '18:30' }];
        for (const t of times) {
          const price = [3500, 5000, 6000][Math.floor(Math.random() * 3)];
          const { error } = await supabase.from('travel_timetables').insert({
            route_id: route.id, day_of_week: day, departure_time: t.dep, arrival_time: t.arr, price,
          });
          if (!error) ttCount++;
        }
      }
    }
    results.timetables = ttCount;

    return new Response(JSON.stringify({ success: true, ...results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
