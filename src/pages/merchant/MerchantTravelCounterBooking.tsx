import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ArrowLeft, ShoppingCart, Check, MapPin, Clock, Armchair, UserCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type Gender = 'male' | 'female';
interface LayoutCell { row: number; col: number; seat_label: string; type: 'seat' | 'aisle' | 'blocked'; }

const MerchantTravelCounterBooking: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [layout, setLayout] = useState<LayoutCell[]>([]);
  const [planRows, setPlanRows] = useState(0);
  const [planCols, setPlanCols] = useState(0);
  const [bookedSeats, setBookedSeats] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengers, setPassengers] = useState<Record<string, { name: string; phone: string; gender: Gender }>>({});
  const [customerEmail, setCustomerEmail] = useState('');
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<'trip' | 'seats' | 'details'>('trip');

  useEffect(() => { fetchTrips(); }, []);

  const fetchTrips = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
    if (!merchant) { setLoading(false); return; }

    const { data: svcs } = await supabase.from('travel_services').select('id').eq('merchant_id', merchant.id);
    const svcIds = (svcs || []).map((s: any) => s.id);
    if (!svcIds.length) { setLoading(false); return; }

    const { data: routeData } = await supabase.from('travel_routes').select('*').in('service_id', svcIds).eq('is_active', true);
    setRoutes(routeData || []);
    const routeIds = (routeData || []).map((r: any) => r.id);
    if (!routeIds.length) { setLoading(false); return; }

    const { data: tripData } = await supabase.from('travel_trips').select('*').in('route_id', routeIds)
      .gte('departure_at', new Date().toISOString()).order('departure_at', { ascending: true });
    setTrips(tripData || []);
    setLoading(false);
  };

  const selectTrip = async (tripId: string) => {
    setSelectedTripId(tripId);
    setSelectedSeats([]);
    setPassengers({});
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    // Load seating plan
    if (trip.seating_plan_id) {
      const { data: plan } = await supabase.from('travel_seating_plans').select('*').eq('id', trip.seating_plan_id).maybeSingle();
      if (plan) {
        setLayout(Array.isArray((plan as any).layout) ? (plan as any).layout : []);
        setPlanRows((plan as any).rows);
        setPlanCols((plan as any).columns);
      }
    }

    // Load booked seats
    const { data: confirmedBookings } = await supabase.from('travel_bookings').select('id').eq('trip_id', tripId).in('booking_status', ['confirmed']);
    const bookingIds = (confirmedBookings || []).map((b: any) => b.id);
    if (bookingIds.length > 0) {
      const { data: existingTickets } = await supabase.from('travel_tickets').select('seat_label').in('booking_id', bookingIds).in('ticket_status', ['valid', 'used']);
      setBookedSeats((existingTickets || []).map((t: any) => t.seat_label));
    } else {
      setBookedSeats([]);
    }
    setStep('seats');
  };

  const toggleSeat = (label: string) => {
    if (bookedSeats.includes(label)) return;
    setSelectedSeats(prev => prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]);
  };

  const selectedTrip = trips.find(t => t.id === selectedTripId);
  const selectedRoute = selectedTrip ? routes.find(r => r.id === selectedTrip.route_id) : null;
  const totalPrice = selectedSeats.length * (selectedTrip?.price || 0);

  const handleBook = async () => {
    for (const seat of selectedSeats) {
      if (!passengers[seat]?.name?.trim()) { toast.error(`Enter name for seat ${seat}`); return; }
    }
    setBooking(true);

    // Find customer user by email if provided
    let userId: string | null = null;
    if (customerEmail.trim()) {
      const { data: profile } = await supabase.from('profiles').select('id').eq('email', customerEmail.trim().toLowerCase()).maybeSingle();
      if (profile) {
        userId = (profile as any).id;
      } else {
        toast.error('No customer account found with that email. Booking will proceed without linking.');
      }
    }

    // If no linked customer, use the merchant's own user id as fallback (booking_status indicates it's a counter booking)
    const { data: { user } } = await supabase.auth.getUser();
    const bookingUserId = userId || user?.id;
    if (!bookingUserId) { toast.error('Authentication error'); setBooking(false); return; }

    const bookingRef = `KOB-CSH-${Date.now().toString(36).toUpperCase()}`;
    const { data: bookingData, error: bookErr } = await supabase.from('travel_bookings').insert({
      trip_id: selectedTripId, user_id: bookingUserId, booking_ref: bookingRef,
      total_amount: totalPrice, currency: selectedTrip?.currency || 'XAF',
      payment_status: 'paid', booking_status: 'confirmed', payment_method: 'cash',
    } as any).select('id').single();

    if (bookErr || !bookingData) { toast.error(bookErr?.message || 'Booking failed'); setBooking(false); return; }

    const tickets = selectedSeats.map(seat => ({
      booking_id: (bookingData as any).id, seat_label: seat,
      passenger_name: passengers[seat]?.name?.trim() || '',
      passenger_phone: passengers[seat]?.phone?.trim() || null,
      qr_code: crypto.randomUUID(),
    }));
    const { error: tickErr } = await supabase.from('travel_tickets').insert(tickets as any);
    if (tickErr) { toast.error(tickErr.message); setBooking(false); return; }

    await supabase.from('travel_trips').update({
      available_seats: Math.max(0, (selectedTrip?.available_seats || 0) - selectedSeats.length)
    } as any).eq('id', selectedTripId);

    toast.success(`Cash booking confirmed! Ref: ${bookingRef}`);
    navigate('/merchant/travel-bookings');
    setBooking(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/merchant/travel-bookings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Counter Booking</h1>
          <p className="text-muted-foreground">Book tickets for walk-in customers paying with cash</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[{ key: 'trip', label: '1. Select Trip' }, { key: 'seats', label: '2. Pick Seats' }, { key: 'details', label: '3. Passenger Details' }].map((s, i) => (
          <Badge key={s.key} variant={step === s.key ? 'default' : 'secondary'} className="text-xs">{s.label}</Badge>
        ))}
      </div>

      {/* Step 1: Select Trip */}
      {step === 'trip' && (
        <div className="space-y-3">
          {trips.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No upcoming trips found. Create trips in the Timetable first.</CardContent></Card>
          ) : trips.map(trip => {
            const route = routes.find(r => r.id === trip.route_id);
            return (
              <Card key={trip.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => selectTrip(trip.id)}>
                <CardContent className="flex items-center gap-4 py-4">
                  <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{route?.origin} → {route?.destination}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(trip.departure_at), 'dd MMM, HH:mm')}</span>
                      <span>{trip.price?.toLocaleString()} {trip.currency}</span>
                      <span>{trip.available_seats} seats left</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Step 2: Seat Selection */}
      {step === 'seats' && selectedTrip && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{selectedRoute?.origin} → {selectedRoute?.destination}</CardTitle>
              <CardDescription>{format(new Date(selectedTrip.departure_at), 'dd MMM yyyy, HH:mm')} · {selectedTrip.price?.toLocaleString()} {selectedTrip.currency}/seat</CardDescription>
            </CardHeader>
            <CardContent>
              {layout.length === 0 ? (
                <p className="text-muted-foreground text-sm">No seating plan assigned to this trip.</p>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4 text-xs">
                    <div className="flex items-center gap-1"><div className="h-4 w-4 rounded bg-emerald-100 border border-emerald-300" /> Available</div>
                    <div className="flex items-center gap-1"><div className="h-4 w-4 rounded bg-primary border border-primary" /> Selected</div>
                    <div className="flex items-center gap-1"><div className="h-4 w-4 rounded bg-gray-200 border border-gray-300" /> Booked</div>
                  </div>
                  <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${planCols}, 40px)` }}>
                    {Array.from({ length: planRows * planCols }).map((_, idx) => {
                      const row = Math.floor(idx / planCols);
                      const col = idx % planCols;
                      const cell = layout.find(c => c.row === row && c.col === col);
                      if (!cell || cell.type === 'aisle') return <div key={idx} className="h-10 w-10" />;
                      if (cell.type === 'blocked') return <div key={idx} className="h-10 w-10 rounded bg-muted" />;
                      const isBooked = bookedSeats.includes(cell.seat_label);
                      const isSelected = selectedSeats.includes(cell.seat_label);
                      return (
                        <button key={idx} onClick={() => toggleSeat(cell.seat_label)} disabled={isBooked}
                          className={`h-10 w-10 rounded-md border text-xs font-bold transition-colors ${isBooked ? 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed' : isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}>
                          {cell.seat_label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {selectedSeats.length > 0 && (
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-semibold">{selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''} selected</p>
                  <p className="text-sm text-muted-foreground">Total: {totalPrice.toLocaleString()} {selectedTrip.currency}</p>
                </div>
                <Button onClick={() => setStep('details')}>Next: Passenger Details →</Button>
              </CardContent>
            </Card>
          )}

          <Button variant="outline" onClick={() => { setStep('trip'); setSelectedSeats([]); }}>← Back to Trip Selection</Button>
        </div>
      )}

      {/* Step 3: Passenger Details */}
      {step === 'details' && selectedTrip && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Link to Customer Account (Optional)</CardTitle>
              <CardDescription>Enter the customer's registered email so the ticket appears in their app</CardDescription>
            </CardHeader>
            <CardContent>
              <Input placeholder="customer@email.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
            </CardContent>
          </Card>

          {selectedSeats.map((seat, i) => {
            const p = passengers[seat] || { name: '', phone: '', gender: 'male' as Gender };
            return (
              <Card key={seat}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Armchair className="h-4 w-4" /> Seat {seat} — Passenger {i + 1}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Full Name <span className="text-destructive">*</span></Label>
                    <Input placeholder="Full name" value={p.name}
                      onChange={e => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat] || { name: '', phone: '', gender: 'male' }, name: e.target.value } }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone (optional)</Label>
                    <Input placeholder="+237 6XX XXX XXX" value={p.phone}
                      onChange={e => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat] || { name: '', phone: '', gender: 'male' }, phone: e.target.value } }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gender</Label>
                    <RadioGroup value={p.gender} onValueChange={v => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat] || { name: '', phone: '', gender: 'male' }, gender: v as Gender } }))} className="flex gap-3">
                      <label className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 py-2 cursor-pointer text-sm font-medium ${p.gender === 'male' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-muted bg-background text-muted-foreground'}`}>
                        <RadioGroupItem value="male" className="sr-only" />
                        <UserCircle className="h-4 w-4" /> Male
                      </label>
                      <label className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 py-2 cursor-pointer text-sm font-medium ${p.gender === 'female' ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-muted bg-background text-muted-foreground'}`}>
                        <RadioGroupItem value="female" className="sr-only" />
                        <UserCircle className="h-4 w-4" /> Female
                      </label>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-bold text-lg">{totalPrice.toLocaleString()} {selectedTrip.currency}</p>
                <p className="text-sm text-muted-foreground">{selectedSeats.length} ticket{selectedSeats.length > 1 ? 's' : ''} · Cash Payment</p>
              </div>
              <Button onClick={handleBook} disabled={booking} size="lg">
                {booking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirm Cash Booking
              </Button>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={() => setStep('seats')}>← Back to Seats</Button>
        </div>
      )}
    </div>
  );
};

export default MerchantTravelCounterBooking;
