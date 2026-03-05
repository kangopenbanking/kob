import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Clock, Calendar, Users, Loader2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Route {
  id: string; origin: string; destination: string;
  distance_km: number | null; estimated_duration_minutes: number | null;
}

interface Trip {
  id: string; route_id: string; departure_at: string; arrival_at: string;
  price: number; currency: string; available_seats: number; status: string;
  vehicle_info: string | null; seating_plan_id: string | null;
}

interface ServiceInfo {
  display_name: string; service_type: string; theme_color: string | null;
}

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

const CustomerTravelTrips: React.FC = () => {
  const { category, serviceId } = useParams<{ category: string; serviceId: string }>();
  const navigate = useNavigate();
  const [service, setService] = useState<ServiceInfo | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [svcRes, routeRes] = await Promise.all([
        supabase.from('travel_services').select('display_name, service_type, theme_color').eq('id', serviceId || '').maybeSingle(),
        supabase.from('travel_routes').select('id, origin, destination, distance_km, estimated_duration_minutes').eq('service_id', serviceId || '').eq('is_active', true),
      ]);

      setService(svcRes.data as any);
      const routeData = (routeRes.data as any[]) || [];
      setRoutes(routeData);

      if (routeData.length > 0) {
        const routeIds = routeData.map(r => r.id);
        const { data: tripData } = await supabase
          .from('travel_trips')
          .select('*')
          .in('route_id', routeIds)
          .in('status', ['scheduled', 'boarding'])
          .gte('departure_at', new Date().toISOString())
          .order('departure_at', { ascending: true });
        setTrips((tripData as any[]) || []);
      }
      setLoading(false);
    };
    fetch();
  }, [serviceId]);

  const filteredTrips = selectedRoute ? trips.filter(t => t.route_id === selectedRoute) : trips;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-3 backdrop-blur-sm border-b">
        <button onClick={() => navigate(`/app/travel/${category}`)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">{service?.display_name || 'Agency'}</h1>
          <p className="text-xs text-muted-foreground">{routes.length} routes · {trips.length} upcoming trips</p>
        </div>
      </div>

      <div className="px-4 py-4 pb-24 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Route Filter */}
            {routes.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedRoute(null)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${!selectedRoute ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  All Routes
                </button>
                {routes.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoute(r.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${selectedRoute === r.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    {r.origin} → {r.destination}
                  </button>
                ))}
              </div>
            )}

            {/* Routes Overview */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Routes</p>
              <div className="space-y-2">
                {routes.map((route, i) => (
                  <motion.div key={route.id} {...fadeUp} transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{route.origin} → {route.destination}</p>
                      <p className="text-xs text-muted-foreground">
                        {route.distance_km ? `${route.distance_km} km` : ''}
                        {route.estimated_duration_minutes ? ` · ${Math.floor(route.estimated_duration_minutes / 60)}h ${route.estimated_duration_minutes % 60}m` : ''}
                      </p>
                    </div>
                    <Badge variant="outline">{trips.filter(t => t.route_id === route.id).length} trips</Badge>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Trips */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Available Journeys</p>
              {filteredTrips.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border bg-muted/30 py-10 text-center">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                  <p className="font-semibold text-muted-foreground">No upcoming trips</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTrips.map((trip, i) => {
                    const route = routes.find(r => r.id === trip.route_id);
                    return (
                      <motion.button
                        key={trip.id}
                        {...fadeUp}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => navigate(`/app/travel/${category}/${serviceId}/trips/${trip.id}`)}
                        className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-transform active:scale-[0.98]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground">{route?.origin} → {route?.destination}</p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{format(new Date(trip.departure_at), 'HH:mm')}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(new Date(trip.departure_at), 'dd MMM')}</span>
                            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{trip.available_seats} seats</span>
                          </div>
                          {trip.vehicle_info && <p className="mt-0.5 text-xs text-muted-foreground">{trip.vehicle_info}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-black text-foreground">{trip.price.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">{trip.currency}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
