import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Search, Ticket, Eye, XCircle, Users, BarChart3, RefreshCw, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const MerchantTravelBookings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
    if (!merchant) { setLoading(false); return; }

    const { data: svcs } = await supabase.from('travel_services').select('id').eq('merchant_id', merchant.id);
    const svcIds = (svcs || []).map((s: any) => s.id);
    if (svcIds.length === 0) { setLoading(false); return; }

    const { data: routeData } = await supabase.from('travel_routes').select('*').in('service_id', svcIds);
    setRoutes(routeData || []);
    const routeIds = (routeData || []).map((r: any) => r.id);
    if (routeIds.length === 0) { setLoading(false); return; }

    const { data: tripData } = await supabase.from('travel_trips').select('*').in('route_id', routeIds);
    setTrips(tripData || []);
    const tripIds = (tripData || []).map((t: any) => t.id);
    if (tripIds.length === 0) { setLoading(false); return; }

    const [bookingRes, ticketRes] = await Promise.all([
      supabase.from('travel_bookings').select('*').in('trip_id', tripIds).order('created_at', { ascending: false }),
      supabase.from('travel_tickets').select('*').in('booking_id',
        ((await supabase.from('travel_bookings').select('id').in('trip_id', tripIds)).data || []).map((b: any) => b.id)
      ),
    ]);
    setBookings(bookingRes.data || []);
    setTickets(ticketRes.data || []);
    setLoading(false);
  };

  const cancelBooking = async (id: string) => {
    await supabase.from('travel_bookings').update({ booking_status: 'cancelled', payment_status: 'refunded' } as any).eq('id', id);
    await supabase.from('travel_tickets').update({ ticket_status: 'cancelled' } as any).in('booking_id', [id]);
    toast.success('Booking cancelled & refunded');
    fetchData();
  };

  const filtered = bookings.filter(b => {
    if (statusFilter !== 'all' && b.booking_status !== statusFilter) return false;
    if (search && !b.booking_ref?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalRevenue = bookings.filter(b => b.payment_status === 'paid').reduce((s: number, b: any) => s + (b.total_amount || 0), 0);
  const totalPassengers = tickets.length;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-muted-foreground">View all customer bookings for your travel services</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => navigate('/biz/travel/counter-booking')}>
            <ShoppingCart className="mr-2 h-4 w-4" /> Counter Booking
          </Button>
          <Button size="sm" variant="outline" onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{bookings.length}</p><p className="text-xs text-muted-foreground">Total Bookings</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold truncate">{totalRevenue.toLocaleString()} XAF</p><p className="text-xs text-muted-foreground">Revenue</p></CardContent></Card>
        <Card className="col-span-2 sm:col-span-1"><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{totalPassengers}</p><p className="text-xs text-muted-foreground">Passengers</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search booking ref..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No bookings found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const trip = trips.find(t => t.id === b.trip_id);
            const route = trip ? routes.find(r => r.id === trip.route_id) : null;
            const bTickets = tickets.filter(t => t.booking_id === b.id);
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <Ticket className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 basis-[55%]">
                    <p className="font-semibold font-mono truncate">{b.booking_ref}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {route ? `${route.origin} → ${route.destination}` : ''} · {b.total_amount?.toLocaleString()} {b.currency} · {bTickets.length} ticket{bTickets.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(b.created_at), 'PPp')}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <Badge variant={b.booking_status === 'confirmed' ? 'default' : 'destructive'}>{b.booking_status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedBooking(b)}><Eye className="h-4 w-4" /></Button>
                    {b.booking_status === 'confirmed' && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelBooking(b.id)}><XCircle className="h-4 w-4" /></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Booking Details</DialogTitle></DialogHeader>
          {selectedBooking && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Reference</span><span className="font-mono font-semibold">{selectedBooking.booking_ref}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Amount</span><span className="font-semibold">{selectedBooking.total_amount?.toLocaleString()} {selectedBooking.currency}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Status</span><Badge>{selectedBooking.booking_status}</Badge></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Payment</span><Badge variant="outline">{selectedBooking.payment_status}</Badge></div>
              <hr />
              <p className="text-sm font-semibold">Tickets ({tickets.filter(t => t.booking_id === selectedBooking.id).length})</p>
              {tickets.filter(t => t.booking_id === selectedBooking.id).map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-semibold">{t.passenger_name} · Seat {t.seat_label}</p>
                    <p className="text-xs text-muted-foreground">{t.passenger_phone || 'No phone'}</p>
                  </div>
                  <Badge variant={t.ticket_status === 'valid' ? 'default' : t.ticket_status === 'used' ? 'secondary' : 'destructive'}>{t.ticket_status}</Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantTravelBookings;
