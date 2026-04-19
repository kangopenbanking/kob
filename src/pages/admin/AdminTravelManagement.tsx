import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Bus, Compass, Plane, Train, Loader2, Search, MapPin, Calendar, Users,
  Ticket, BarChart3, RefreshCw, Eye, Trash2, CheckCircle, XCircle, AlertTriangle, BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const categoryIcons: Record<string, React.ElementType> = { bus: Bus, tours: Compass, airlines: Plane, trains: Train };
const categoryColors: Record<string, string> = {
  bus: 'bg-[hsl(48,90%,52%)]', tours: 'bg-[hsl(187,100%,42%)]',
  airlines: 'bg-[hsl(0,65%,51%)]', trains: 'bg-[hsl(0,0%,13%)]',
};

const AdminTravelManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [svcRes, routeRes, tripRes, bookingRes, ticketRes] = await Promise.all([
      supabase.from('travel_services').select('*, gateway_merchants(business_name, user_id)'),
      supabase.from('travel_routes').select('*'),
      supabase.from('travel_trips').select('*').order('departure_at', { ascending: false }).limit(200),
      supabase.from('travel_bookings').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('travel_tickets').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    setServices((svcRes.data as any[]) || []);
    setRoutes((routeRes.data as any[]) || []);
    setTrips((tripRes.data as any[]) || []);
    setBookings((bookingRes.data as any[]) || []);
    setTickets((ticketRes.data as any[]) || []);
    setLoading(false);
  };

  const toggleService = async (id: string, isActive: boolean) => {
    await supabase.from('travel_services').update({ is_active: !isActive } as any).eq('id', id);
    toast.success(`Service ${isActive ? 'deactivated' : 'activated'}`);
    fetchAll();
  };

  const cancelBooking = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('travel-cancel-booking', {
        body: { booking_id: id, reason: 'Cancelled by admin' },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success(`Booking cancelled · refund ${(data as any)?.refund_amount?.toLocaleString() || 0} XAF`);
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to cancel booking');
    }
  };

  const resetAllDemoData = async () => {
    if (!confirm('This will DELETE ALL travel data across the entire platform (services, routes, trips, bookings, tickets). This cannot be undone. Continue?')) return;
    try {
      const { data, error } = await supabase.functions.invoke('travel-admin-reset-data', {
        body: { scope: 'all' },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const c = (data as any)?.deleted || {};
      toast.success(`Reset complete · ${c.services || 0} services, ${c.bookings || 0} bookings, ${c.tickets || 0} tickets removed`);
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset data');
    }
  };

  // Stats
  const totalBookings = bookings.length;
  const totalRevenue = bookings.filter(b => b.payment_status === 'paid').reduce((s: number, b: any) => s + (b.total_amount || 0), 0);
  const activeServices = services.filter(s => s.is_active).length;
  const validTickets = tickets.filter(t => t.ticket_status === 'valid').length;

  const filteredBookings = bookings.filter(b => {
    if (statusFilter !== 'all' && b.booking_status !== statusFilter) return false;
    if (searchTerm && !b.booking_ref?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Plane} title="Travel Management" description="Oversee all transport & tourism services across the platform" />

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/admin/travel-guide')}><BookOpen className="mr-2 h-4 w-4" /> Training Guide</Button>
        <Button variant="outline" onClick={fetchAll}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        <Button variant="destructive" onClick={resetAllDemoData}><Trash2 className="mr-2 h-4 w-4" /> Reset All Data</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Bus className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{activeServices}</p><p className="text-xs text-muted-foreground">Active Services</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Ticket className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{totalBookings}</p><p className="text-xs text-muted-foreground">Total Bookings</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><BarChart3 className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{totalRevenue.toLocaleString()} XAF</p><p className="text-xs text-muted-foreground">Total Revenue</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><CheckCircle className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{validTickets}</p><p className="text-xs text-muted-foreground">Valid Tickets</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services ({services.length})</TabsTrigger>
          <TabsTrigger value="routes">Routes ({routes.length})</TabsTrigger>
          <TabsTrigger value="trips">Trips ({trips.length})</TabsTrigger>
          <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
          <TabsTrigger value="tickets">Tickets ({tickets.length})</TabsTrigger>
        </TabsList>

        {/* SERVICES TAB */}
        <TabsContent value="services" className="space-y-4">
          {services.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No travel services registered yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {services.map((svc) => {
                const Icon = categoryIcons[svc.service_type] || Bus;
                const bgColor = categoryColors[svc.service_type] || 'bg-muted';
                return (
                  <Card key={svc.id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bgColor}`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{svc.display_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {svc.service_type} · Merchant: {(svc as any).gateway_merchants?.business_name || 'N/A'}
                        </p>
                      </div>
                      <Badge variant={svc.is_active ? 'default' : 'secondary'}>{svc.is_active ? 'Active' : 'Inactive'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => toggleService(svc.id, svc.is_active)}>
                        {svc.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ROUTES TAB */}
        <TabsContent value="routes" className="space-y-4">
          {routes.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No routes configured.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {routes.map((route) => {
                const svc = services.find(s => s.id === route.service_id);
                return (
                  <Card key={route.id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-semibold">{route.origin} → {route.destination}</p>
                        <p className="text-sm text-muted-foreground">
                          Service: {svc?.display_name || 'Unknown'} · {route.distance_km ? `${route.distance_km}km` : ''} {route.estimated_duration_minutes ? `· ${route.estimated_duration_minutes}min` : ''}
                        </p>
                      </div>
                      <Badge variant={route.is_active ? 'default' : 'secondary'}>{route.is_active ? 'Active' : 'Inactive'}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TRIPS TAB */}
        <TabsContent value="trips" className="space-y-4">
          {trips.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No trips scheduled.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {trips.slice(0, 50).map((trip) => {
                const route = routes.find(r => r.id === trip.route_id);
                return (
                  <Card key={trip.id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-semibold">{route ? `${route.origin} → ${route.destination}` : 'Unknown route'}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(trip.departure_at), 'PPp')} · {trip.price?.toLocaleString()} {trip.currency} · {trip.available_seats} seats left
                        </p>
                      </div>
                      <Badge variant={trip.status === 'scheduled' ? 'default' : trip.status === 'completed' ? 'secondary' : 'destructive'}>{trip.status}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* BOOKINGS TAB */}
        <TabsContent value="bookings" className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by booking ref..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filteredBookings.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No bookings found.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filteredBookings.slice(0, 50).map((b) => (
                <Card key={b.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <Ticket className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-semibold font-mono">{b.booking_ref}</p>
                      <p className="text-sm text-muted-foreground">
                        {b.total_amount?.toLocaleString()} {b.currency} · {format(new Date(b.created_at), 'PPp')}
                      </p>
                    </div>
                    <Badge variant={b.booking_status === 'confirmed' ? 'default' : b.booking_status === 'cancelled' ? 'destructive' : 'secondary'}>{b.booking_status}</Badge>
                    <Badge variant={b.payment_status === 'paid' ? 'default' : 'secondary'}>{b.payment_status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedBooking(b)}><Eye className="h-4 w-4" /></Button>
                    {b.booking_status === 'confirmed' && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelBooking(b.id)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TICKETS TAB */}
        <TabsContent value="tickets" className="space-y-4">
          {tickets.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No tickets issued.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {tickets.slice(0, 50).map((t) => (
                <Card key={t.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <Ticket className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-semibold">{t.passenger_name} · Seat {t.seat_label}</p>
                      <p className="text-sm text-muted-foreground font-mono">{t.qr_code?.slice(0, 16)}...</p>
                    </div>
                    <Badge variant={t.ticket_status === 'valid' ? 'default' : t.ticket_status === 'used' ? 'secondary' : 'destructive'}>{t.ticket_status}</Badge>
                    {t.validated_at && <span className="text-xs text-muted-foreground">Scanned {format(new Date(t.validated_at), 'PPp')}</span>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Booking Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Booking Details</DialogTitle></DialogHeader>
          {selectedBooking && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Reference</span><span className="font-mono font-semibold">{selectedBooking.booking_ref}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Amount</span><span className="font-semibold">{selectedBooking.total_amount?.toLocaleString()} {selectedBooking.currency}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Status</span><Badge>{selectedBooking.booking_status}</Badge></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Payment</span><Badge variant="outline">{selectedBooking.payment_status}</Badge></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Created</span><span className="text-sm">{format(new Date(selectedBooking.created_at), 'PPp')}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">User ID</span><span className="text-xs font-mono">{selectedBooking.user_id?.slice(0, 12)}...</span></div>
              <hr />
              <p className="text-sm font-semibold">Tickets</p>
              {tickets.filter(t => t.booking_id === selectedBooking.id).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-semibold">{t.passenger_name} · Seat {t.seat_label}</p>
                    <p className="text-xs text-muted-foreground">{t.passenger_phone || 'No phone'}</p>
                  </div>
                  <Badge variant={t.ticket_status === 'valid' ? 'default' : 'secondary'}>{t.ticket_status}</Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTravelManagement;
