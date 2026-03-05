import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Check, Armchair, Users, MapPin, Clock, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface LayoutCell { row: number; col: number; seat_label: string; type: 'seat' | 'aisle' | 'blocked'; }

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
    const fetchData = async () => {
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

      const { data: existingTickets } = await supabase.from('travel_tickets').select('seat_label, booking_id')
        .in('booking_id', ((await supabase.from('travel_bookings').select('id').eq('trip_id', tripId || '').in('booking_status', ['confirmed'])).data || []).map((b: any) => b.id))
        .in('ticket_status', ['valid', 'used']);
      setBookedSeats((existingTickets || []).map((t: any) => t.seat_label));
      setLoading(false);
    };
    fetchData();
  }, [tripId]);

  const toggleSeat = (label: string) => {
    if (bookedSeats.includes(label)) return;
    setSelectedSeats(prev => prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]);
  };

  const totalPrice = selectedSeats.length * (trip?.price || 0);

  const handleBook = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Please log in first'); return; }
    for (const seat of selectedSeats) {
      if (!passengers[seat]?.name?.trim()) { toast.error(`Enter name for seat ${seat}`); return; }
    }
    setBooking(true);
    const bookingRef = `KOB-${(category || 'TRV').toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;
    const { data: bookingData, error: bookErr } = await supabase.from('travel_bookings').insert({
      trip_id: tripId, user_id: user.id, booking_ref: bookingRef, total_amount: totalPrice,
      currency: trip?.currency || 'XAF', payment_status: 'paid', booking_status: 'confirmed', payment_method: 'wallet',
    } as any).select('id').single();

    if (bookErr || !bookingData) { toast.error(bookErr?.message || 'Booking failed'); setBooking(false); return; }

    const tickets = selectedSeats.map(seat => ({
      booking_id: (bookingData as any).id, seat_label: seat,
      passenger_name: passengers[seat]?.name?.trim() || '', passenger_phone: passengers[seat]?.phone?.trim() || null,
      qr_code: crypto.randomUUID(),
    }));
    const { error: tickErr } = await supabase.from('travel_tickets').insert(tickets as any);
    if (tickErr) { toast.error(tickErr.message); setBooking(false); return; }

    await supabase.from('travel_trips').update({ available_seats: Math.max(0, (trip?.available_seats || 0) - selectedSeats.length) } as any).eq('id', tripId || '');
    toast.success('Booking confirmed! 🎉');
    navigate(`/app/travel/ticket/${(bookingData as any).id}`);
    setBooking(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!trip) return <div className="p-4 text-center text-muted-foreground">Trip not found</div>;

  const steps = [
    { key: 'seats', label: 'Seats' },
    { key: 'details', label: 'Passengers' },
    { key: 'confirm', label: 'Confirm' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Dark header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(220,25%,12%)] to-[hsl(220,30%,20%)] px-4 pb-6 pt-3">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(217,91%,35%/0.15),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white">Book Your Seat</h1>
              <p className="text-[12px] text-white/50 flex items-center gap-1">
                <MapPin className="h-3 w-3" />{route?.origin} → {route?.destination} · {format(new Date(trip.departure_at), 'dd MMM, HH:mm')}
              </p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${step === s.key ? 'bg-white text-[hsl(220,25%,12%)]' : 'bg-white/10 text-white/50'}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${step === s.key ? 'bg-primary text-primary-foreground' : 'bg-white/10'}`}>{i + 1}</span>
                  {s.label}
                </div>
                {i < steps.length - 1 && <div className="h-px w-3 bg-white/20" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 px-4 py-4 pb-32 space-y-5 -mt-2">
        {/* Step 1: Seat Selection */}
        {step === 'seats' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Select Your Seats</p>
            {layout.length > 0 ? (
              <div className="rounded-2xl border bg-card p-4 shadow-sm overflow-x-auto">
                <div className="flex flex-col items-center gap-1 min-w-fit">
                  <div className="flex gap-1">
                    <div className="h-7 w-7" />
                    {Array.from({ length: planCols }, (_, c) => (
                      <div key={c} className="flex h-7 w-9 items-center justify-center text-[10px] font-bold text-muted-foreground">{String.fromCharCode(65 + c)}</div>
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
                          <button key={c} onClick={() => toggleSeat(cell.seat_label)} disabled={isBooked}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-bold transition-all ${
                              isBooked ? 'bg-muted text-muted-foreground cursor-not-allowed'
                              : isSelected ? 'bg-primary text-primary-foreground scale-110 shadow-lg ring-2 ring-primary/30'
                              : 'bg-[hsl(150,60%,40%/0.15)] text-[hsl(150,60%,30%)] hover:bg-[hsl(150,60%,40%/0.3)] border border-[hsl(150,60%,40%/0.3)]'
                            }`}>
                            {isBooked ? '×' : isSelected ? <Check className="h-4 w-4" /> : cell.seat_label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-[hsl(150,60%,40%)]" /> Available</span>
                  <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-primary" /> Selected</span>
                  <span className="flex items-center gap-1.5"><div className="h-3 w-3 rounded bg-muted" /> Taken</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
                <Armchair className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No seating plan assigned. Select number of seats:</p>
                <div className="mt-3 flex justify-center gap-2">
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => setSelectedSeats(Array.from({ length: n }, (_, i) => `S${i + 1}`))}
                      className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${selectedSeats.length === n ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            {selectedSeats.length > 0 && (
              <Button className="mt-4 w-full h-12 text-[15px] font-bold rounded-xl bg-gradient-to-r from-primary to-[hsl(217,91%,50%)] shadow-lg" onClick={() => setStep('details')}>
                <Users className="mr-2 h-4 w-4" /> Continue · {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''} · {totalPrice.toLocaleString()} {trip.currency}
              </Button>
            )}
          </motion.div>
        )}

        {/* Step 2: Passenger Details */}
        {step === 'details' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Passenger Details</p>
            {selectedSeats.map((seat, idx) => {
              const seatColors = ['border-l-[hsl(217,91%,55%)]', 'border-l-[hsl(150,60%,40%)]', 'border-l-[hsl(38,92%,50%)]', 'border-l-[hsl(258,80%,58%)]'];
              return (
              <div key={seat} className={`rounded-2xl border bg-card p-4 space-y-3 shadow-sm border-l-4 ${seatColors[idx % seatColors.length]}`}>
                <Badge variant="outline" className="text-[11px]">Seat {seat}</Badge>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Full Name *</Label>
                  <Input placeholder="Passenger name" value={passengers[seat]?.name || ''}
                    onChange={(e) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], name: e.target.value } }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Phone</Label>
                  <Input placeholder="+237 ..." value={passengers[seat]?.phone || ''}
                    onChange={(e) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], phone: e.target.value } }))} />
                </div>
              </div>
              );
            })}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('seats')} className="flex-1 h-11 rounded-xl">Back</Button>
              <Button onClick={() => setStep('confirm')} className="flex-1 h-11 rounded-xl">Review Booking</Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Booking Summary</p>
            <div className="rounded-2xl border bg-gradient-to-br from-card to-[hsl(217,91%,35%/0.03)] p-5 space-y-3 shadow-sm">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Route</span><span className="font-semibold">{route?.origin} → {route?.destination}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Departure</span><span className="font-semibold">{format(new Date(trip.departure_at), 'dd MMM yyyy, HH:mm')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Seats</span><span className="font-semibold">{selectedSeats.join(', ')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Passengers</span><span className="font-semibold">{selectedSeats.length}</span></div>
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="font-bold">Total</span>
                <span className="text-xl font-black text-primary">{totalPrice.toLocaleString()} {trip.currency}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1 h-11 rounded-xl">Back</Button>
              <Button onClick={handleBook} disabled={booking} className="flex-1 h-12 rounded-xl text-[15px] font-bold bg-gradient-to-r from-[hsl(150,60%,40%)] to-[hsl(160,55%,35%)] hover:from-[hsl(150,60%,35%)] hover:to-[hsl(160,55%,30%)] shadow-lg">
                {booking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Pay & Confirm
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CustomerTravelBooking;
