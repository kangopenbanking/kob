import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Check, Armchair } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface LayoutCell {
  row: number; col: number; seat_label: string; type: 'seat' | 'aisle' | 'blocked';
}

const CustomerTravelBooking: React.FC = () => {
  const { category, serviceId, tripId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);
  const [layout, setLayout] = useState<LayoutCell[]>([]);
  const [planRows, setPlanRows] = useState(0);
  const [planCols, setPlanCols] = useState(0);
  const [bookedSeats, setBookedSeats] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengers, setPassengers] = useState<Record<string, { name: string; phone: string }>>({});
  const [booking, setBooking] = useState(false);
  const [step, setStep] = useState<'seats' | 'details' | 'confirm'>('seats');

  useEffect(() => {
    const fetch = async () => {
      const { data: tripData } = await supabase.from('travel_trips').select('*').eq('id', tripId || '').maybeSingle();
      if (!tripData) { setLoading(false); return; }
      setTrip(tripData);

      const [routeRes, planRes] = await Promise.all([
        supabase.from('travel_routes').select('*').eq('id', (tripData as any).route_id).maybeSingle(),
        (tripData as any).seating_plan_id
          ? supabase.from('travel_seating_plans').select('*').eq('id', (tripData as any).seating_plan_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setRoute(routeRes.data);
      if (planRes.data) {
        const plan = planRes.data as any;
        setLayout(Array.isArray(plan.layout) ? plan.layout : []);
        setPlanRows(plan.rows);
        setPlanCols(plan.columns);
      }

      // Get already booked seats
      const { data: existingTickets } = await supabase
        .from('travel_tickets')
        .select('seat_label, booking_id')
        .in('booking_id',
          ((await supabase.from('travel_bookings').select('id').eq('trip_id', tripId || '').in('booking_status', ['confirmed'])).data || []).map((b: any) => b.id)
        )
        .in('ticket_status', ['valid', 'used']);
      setBookedSeats((existingTickets || []).map((t: any) => t.seat_label));
      setLoading(false);
    };
    fetch();
  }, [tripId]);

  const toggleSeat = (label: string) => {
    if (bookedSeats.includes(label)) return;
    setSelectedSeats(prev =>
      prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]
    );
  };

  const totalPrice = selectedSeats.length * (trip?.price || 0);

  const handleBook = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Please log in first'); return; }

    for (const seat of selectedSeats) {
      const p = passengers[seat];
      if (!p?.name?.trim()) { toast.error(`Please enter passenger name for seat ${seat}`); return; }
    }

    setBooking(true);
    const bookingRef = `KOB-${(category || 'TRV').toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

    const { data: bookingData, error: bookErr } = await supabase.from('travel_bookings').insert({
      trip_id: tripId,
      user_id: user.id,
      booking_ref: bookingRef,
      total_amount: totalPrice,
      currency: trip?.currency || 'XAF',
      payment_status: 'paid',
      booking_status: 'confirmed',
      payment_method: 'wallet',
    } as any).select('id').single();

    if (bookErr || !bookingData) {
      toast.error(bookErr?.message || 'Booking failed');
      setBooking(false);
      return;
    }

    const tickets = selectedSeats.map(seat => ({
      booking_id: (bookingData as any).id,
      seat_label: seat,
      passenger_name: passengers[seat]?.name?.trim() || '',
      passenger_phone: passengers[seat]?.phone?.trim() || null,
      qr_code: crypto.randomUUID(),
    }));

    const { error: tickErr } = await supabase.from('travel_tickets').insert(tickets as any);
    if (tickErr) {
      toast.error(tickErr.message);
      setBooking(false);
      return;
    }

    // Decrement available seats
    await supabase.from('travel_trips').update({
      available_seats: Math.max(0, (trip?.available_seats || 0) - selectedSeats.length),
    } as any).eq('id', tripId || '');

    toast.success('Booking confirmed! 🎉');
    navigate(`/app/travel/ticket/${(bookingData as any).id}`);
    setBooking(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!trip) return <div className="p-4 text-center text-muted-foreground">Trip not found</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-3 backdrop-blur-sm border-b">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Book Seat{selectedSeats.length > 1 ? 's' : ''}</h1>
          <p className="text-xs text-muted-foreground">
            {route?.origin} → {route?.destination} · {format(new Date(trip.departure_at), 'dd MMM HH:mm')}
          </p>
        </div>
      </div>

      <div className="px-4 py-4 pb-32 space-y-5">
        {/* Step 1: Seat Selection */}
        {step === 'seats' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Select Your Seats</p>

            {layout.length > 0 ? (
              <div className="rounded-2xl border bg-card p-4 overflow-x-auto">
                <div className="flex flex-col items-center gap-1 min-w-fit">
                  {/* Column headers */}
                  <div className="flex gap-1">
                    <div className="h-7 w-7" />
                    {Array.from({ length: planCols }, (_, c) => (
                      <div key={c} className="flex h-7 w-9 items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {String.fromCharCode(65 + c)}
                      </div>
                    ))}
                  </div>
                  {Array.from({ length: planRows }, (_, r) => (
                    <div key={r} className="flex gap-1">
                      <div className="flex h-9 w-7 items-center justify-center text-[10px] font-bold text-muted-foreground">{r + 1}</div>
                      {Array.from({ length: planCols }, (_, c) => {
                        const cell = layout.find(l => l.row === r && l.col === c);
                        if (!cell || cell.type === 'aisle') return <div key={c} className="h-9 w-9" />;
                        if (cell.type === 'blocked') return <div key={c} className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-[10px] text-muted-foreground">×</div>;

                        const isBooked = bookedSeats.includes(cell.seat_label);
                        const isSelected = selectedSeats.includes(cell.seat_label);
                        return (
                          <button
                            key={c}
                            onClick={() => toggleSeat(cell.seat_label)}
                            disabled={isBooked}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-bold transition-all ${
                              isBooked ? 'bg-muted text-muted-foreground cursor-not-allowed'
                              : isSelected ? 'bg-primary text-primary-foreground scale-105 shadow-md'
                              : 'bg-[hsl(150,40%,90%)] text-[hsl(150,40%,35%)] hover:bg-[hsl(150,40%,80%)]'
                            }`}
                          >
                            {isBooked ? '×' : isSelected ? <Check className="h-4 w-4" /> : cell.seat_label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-[hsl(150,40%,90%)]" /> Available</span>
                  <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-primary" /> Selected</span>
                  <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-muted" /> Taken</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-6 text-center">
                <Armchair className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No seating plan assigned. Select number of seats:</p>
                <div className="mt-3 flex justify-center gap-2">
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setSelectedSeats(Array.from({ length: n }, (_, i) => `S${i + 1}`))}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${selectedSeats.length === n ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSeats.length > 0 && (
              <Button className="mt-4 w-full" onClick={() => setStep('details')}>
                Continue · {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''} · {totalPrice.toLocaleString()} {trip.currency}
              </Button>
            )}
          </motion.div>
        )}

        {/* Step 2: Passenger Details */}
        {step === 'details' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Passenger Details</p>
            {selectedSeats.map((seat) => (
              <div key={seat} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Seat {seat}</Badge>
                </div>
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="Passenger name"
                    value={passengers[seat]?.name || ''}
                    onChange={(e) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], name: e.target.value } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    placeholder="+237 ..."
                    value={passengers[seat]?.phone || ''}
                    onChange={(e) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], phone: e.target.value } }))}
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('seats')} className="flex-1">Back</Button>
              <Button onClick={() => setStep('confirm')} className="flex-1">Review Booking</Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Booking Summary</p>
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Route</span><span className="font-semibold">{route?.origin} → {route?.destination}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Departure</span><span className="font-semibold">{format(new Date(trip.departure_at), 'dd MMM yyyy, HH:mm')}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Seats</span><span className="font-semibold">{selectedSeats.join(', ')}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Passengers</span><span className="font-semibold">{selectedSeats.length}</span></div>
              <hr className="border-border" />
              <div className="flex justify-between"><span className="font-bold">Total</span><span className="text-lg font-black">{totalPrice.toLocaleString()} {trip.currency}</span></div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1">Back</Button>
              <Button onClick={handleBook} disabled={booking} className="flex-1">
                {booking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirm & Pay
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CustomerTravelBooking;
