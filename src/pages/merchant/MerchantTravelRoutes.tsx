import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, MapPin, Clock, Calendar, Trash2, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface TravelService { id: string; display_name: string; service_type: string; }
interface TravelRoute {
  id: string; service_id: string; origin: string; destination: string;
  distance_km: number | null; estimated_duration_minutes: number | null; is_active: boolean;
}
interface SeatingPlan { id: string; plan_name: string; total_seats: number; service_id: string; }
interface TravelTrip {
  id: string; route_id: string; seating_plan_id: string | null;
  departure_at: string; arrival_at: string; price: number; currency: string;
  available_seats: number; status: string; vehicle_info: string | null;
}

const MerchantTravelRoutes: React.FC = () => {
  const [services, setServices] = useState<TravelService[]>([]);
  const [routes, setRoutes] = useState<TravelRoute[]>([]);
  const [plans, setPlans] = useState<SeatingPlan[]>([]);
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // Route form
  const [routeOpen, setRouteOpen] = useState(false);
  const [routeServiceId, setRouteServiceId] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [savingRoute, setSavingRoute] = useState(false);

  // Trip form
  const [tripOpen, setTripOpen] = useState(false);
  const [tripRouteId, setTripRouteId] = useState('');
  const [tripPlanId, setTripPlanId] = useState('');
  const [tripDeparture, setTripDeparture] = useState('');
  const [tripArrival, setTripArrival] = useState('');
  const [tripPrice, setTripPrice] = useState('');
  const [tripVehicle, setTripVehicle] = useState('');
  const [savingTrip, setSavingTrip] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
    if (!merchant) { setLoading(false); return; }
    setMerchantId(merchant.id);

    const svcIds = ((await supabase.from('travel_services').select('id').eq('merchant_id', merchant.id)).data || []).map((s: any) => s.id);

    const [svcRes, routeRes, planRes] = await Promise.all([
      supabase.from('travel_services').select('id, display_name, service_type').eq('merchant_id', merchant.id),
      supabase.from('travel_routes').select('*').in('service_id', svcIds),
      supabase.from('travel_seating_plans').select('id, plan_name, total_seats, service_id').in('service_id', svcIds),
    ]);

    setServices((svcRes.data as any[]) || []);
    const routeData = (routeRes.data as any[]) || [];
    setRoutes(routeData);
    setPlans((planRes.data as any[]) || []);

    if (routeData.length > 0) {
      const { data: tripData } = await supabase.from('travel_trips').select('*').in('route_id', routeData.map(r => r.id)).order('departure_at', { ascending: true });
      setTrips((tripData as any[]) || []);
    }
    setLoading(false);
  };

  const handleCreateRoute = async () => {
    if (!routeServiceId || !origin.trim() || !destination.trim()) return;
    setSavingRoute(true);
    const { error } = await supabase.from('travel_routes').insert({
      service_id: routeServiceId,
      origin: origin.trim(),
      destination: destination.trim(),
      distance_km: distanceKm ? Number(distanceKm) : null,
      estimated_duration_minutes: durationMin ? Number(durationMin) : null,
    } as any);
    if (error) toast.error(extractEdgeFunctionError(error));
    else { toast.success('Route created!'); setRouteOpen(false); fetchData(); }
    setSavingRoute(false);
  };

  const handleCreateTrip = async () => {
    if (!tripRouteId || !tripDeparture || !tripArrival || !tripPrice) return;
    setSavingTrip(true);
    const plan = plans.find(p => p.id === tripPlanId);
    const { error } = await supabase.from('travel_trips').insert({
      route_id: tripRouteId,
      seating_plan_id: tripPlanId || null,
      departure_at: tripDeparture,
      arrival_at: tripArrival,
      price: Number(tripPrice),
      currency: 'XAF',
      available_seats: plan?.total_seats || 0,
      vehicle_info: tripVehicle.trim() || null,
    } as any);
    if (error) toast.error(extractEdgeFunctionError(error));
    else { toast.success('Trip scheduled!'); setTripOpen(false); fetchData(); }
    setSavingTrip(false);
  };

  const deleteRoute = async (id: string) => {
    const { error } = await supabase.from('travel_routes').delete().eq('id', id);
    if (error) toast.error(extractEdgeFunctionError(error)); else { toast.success('Route deleted'); fetchData(); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Routes & Trips</h1>
          <p className="text-sm text-muted-foreground">Manage your travel corridors and schedule trips</p>
        </div>
      </div>

      <Tabs defaultValue="routes">
        <TabsList><TabsTrigger value="routes">Routes</TabsTrigger><TabsTrigger value="trips">Trips</TabsTrigger></TabsList>

        <TabsContent value="routes" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setRouteServiceId(services[0]?.id || ''); setOrigin(''); setDestination(''); setDistanceKm(''); setDurationMin(''); setRouteOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Route
            </Button>
          </div>
          {routes.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No routes yet. Add your first route!</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {routes.map((route) => {
                const svc = services.find(s => s.id === route.service_id);
                return (
                  <Card key={route.id}>
                    <CardContent className="flex flex-wrap items-center gap-3 py-4">
                      <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1 basis-[60%]">
                        <p className="font-semibold truncate">{route.origin} → {route.destination}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {svc?.display_name} · {route.distance_km ? `${route.distance_km} km` : ''} {route.estimated_duration_minutes ? `· ${route.estimated_duration_minutes} min` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-auto shrink-0">
                        <Badge variant={route.is_active ? 'default' : 'secondary'}>{route.is_active ? 'Active' : 'Inactive'}</Badge>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteRoute(route.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="trips" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setTripRouteId(routes[0]?.id || ''); setTripPlanId(''); setTripDeparture(''); setTripArrival(''); setTripPrice(''); setTripVehicle(''); setTripOpen(true); }} disabled={routes.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> Schedule Trip
            </Button>
          </div>
          {trips.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No trips scheduled yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => {
                const route = routes.find(r => r.id === trip.route_id);
                const plan = plans.find(p => p.id === trip.seating_plan_id);
                return (
                  <Card key={trip.id}>
                    <CardContent className="flex flex-wrap items-center gap-3 py-4">
                      <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1 basis-[60%]">
                        <p className="font-semibold truncate">{route ? `${route.origin} → ${route.destination}` : 'Unknown route'}</p>
                        <p className="text-xs text-muted-foreground break-words">
                          {format(new Date(trip.departure_at), 'PPp')} · {trip.price.toLocaleString()} {trip.currency} · {trip.available_seats} seats left
                          {plan ? ` · ${plan.plan_name}` : ''}
                        </p>
                      </div>
                      <Badge variant={trip.status === 'scheduled' ? 'default' : 'secondary'} className="ml-auto shrink-0">{trip.status}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Route Dialog */}
      <Dialog open={routeOpen} onOpenChange={setRouteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Route</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={routeServiceId} onValueChange={setRouteServiceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Origin</Label><Input placeholder="e.g. Douala" value={origin} onChange={e => setOrigin(e.target.value)} /></div>
              <div className="space-y-2"><Label>Destination</Label><Input placeholder="e.g. Yaoundé" value={destination} onChange={e => setDestination(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Distance (km)</Label><Input type="number" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} /></div>
              <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" value={durationMin} onChange={e => setDurationMin(e.target.value)} /></div>
            </div>
            <Button onClick={handleCreateRoute} disabled={savingRoute || !origin.trim() || !destination.trim()} className="w-full">
              {savingRoute && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Route
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trip Dialog */}
      <Dialog open={tripOpen} onOpenChange={setTripOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Trip</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Route</Label>
              <Select value={tripRouteId} onValueChange={setTripRouteId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{routes.map(r => <SelectItem key={r.id} value={r.id}>{r.origin} → {r.destination}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Seating Plan</Label>
              <Select value={tripPlanId} onValueChange={setTripPlanId}>
                <SelectTrigger><SelectValue placeholder="Select seating plan" /></SelectTrigger>
                <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.plan_name} ({p.total_seats} seats)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Departure</Label><Input type="datetime-local" value={tripDeparture} onChange={e => setTripDeparture(e.target.value)} /></div>
              <div className="space-y-2"><Label>Arrival</Label><Input type="datetime-local" value={tripArrival} onChange={e => setTripArrival(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Price (XAF)</Label><Input type="number" value={tripPrice} onChange={e => setTripPrice(e.target.value)} /></div>
              <div className="space-y-2"><Label>Vehicle Info</Label><Input placeholder="e.g. Bus LT-4523" value={tripVehicle} onChange={e => setTripVehicle(e.target.value)} /></div>
            </div>
            <Button onClick={handleCreateTrip} disabled={savingTrip || !tripRouteId || !tripDeparture || !tripPrice} className="w-full">
              {savingTrip && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Schedule Trip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantTravelRoutes;
