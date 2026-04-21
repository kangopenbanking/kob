import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Clock, Calendar, Users, Loader2, ArrowRight, Route as RouteIcon, Ticket, Star, Shield, ChevronRight, SlidersHorizontal, ArrowUpDown, X, CheckCircle, Sunrise, Sun, Moon, Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { getTheme } from '@/lib/travel-theme';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

interface RouteType { id: string; origin: string; destination: string; distance_km: number | null; estimated_duration_minutes: number | null; }
interface Trip { id: string; route_id: string; departure_at: string; arrival_at: string; price: number; currency: string; available_seats: number; status: string; vehicle_info: string | null; seating_plan_id: string | null; }
interface ServiceInfo { display_name: string; service_type: string; theme_color: string | null; }

const CustomerTravelTrips: React.FC = () => {
  const tr = useHarvestedT('customer');
  const { category, serviceId } = useParams<{ category: string; serviceId: string }>();
  const navigate = useNavigate();
  const theme = getTheme(category);
  const CatIcon = theme.icon;

  const [service, setService] = useState<ServiceInfo | null>(null);
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [userBookedRouteIds, setUserBookedRouteIds] = useState<string[]>([]);
  const [routeBookingCounts, setRouteBookingCounts] = useState<Record<string, number>>({});
  const sliderRef = useRef<HTMLDivElement>(null);

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

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userBookings } = await supabase.from('travel_bookings')
            .select('trip_id, created_at').eq('user_id', user.id).eq('booking_status', 'confirmed')
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

        const { data: allBookings } = await supabase.from('travel_bookings').select('trip_id').eq('booking_status', 'confirmed');
        if (allBookings && allBookings.length > 0) {
          const allTripIds = allBookings.map((b: any) => b.trip_id);
          const { data: allBookedTrips } = await supabase.from('travel_trips').select('id, route_id').in('id', allTripIds);
          const globalCounts: Record<string, number> = {};
          (allBookedTrips || []).forEach((t: any) => { globalCounts[t.route_id] = (globalCounts[t.route_id] || 0) + 1; });
          setRouteBookingCounts(prev => {
            const merged = { ...globalCounts };
            Object.keys(prev).forEach(k => { merged[k] = (merged[k] || 0) + (prev[k] || 0) * 2; });
            return merged;
          });
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [serviceId]);

  const filteredTrips = (() => {
    let result = selectedRoute ? trips.filter(t => t.route_id === selectedRoute) : [...trips];
    if (timeFilter !== 'all') {
      result = result.filter(t => {
        const hour = new Date(t.departure_at).getHours();
        if (timeFilter === 'morning') return hour >= 5 && hour < 12;
        if (timeFilter === 'afternoon') return hour >= 12 && hour < 17;
        if (timeFilter === 'evening') return hour >= 17 || hour < 5;
        return true;
      });
    }
    result.sort((a, b) => {
      if (sortBy === 'price_low') return a.price - b.price;
      if (sortBy === 'price_high') return b.price - a.price;
      if (sortBy === 'seats') return b.available_seats - a.available_seats;
      return new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime();
    });
    return result;
  })();

  const activeFilterCount = (timeFilter !== 'all' ? 1 : 0) + (sortBy !== 'departure' ? 1 : 0);

  const sortedRoutes = [...routes].sort((a, b) => {
    const aIdx = userBookedRouteIds.indexOf(a.id);
    const bIdx = userBookedRouteIds.indexOf(b.id);
    if (aIdx !== -1 && bIdx === -1) return -1;
    if (aIdx === -1 && bIdx !== -1) return 1;
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    return (routeBookingCounts[b.id] || 0) - (routeBookingCounts[a.id] || 0);
  });

  const scrollSlider = (dir: 'left' | 'right') => {
    sliderRef.current?.scrollBy({ left: dir === 'right' ? 200 : -200, behavior: 'smooth' });
  };

  // Overlay color helpers
  const overlayBg = theme.fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';
  const overlayBgStrong = theme.fg === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)';

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.lightBg }}>
      {/* ── Themed Header ── */}
      <div className="relative overflow-hidden px-5 pb-8 pt-4" style={{ backgroundColor: theme.color }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(`/app/travel/${category}`)} className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-95 transition-transform" style={{ backgroundColor: overlayBg }}>
              <ChevronLeft className="h-5 w-5" style={{ color: theme.fg }} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold truncate" style={{ color: theme.fg }}>{service?.display_name || 'Agency'}</h1>
                <Shield className="h-4 w-4 shrink-0" style={{ color: theme.fg, opacity: 0.7 }} />
              </div>
              <p className="text-[12px] flex items-center gap-2 mt-0.5" style={{ color: theme.fg, opacity: 0.5 }}>
                <span className="flex items-center gap-1"><RouteIcon className="h-3 w-3" />{routes.length} routes</span>
                <span style={{ opacity: 0.4 }}>·</span>
                <span className="flex items-center gap-1"><Ticket className="h-3 w-3" />{trips.length} trips</span>
              </p>
            </div>
          </div>

          {/* Quick info */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 rounded-xl p-2.5 text-center" style={{ backgroundColor: overlayBg }}>
              <p className="text-lg font-black" style={{ color: theme.fg }}>{routes.length}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: theme.fg, opacity: 0.4 }}>{tr('Routes')}</p>
            </div>
            <div className="flex-1 rounded-xl p-2.5 text-center" style={{ backgroundColor: overlayBg }}>
              <p className="text-lg font-black" style={{ color: theme.fg }}>{trips.length}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: theme.fg, opacity: 0.4 }}>{tr('Trips')}</p>
            </div>
            <div className="flex-1 rounded-xl p-2.5 text-center" style={{ backgroundColor: overlayBg }}>
              <CheckCircle className="h-5 w-5 mx-auto" style={{ color: theme.fg, opacity: 0.7 }} />
              <p className="text-[9px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: theme.fg, opacity: 0.4 }}>{tr('Verified')}</p>
            </div>
          </div>

          {/* Route pills */}
          {routes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button onClick={() => setSelectedRoute(null)}
                className="shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold transition-all"
                style={!selectedRoute ? { backgroundColor: theme.fg, color: theme.color } : { backgroundColor: overlayBg, color: theme.fg, opacity: 0.7 }}>
                All Routes
              </button>
              {routes.map(r => (
                <button key={r.id} onClick={() => setSelectedRoute(r.id)}
                  className="shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold transition-all"
                  style={selectedRoute === r.id ? { backgroundColor: theme.fg, color: theme.color } : { backgroundColor: overlayBg, color: theme.fg, opacity: 0.7 }}>
                  {r.origin} → {r.destination}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 px-0 pt-6 -mt-4 pb-24 space-y-5">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-[#0f1729]/20" /></div>
        ) : (
          <>
            {/* ═══ FILTER BAR ═══ */}
            <div className="px-5 space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowFilters(p => !p)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-all shadow-sm"
                  style={showFilters ? { backgroundColor: theme.color, color: theme.fg } : { backgroundColor: 'white', color: '#0f1729' }}>
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black" style={{ backgroundColor: theme.fg === '#ffffff' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)' }}>{activeFilterCount}</span>
                  )}
                </button>

                <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1">
                  {([
                    { key: 'departure' as SortOption, label: 'Soonest' },
                    { key: 'price_low' as SortOption, label: 'Cheapest' },
                    { key: 'price_high' as SortOption, label: 'Priciest' },
                    { key: 'seats' as SortOption, label: 'Most Seats' },
                  ]).map(s => (
                    <button key={s.key} onClick={() => setSortBy(s.key)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all border"
                      style={sortBy === s.key ? { backgroundColor: theme.color, color: theme.fg, borderColor: theme.color } : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }}>
                      <ArrowUpDown className="h-2.5 w-2.5" />{s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time of day filter */}
              <div className="rounded-2xl bg-white border border-gray-100 p-3.5 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#0f1729]/40 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Time of Day
                  </p>
                  {activeFilterCount > 0 && (
                    <button onClick={() => { setTimeFilter('all'); setSortBy('departure'); }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 hover:underline">
                      <X className="h-3 w-3" /> Clear all
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  {([
                    { key: 'all' as TimeFilter, label: 'Any Time', Icon: Timer, activeBg: '#f3f4f6', activeBorder: '#d1d5db', activeText: '#374151', activeIcon: '#6b7280' },
                    { key: 'morning' as TimeFilter, label: 'Morning', Icon: Sunrise, activeBg: '#fef3c7', activeBorder: '#f59e0b', activeText: '#92400e', activeIcon: '#f59e0b' },
                    { key: 'afternoon' as TimeFilter, label: 'Afternoon', Icon: Sun, activeBg: '#ffedd5', activeBorder: '#f97316', activeText: '#9a3412', activeIcon: '#f97316' },
                    { key: 'evening' as TimeFilter, label: 'Evening', Icon: Moon, activeBg: '#e0e7ff', activeBorder: '#6366f1', activeText: '#3730a3', activeIcon: '#6366f1' },
                  ]).map(t => (
                    <button key={t.key} onClick={() => setTimeFilter(t.key)}
                      className="flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-bold transition-all border"
                      style={timeFilter === t.key
                        ? { backgroundColor: t.activeBg, borderColor: t.activeBorder, color: t.activeText }
                        : { backgroundColor: '#f9fafb', borderColor: '#f3f4f6', color: '#9ca3af' }}>
                      <t.Icon className="h-4 w-4" style={{ color: timeFilter === t.key ? t.activeIcon : '#9ca3af' }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ ROUTE SLIDER ═══ */}
            <div>
              <div className="flex items-center justify-between px-5 mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#0f1729]/40 flex items-center gap-1.5">
                  <RouteIcon className="h-3.5 w-3.5" /> Popular Routes
                </p>
                <div className="flex gap-1">
                  <button onClick={() => scrollSlider('left')} className="flex h-6 w-6 items-center justify-center rounded-full bg-white border shadow-sm active:scale-90 transition-transform">
                    <ChevronLeft className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                  <button onClick={() => scrollSlider('right')} className="flex h-6 w-6 items-center justify-center rounded-full bg-white border shadow-sm active:scale-90 transition-transform">
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              </div>
              <div ref={sliderRef} className="flex gap-3 overflow-x-auto scrollbar-none px-5 snap-x snap-mandatory">
                {sortedRoutes.map((route, i) => {
                  const tripCount = trips.filter(t => t.route_id === route.id).length;
                  const isActive = selectedRoute === route.id;
                  const isUserBooked = userBookedRouteIds.includes(route.id);
                  return (
                    <motion.button key={route.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedRoute(isActive ? null : route.id)}
                      className={`shrink-0 snap-start w-[220px] rounded-2xl p-4 text-left shadow-lg transition-all relative overflow-hidden ${isActive ? 'ring-2 scale-[1.02]' : 'hover:scale-[1.01]'}`}
                      style={{ backgroundColor: theme.color }}>
                      {isUserBooked && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ backgroundColor: overlayBg, color: theme.fg }}>
                            <Star className="h-2.5 w-2.5 mr-0.5" /> Recent
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: overlayBg }}>
                          <CatIcon className="h-3 w-3" style={{ color: theme.fg, opacity: 0.8 }} />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: theme.fg, opacity: 0.6 }}>{service?.display_name}</span>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: overlayBg }}>
                            <MapPin className="h-3 w-3" style={{ color: theme.fg, opacity: 0.9 }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: theme.fg, opacity: 0.4 }}>{tr('From')}</p>
                            <p className="text-[13px] font-extrabold truncate" style={{ color: theme.fg }}>{route.origin}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pl-[11px]">
                          <div className="w-0.5 h-3 rounded-full" style={{ backgroundColor: theme.fg, opacity: 0.2 }} />
                          {route.estimated_duration_minutes && (
                            <span className="text-[9px] font-semibold flex items-center gap-1" style={{ color: theme.fg, opacity: 0.4 }}>
                              <Clock className="h-2.5 w-2.5" />
                              {Math.floor(route.estimated_duration_minutes / 60)}h{route.estimated_duration_minutes % 60 > 0 ? `${route.estimated_duration_minutes % 60}m` : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: overlayBg }}>
                            <MapPin className="h-3 w-3" style={{ color: theme.fg }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: theme.fg, opacity: 0.4 }}>{tr('To')}</p>
                            <p className="text-[13px] font-extrabold truncate" style={{ color: theme.fg }}>{route.destination}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2.5" style={{ borderTop: `1px solid ${theme.fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}` }}>
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: overlayBg, color: theme.fg }}>
                          <Ticket className="h-2 w-2" /> {tripCount} trip{tripCount !== 1 ? 's' : ''}
                        </span>
                        {route.distance_km && (
                          <span className="text-[9px] font-semibold flex items-center gap-1" style={{ color: theme.fg, opacity: 0.45 }}>
                            <RouteIcon className="h-2 w-2" /> {route.distance_km} km
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ═══ TRIP LIST ═══ */}
            <div className="px-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#0f1729]/40 flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5" /> Available Journeys
                </p>
                <span className="text-[11px] font-semibold" style={{ color: theme.color }}>{filteredTrips.length} found</span>
              </div>

              {filteredTrips.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-white py-14 text-center shadow-sm">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.accentLight }}>
                    <Calendar className="h-7 w-7" style={{ color: theme.color }} />
                  </div>
                  <p className="font-bold text-[#0f1729]">{tr('No upcoming trips')}</p>
                  <p className="text-[12px] text-[#0f1729]/40 max-w-[200px]">{tr('Check back later for new schedules')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTrips.map((trip, i) => {
                    const route = routes.find(r => r.id === trip.route_id);
                    const seatsLow = trip.available_seats <= 5;
                    const seatPercent = Math.max(0, Math.min(100, (trip.available_seats / 50) * 100));

                    return (
                      <motion.button key={trip.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => navigate(`/app/travel/${category}/${serviceId}/trips/${trip.id}`)}
                        className="group w-full rounded-2xl bg-white shadow-sm hover:shadow-lg transition-all active:scale-[0.99] overflow-hidden text-left">
                        <div className="flex">
                          {/* Themed left border */}
                          <div className="w-1.5 shrink-0" style={{ backgroundImage: `repeating-linear-gradient(to bottom, ${theme.color} 0px, ${theme.color} 4px, transparent 4px, transparent 8px)` }} />

                          <div className="flex-1 py-4 px-4">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="min-w-0">
                                <p className="text-[15px] font-extrabold text-[#0f1729] truncate">{route?.origin} → {route?.destination}</p>
                                <p className="text-[11px] text-[#0f1729]/40 flex items-center gap-1 mt-0.5">
                                  <CatIcon className="h-3 w-3" />{service?.display_name}
                                  {trip.vehicle_info && <span className="opacity-60">· {trip.vehicle_info}</span>}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-lg font-black text-[#0f1729] leading-none">{trip.price.toLocaleString()}</p>
                                <p className="text-[10px] font-semibold text-[#0f1729]/35 uppercase">{trip.currency}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold" style={{ backgroundColor: theme.accentLight, color: theme.accentText }}>
                                <Calendar className="h-3 w-3" />{format(new Date(trip.departure_at), 'EEE, dd MMM')}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] font-bold text-[#0f1729]">
                                <Clock className="h-3 w-3 text-gray-400" />{format(new Date(trip.departure_at), 'HH:mm')} — {format(new Date(trip.arrival_at), 'HH:mm')}
                              </span>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <div className="flex-1 max-w-[120px]">
                                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${seatPercent}%`, backgroundColor: seatsLow ? '#ef4444' : theme.color }} />
                                  </div>
                                </div>
                                <span className={`text-[11px] font-bold ${seatsLow ? 'text-red-500' : 'text-[#0f1729]/50'}`}>
                                  {trip.available_seats} seats
                                </span>
                                {seatsLow && <Badge className="border-0 bg-red-50 text-red-500 text-[9px] h-4 px-1.5 font-bold">{tr('Low')}</Badge>}
                              </div>
                              <div className="flex h-8 w-8 items-center justify-center rounded-full transition-colors" style={{ backgroundColor: theme.accentLight }}>
                                <ArrowRight className="h-4 w-4" style={{ color: theme.color }} />
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
