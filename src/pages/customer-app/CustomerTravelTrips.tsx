import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Clock, Calendar, Users, Loader2, ArrowRight, Route as RouteIcon, Ticket, Star, Bus, Shield, ChevronRight, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';
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
  const [userBookedRouteIds, setUserBookedRouteIds] = useState<string[]>([]);
  const [routeBookingCounts, setRouteBookingCounts] = useState<Record<string, number>>({});
  const sliderRef = useRef<HTMLDivElement>(null);

  // Filters
  type SortOption = 'departure' | 'price_low' | 'price_high' | 'seats';
  type TimeFilter = 'all' | 'morning' | 'afternoon' | 'evening';
  const [sortBy, setSortBy] = useState<SortOption>('departure');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

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
        const routeIds = routeData.map(r => r.id);
        const { data: tripData } = await supabase.from('travel_trips').select('*')
          .in('route_id', routeIds).in('status', ['scheduled', 'boarding'])
          .gte('departure_at', new Date().toISOString()).order('departure_at', { ascending: true });
        setTrips((tripData as any[]) || []);

        // Fetch user's booking history for sorting
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userBookings } = await supabase.from('travel_bookings')
            .select('trip_id, created_at')
            .eq('user_id', user.id)
            .eq('booking_status', 'confirmed')
            .order('created_at', { ascending: false });

          if (userBookings && userBookings.length > 0) {
            const tripIds = userBookings.map((b: any) => b.trip_id);
            const { data: bookedTrips } = await supabase.from('travel_trips').select('id, route_id').in('id', tripIds);
            const bookedRouteOrder: string[] = [];
            const counts: Record<string, number> = {};
            (bookedTrips || []).forEach((t: any) => {
              if (!bookedRouteOrder.includes(t.route_id)) bookedRouteOrder.push(t.route_id);
              counts[t.route_id] = (counts[t.route_id] || 0) + 1;
            });
            setUserBookedRouteIds(bookedRouteOrder);
            setRouteBookingCounts(counts);
          }
        }

        // Global booking counts per route for "most booked"
        const { data: allBookings } = await supabase.from('travel_bookings')
          .select('trip_id')
          .eq('booking_status', 'confirmed');
        if (allBookings && allBookings.length > 0) {
          const allTripIds = allBookings.map((b: any) => b.trip_id);
          const { data: allBookedTrips } = await supabase.from('travel_trips').select('id, route_id').in('id', allTripIds);
          const globalCounts: Record<string, number> = {};
          (allBookedTrips || []).forEach((t: any) => {
            globalCounts[t.route_id] = (globalCounts[t.route_id] || 0) + 1;
          });
          setRouteBookingCounts(prev => {
            const merged = { ...globalCounts };
            // User's own routes get a boost
            Object.keys(prev).forEach(k => { merged[k] = (merged[k] || 0) + (prev[k] || 0) * 2; });
            return merged;
          });
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [serviceId]);

  const filteredTrips = selectedRoute ? trips.filter(t => t.route_id === selectedRoute) : trips;

  const routeAccents = [
    { solid: 'bg-gradient-to-br from-[hsl(217,91%,55%)] to-[hsl(230,80%,42%)]', light: 'hsl(217,80%,96%)', text: 'hsl(217,80%,40%)', dotColor: 'hsl(217,91%,55%)' },
    { solid: 'bg-gradient-to-br from-[hsl(150,60%,38%)] to-[hsl(165,55%,28%)]', light: 'hsl(150,50%,95%)', text: 'hsl(150,60%,28%)', dotColor: 'hsl(150,60%,40%)' },
    { solid: 'bg-gradient-to-br from-[hsl(38,92%,50%)] to-[hsl(25,88%,42%)]', light: 'hsl(38,80%,95%)', text: 'hsl(38,70%,30%)', dotColor: 'hsl(38,92%,50%)' },
    { solid: 'bg-gradient-to-br from-[hsl(258,80%,55%)] to-[hsl(275,72%,42%)]', light: 'hsl(258,60%,96%)', text: 'hsl(258,60%,35%)', dotColor: 'hsl(258,80%,58%)' },
    { solid: 'bg-gradient-to-br from-[hsl(172,66%,38%)] to-[hsl(185,60%,28%)]', light: 'hsl(172,50%,95%)', text: 'hsl(172,55%,28%)', dotColor: 'hsl(172,66%,40%)' },
    { solid: 'bg-gradient-to-br from-[hsl(347,77%,48%)] to-[hsl(335,72%,38%)]', light: 'hsl(347,60%,96%)', text: 'hsl(347,60%,35%)', dotColor: 'hsl(347,77%,50%)' },
  ];

  // Sort routes: user's recently booked first, then most booked globally
  const sortedRoutes = [...routes].sort((a, b) => {
    const aUserIdx = userBookedRouteIds.indexOf(a.id);
    const bUserIdx = userBookedRouteIds.indexOf(b.id);
    if (aUserIdx !== -1 && bUserIdx === -1) return -1;
    if (aUserIdx === -1 && bUserIdx !== -1) return 1;
    if (aUserIdx !== -1 && bUserIdx !== -1) return aUserIdx - bUserIdx;
    return (routeBookingCounts[b.id] || 0) - (routeBookingCounts[a.id] || 0);
  });

  const scrollSlider = (dir: 'left' | 'right') => {
    sliderRef.current?.scrollBy({ left: dir === 'right' ? 200 : -200, behavior: 'smooth' });
  };

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

      <div className="relative z-10 px-0 pt-3 -mt-4 pb-24 space-y-5">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* ═══ ROUTE SLIDER ═══ */}
            <div>
              <div className="flex items-center justify-between px-4 mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-1.5">
                  <RouteIcon className="h-3.5 w-3.5" /> Popular Routes
                </p>
                <div className="flex gap-1">
                  <button onClick={() => scrollSlider('left')} className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-border/50 shadow-sm active:scale-90 transition-transform">
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => scrollSlider('right')} className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-border/50 shadow-sm active:scale-90 transition-transform">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div ref={sliderRef} className="flex gap-3 overflow-x-auto scrollbar-none px-4 snap-x snap-mandatory">
                {sortedRoutes.map((route, i) => {
                  const accent = routeAccents[i % routeAccents.length];
                  const tripCount = trips.filter(t => t.route_id === route.id).length;
                  const isActive = selectedRoute === route.id;
                  const isUserBooked = userBookedRouteIds.includes(route.id);
                  return (
                    <motion.button
                      key={route.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedRoute(isActive ? null : route.id)}
                      className={`shrink-0 snap-start w-[220px] rounded-2xl p-4 text-left shadow-lg transition-all relative overflow-hidden ${accent.solid} ${isActive ? 'ring-3 ring-white/40 scale-[1.02]' : 'hover:scale-[1.01]'}`}
                    >
                      {/* Recent badge */}
                      {isUserBooked && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="inline-flex items-center rounded-full bg-white/20 backdrop-blur-sm px-2 py-0.5 text-[8px] font-bold text-white uppercase tracking-wider">
                            <Star className="h-2.5 w-2.5 mr-0.5" /> Recent
                          </span>
                        </div>
                      )}

                      {/* Agency name */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-white/30 bg-white/10">
                          <Bus className="h-3 w-3 text-white/80" />
                        </div>
                        <span className="text-[9px] font-bold text-white/60 uppercase tracking-wider truncate">{service?.display_name}</span>
                      </div>

                      <div className="space-y-2.5">
                        {/* Origin */}
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/25 bg-white/10 shrink-0">
                            <MapPin className="h-3 w-3 text-white/90" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">From</p>
                            <p className="text-[13px] font-extrabold text-white truncate">{route.origin}</p>
                          </div>
                        </div>

                        {/* Connector line + duration */}
                        <div className="flex items-center gap-2 pl-[11px]">
                          <div className="w-0.5 h-3 bg-white/20 rounded-full" />
                          {route.estimated_duration_minutes && (
                            <span className="text-[9px] font-semibold text-white/40 flex items-center gap-1">
                              <div className="flex h-4 w-4 items-center justify-center rounded border border-white/20 bg-white/5">
                                <Clock className="h-2.5 w-2.5 text-white/60" />
                              </div>
                              {Math.floor(route.estimated_duration_minutes / 60)}h{route.estimated_duration_minutes % 60 > 0 ? `${route.estimated_duration_minutes % 60}m` : ''}
                            </span>
                          )}
                        </div>

                        {/* Destination */}
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/25 bg-white/10 shrink-0">
                            <MapPin className="h-3 w-3 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">To</p>
                            <p className="text-[13px] font-extrabold text-white truncate">{route.destination}</p>
                          </div>
                        </div>
                      </div>

                      {/* Footer with more details */}
                      <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-white/15">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold text-white">
                          <div className="flex h-3.5 w-3.5 items-center justify-center rounded border border-white/30">
                            <Ticket className="h-2 w-2 text-white" />
                          </div>
                          {tripCount} trip{tripCount !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-white/45">
                          {route.distance_km && (
                            <>
                              <div className="flex h-3.5 w-3.5 items-center justify-center rounded border border-white/20">
                                <RouteIcon className="h-2 w-2 text-white/60" />
                              </div>
                              {route.distance_km} km
                            </>
                          )}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ═══ TRIP LIST ═══ */}
            <div className="px-4">
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
                        <div className="flex">
                          {/* Dotted left border */}
                          <div className="w-4 shrink-0 flex items-center justify-center py-3">
                            <div className="h-full w-0 border-l-[3px] border-dotted" style={{ borderColor: accent.dotColor }} />
                          </div>

                          <div className="flex-1 py-4 pr-4">
                            {/* Top row: route + price */}
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
                                    <div className={`h-full rounded-full transition-all`} style={{ width: `${seatPercent}%`, background: seatsLow ? undefined : accent.dotColor, backgroundColor: seatsLow ? 'hsl(0,84%,60%)' : undefined }} />
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
