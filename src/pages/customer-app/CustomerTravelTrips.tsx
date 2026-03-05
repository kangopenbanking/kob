import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Clock, Calendar, Users, Loader2, ArrowRight, Route as RouteIcon, Ticket } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface RouteType { id: string; origin: string; destination: string; distance_km: number | null; estimated_duration_minutes: number | null; }
interface Trip { id: string; route_id: string; departure_at: string; arrival_at: string; price: number; currency: string; available_seats: number; status: string; vehicle_info: string | null; seating_plan_id: string | null; }
interface ServiceInfo { display_name: string; service_type: string; theme_color: string | null; }

const CustomerTravelTrips: React.FC = () => {
  const { category, serviceId } = useParams<{ category: string; serviceId: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceInfo | null>(null);
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [svcRes, routeRes] = await Promise.all([
        supabase.from('travel_services').select('display_name, service_type, theme_color').eq('id', serviceId || '').maybeSingle(),
        supabase.from('travel_routes').select('id, origin, destination, distance_km, estimated_duration_minutes').eq('service_id', serviceId || '').eq('is_active', true),
      ]);
      setService(svcRes.data as any);
      const routeData = (routeRes.data as any[]) || [];
      setRoutes(routeData);

      if (routeData.length > 0) {
        const { data: tripData } = await supabase.from('travel_trips').select('*')
          .in('route_id', routeData.map(r => r.id)).in('status', ['scheduled', 'boarding'])
          .gte('departure_at', new Date().toISOString()).order('departure_at', { ascending: true });
        setTrips((tripData as any[]) || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [serviceId]);

  const filteredTrips = selectedRoute ? trips.filter(t => t.route_id === selectedRoute) : trips;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(220,25%,12%)] to-[hsl(220,30%,20%)] px-4 pb-8 pt-3">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(217,91%,35%/0.2),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => navigate(`/app/travel/${category}`)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white truncate">{service?.display_name || 'Agency'}</h1>
              <p className="text-[12px] text-white/50">{routes.length} routes · {trips.length} upcoming trips</p>
            </div>
          </div>
          {/* Route pills */}
          {routes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button onClick={() => setSelectedRoute(null)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${!selectedRoute ? 'bg-white text-[hsl(220,25%,12%)]' : 'bg-white/10 text-white/70'}`}>
                All
              </button>
              {routes.map(r => (
                <button key={r.id} onClick={() => setSelectedRoute(r.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${selectedRoute === r.id ? 'bg-white text-[hsl(220,25%,12%)]' : 'bg-white/10 text-white/70'}`}>
                  {r.origin} → {r.destination}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 px-4 -mt-3 pb-24 space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Route cards */}
            <div className="grid grid-cols-2 gap-2">
              {routes.map((route, i) => {
                const colors = [
                  'from-[hsl(217,91%,55%)] to-[hsl(217,91%,45%)]',
                  'from-[hsl(150,60%,40%)] to-[hsl(160,55%,32%)]',
                  'from-[hsl(38,92%,50%)] to-[hsl(28,88%,45%)]',
                  'from-[hsl(258,80%,58%)] to-[hsl(268,75%,48%)]',
                  'from-[hsl(172,66%,40%)] to-[hsl(182,60%,32%)]',
                  'from-[hsl(347,77%,50%)] to-[hsl(340,72%,42%)]',
                ];
                const color = colors[i % colors.length];
                return (
                <motion.div key={route.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`rounded-xl bg-gradient-to-br ${color} p-3 shadow-md`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <RouteIcon className="h-3.5 w-3.5 text-white/80" />
                    <span className="text-[11px] font-bold text-white truncate">{route.origin}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-white/60" />
                    <span className="text-[11px] text-white/70 truncate">{route.destination}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-white/60">
                      {route.estimated_duration_minutes ? `${Math.floor(route.estimated_duration_minutes / 60)}h${route.estimated_duration_minutes % 60 > 0 ? ` ${route.estimated_duration_minutes % 60}m` : ''}` : '—'}
                    </span>
                    <Badge className="text-[9px] h-5 border-0 bg-white/20 text-white">{trips.filter(t => t.route_id === route.id).length} trips</Badge>
                  </div>
                </motion.div>
                );
              })}
            </div>

            {/* Trips */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5" /> Available Journeys
              </p>
              {filteredTrips.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card py-12 text-center shadow-sm">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                  <p className="font-semibold text-muted-foreground">No upcoming trips</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTrips.map((trip, i) => {
                    const route = routes.find(r => r.id === trip.route_id);
                    const seatsLow = trip.available_seats <= 5;
                    const tripColors = [
                      { timeBg: 'bg-[hsl(217,91%,55%)]', timeText: 'text-white' },
                      { timeBg: 'bg-[hsl(150,60%,40%)]', timeText: 'text-white' },
                      { timeBg: 'bg-[hsl(38,92%,50%)]', timeText: 'text-white' },
                      { timeBg: 'bg-[hsl(258,80%,58%)]', timeText: 'text-white' },
                    ];
                    const tc = tripColors[i % tripColors.length];
                    return (
                      <motion.button key={trip.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        onClick={() => navigate(`/app/travel/${category}/${serviceId}/trips/${trip.id}`)}
                        className="group flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                      >
                        {/* Time block */}
                        <div className={`flex flex-col items-center rounded-xl ${tc.timeBg} px-3 py-2 shadow-md`}>
                          <span className={`text-lg font-black ${tc.timeText}`}>{format(new Date(trip.departure_at), 'HH:mm')}</span>
                          <span className={`text-[10px] font-medium ${tc.timeText}/70`}>{format(new Date(trip.departure_at), 'dd MMM')}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground text-[15px]">{route?.origin} → {route?.destination}</p>
                          <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{trip.available_seats} left</span>
                            {trip.vehicle_info && <span className="truncate">{trip.vehicle_info}</span>}
                          </div>
                          {seatsLow && <Badge className="mt-1 border-0 bg-destructive/10 text-destructive text-[10px] h-5">Filling fast</Badge>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-black text-foreground">{trip.price.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">{trip.currency}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerTravelTrips;
