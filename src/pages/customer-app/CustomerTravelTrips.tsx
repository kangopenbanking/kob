import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Clock, Calendar, Users, Loader2, ArrowRight, Route as RouteIcon, Ticket, Star, Bus, Shield } from 'lucide-react';
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

  const routeAccents = [
    { gradient: 'from-[hsl(217,91%,55%)] to-[hsl(230,80%,48%)]', light: 'hsl(217,80%,96%)', text: 'hsl(217,80%,40%)', dot: 'bg-[hsl(217,91%,55%)]' },
    { gradient: 'from-[hsl(150,60%,40%)] to-[hsl(165,55%,32%)]', light: 'hsl(150,50%,95%)', text: 'hsl(150,60%,28%)', dot: 'bg-[hsl(150,60%,40%)]' },
    { gradient: 'from-[hsl(38,92%,50%)] to-[hsl(25,88%,45%)]', light: 'hsl(38,80%,95%)', text: 'hsl(38,70%,30%)', dot: 'bg-[hsl(38,92%,50%)]' },
    { gradient: 'from-[hsl(258,80%,58%)] to-[hsl(275,72%,48%)]', light: 'hsl(258,60%,96%)', text: 'hsl(258,60%,35%)', dot: 'bg-[hsl(258,80%,58%)]' },
    { gradient: 'from-[hsl(172,66%,40%)] to-[hsl(185,60%,32%)]', light: 'hsl(172,50%,95%)', text: 'hsl(172,55%,28%)', dot: 'bg-[hsl(172,66%,40%)]' },
    { gradient: 'from-[hsl(347,77%,50%)] to-[hsl(335,72%,42%)]', light: 'hsl(347,60%,96%)', text: 'hsl(347,60%,35%)', dot: 'bg-[hsl(347,77%,50%)]' },
  ];

  return (
    <div className="min-h-screen bg-[hsl(220,20%,97%)]">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(220,30%,14%)] via-[hsl(220,28%,18%)] to-[hsl(225,25%,22%)] px-4 pb-10 pt-3">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(217,91%,40%/0.18),transparent_55%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(`/app/travel/${category}`)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm active:scale-95 transition-transform">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-white truncate">{service?.display_name || 'Agency'}</h1>
                <Shield className="h-4 w-4 text-[hsl(150,60%,55%)] shrink-0" />
              </div>
              <p className="text-[12px] text-white/45 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1"><RouteIcon className="h-3 w-3" />{routes.length} routes</span>
                <span className="text-white/20">·</span>
                <span className="flex items-center gap-1"><Ticket className="h-3 w-3" />{trips.length} trips</span>
                <span className="text-white/20">·</span>
                <span className="flex items-center gap-1"><Star className="h-3 w-3 text-[hsl(45,100%,60%)]" />4.8</span>
              </p>
            </div>
          </div>

          {/* Agency quick info bar */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 rounded-xl bg-white/8 backdrop-blur-sm border border-white/5 p-2.5 text-center">
              <p className="text-lg font-black text-white">{routes.length}</p>
              <p className="text-[9px] font-semibold text-white/40 uppercase tracking-wider">Routes</p>
            </div>
            <div className="flex-1 rounded-xl bg-white/8 backdrop-blur-sm border border-white/5 p-2.5 text-center">
              <p className="text-lg font-black text-white">{trips.length}</p>
              <p className="text-[9px] font-semibold text-white/40 uppercase tracking-wider">Trips</p>
            </div>
            <div className="flex-1 rounded-xl bg-white/8 backdrop-blur-sm border border-white/5 p-2.5 text-center">
              <p className="text-lg font-black text-[hsl(150,60%,55%)]">✓</p>
              <p className="text-[9px] font-semibold text-white/40 uppercase tracking-wider">Verified</p>
            </div>
          </div>

          {/* Route filter pills */}
          {routes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button onClick={() => setSelectedRoute(null)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold transition-all ${!selectedRoute ? 'bg-white text-[hsl(220,25%,12%)] shadow-md' : 'bg-white/8 text-white/60 hover:bg-white/12'}`}>
                All Routes
              </button>
              {routes.map(r => (
                <button key={r.id} onClick={() => setSelectedRoute(r.id)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold transition-all ${selectedRoute === r.id ? 'bg-white text-[hsl(220,25%,12%)] shadow-md' : 'bg-white/8 text-white/60 hover:bg-white/12'}`}>
                  {r.origin} → {r.destination}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 px-4 -mt-4 pb-24 space-y-5">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* ═══ ROUTE GRID ═══ */}
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
                <RouteIcon className="h-3.5 w-3.5" /> Popular Routes
              </p>
              <div className="grid grid-cols-2 gap-3">
                {routes.map((route, i) => {
                  const accent = routeAccents[i % routeAccents.length];
                  const tripCount = trips.filter(t => t.route_id === route.id).length;
                  const isActive = selectedRoute === route.id;
                  return (
                    <motion.button
                      key={route.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelectedRoute(isActive ? null : route.id)}
                      className={`group relative rounded-2xl bg-white p-4 text-left shadow-sm border transition-all overflow-hidden ${isActive ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border/50 hover:shadow-md hover:border-border'}`}
                    >
                      {/* Top accent line */}
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent.gradient}`} />

                      <div className="space-y-2.5 pt-1">
                        {/* Origin */}
                        <div className="flex items-start gap-2">
                          <div className={`mt-0.5 h-2.5 w-2.5 rounded-full ${accent.dot} shrink-0 ring-2 ring-white shadow-sm`} />
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">From</p>
                            <p className="text-sm font-extrabold text-foreground truncate">{route.origin}</p>
                          </div>
                        </div>

                        {/* Connector */}
                        <div className="flex items-center gap-2 pl-1">
                          <div className="w-0.5 h-4 rounded-full bg-border ml-[3.5px]" />
                          {route.estimated_duration_minutes && (
                            <span className="text-[9px] font-semibold text-muted-foreground/50 flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {Math.floor(route.estimated_duration_minutes / 60)}h{route.estimated_duration_minutes % 60 > 0 ? `${route.estimated_duration_minutes % 60}m` : ''}
                            </span>
                          )}
                        </div>

                        {/* Destination */}
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 h-2.5 w-2.5 rounded-sm bg-foreground shrink-0 ring-2 ring-white shadow-sm" />
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">To</p>
                            <p className="text-sm font-extrabold text-foreground truncate">{route.destination}</p>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                        <Badge className="text-[9px] h-5 border-0 font-bold" style={{ backgroundColor: accent.light, color: accent.text }}>
                          {tripCount} trip{tripCount !== 1 ? 's' : ''}
                        </Badge>
                        {route.distance_km && (
                          <span className="text-[9px] font-semibold text-muted-foreground/50">{route.distance_km} km</span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ═══ TRIP LIST ═══ */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5" /> Available Journeys
                </p>
                <span className="text-[11px] font-semibold text-primary">{filteredTrips.length} found</span>
              </div>

              {filteredTrips.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-white border border-border/50 py-14 text-center shadow-sm">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Calendar className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="font-bold text-foreground">No upcoming trips</p>
                  <p className="text-[12px] text-muted-foreground max-w-[200px]">Check back later for new schedules</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTrips.map((trip, i) => {
                    const route = routes.find(r => r.id === trip.route_id);
                    const seatsLow = trip.available_seats <= 5;
                    const accent = routeAccents[routes.findIndex(r => r.id === trip.route_id) % routeAccents.length];
                    const seatPercent = Math.max(0, Math.min(100, (trip.available_seats / 50) * 100));

                    return (
                      <motion.button
                        key={trip.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => navigate(`/app/travel/${category}/${serviceId}/trips/${trip.id}`)}
                        className="group w-full rounded-2xl bg-white border border-border/50 shadow-sm hover:shadow-lg transition-all active:scale-[0.99] overflow-hidden text-left"
                      >
                        {/* Left accent line via border */}
                        <div className="flex">
                          <div className={`w-1.5 shrink-0 bg-gradient-to-b ${accent.gradient}`} />

                          <div className="flex-1 p-4">
                            {/* Top row: route + agency */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="min-w-0">
                                <p className="text-[15px] font-extrabold text-foreground truncate">{route?.origin} → {route?.destination}</p>
                                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                                  <Bus className="h-3 w-3" />{service?.display_name}
                                  {trip.vehicle_info && <span className="text-muted-foreground/40">· {trip.vehicle_info}</span>}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-lg font-black text-foreground leading-none">{trip.price.toLocaleString()}</p>
                                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase">{trip.currency}</p>
                              </div>
                            </div>

                            {/* Info chips */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold" style={{ backgroundColor: accent.light, color: accent.text }}>
                                <Calendar className="h-3 w-3" />{format(new Date(trip.departure_at), 'EEE, dd MMM')}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px] font-bold text-foreground">
                                <Clock className="h-3 w-3 text-muted-foreground" />{format(new Date(trip.departure_at), 'HH:mm')} — {format(new Date(trip.arrival_at), 'HH:mm')}
                              </span>
                            </div>

                            {/* Bottom: seats bar + arrow */}
                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Users className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                <div className="flex-1 max-w-[120px]">
                                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${seatsLow ? 'bg-destructive' : `bg-gradient-to-r ${accent.gradient}`}`} style={{ width: `${seatPercent}%` }} />
                                  </div>
                                </div>
                                <span className={`text-[11px] font-bold ${seatsLow ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {trip.available_seats} seats
                                </span>
                                {seatsLow && <Badge className="border-0 bg-destructive/10 text-destructive text-[9px] h-4 px-1.5 font-bold">Low</Badge>}
                              </div>
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted group-hover:bg-primary group-hover:text-white transition-colors">
                                <ArrowRight className="h-4 w-4" />
                              </div>
                            </div>
                          </div>
                        </div>
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
