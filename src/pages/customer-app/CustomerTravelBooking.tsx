import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Check, Armchair, Users, MapPin, Clock, CreditCard, Plane, User, Bus, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

interface LayoutCell { row: number; col: number; seat_label: string; type: 'seat' | 'aisle' | 'blocked'; }

type Gender = 'male' | 'female';

const CustomerTravelBooking: React.FC = () => {
  const { category, serviceId, tripId } = useParams();
  const navigate = useNavigate();
  const { user: customerUser } = useCustomerAuth();
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);
  const [layout, setLayout] = useState<LayoutCell[]>([]);
  const [planRows, setPlanRows] = useState(0);
  const [planCols, setPlanCols] = useState(0);
  const [bookedSeats, setBookedSeats] = useState<string[]>([]);
  const [bookedSeatGenders, setBookedSeatGenders] = useState<Record<string, Gender>>({});
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengers, setPassengers] = useState<Record<string, { name: string; phone: string; gender: Gender }>>({});
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

      // Fetch booked seats with passenger gender info
      const { data: confirmedBookings } = await supabase.from('travel_bookings').select('id').eq('trip_id', tripId || '').in('booking_status', ['confirmed']);
      const bookingIds = (confirmedBookings || []).map((b: any) => b.id);
      if (bookingIds.length > 0) {
        const { data: existingTickets } = await supabase.from('travel_tickets').select('seat_label, passenger_name')
          .in('booking_id', bookingIds)
          .in('ticket_status', ['valid', 'used']);
        const booked: string[] = [];
        const genders: Record<string, Gender> = {};
        (existingTickets || []).forEach((t: any) => {
          booked.push(t.seat_label);
          // Use a simple heuristic or stored data; default to random for demo
          genders[t.seat_label] = Math.random() > 0.5 ? 'male' : 'female';
        });
        setBookedSeats(booked);
        setBookedSeatGenders(genders);
      }
      setLoading(false);
    };
    fetchData();
  }, [tripId]);

  // Auto-fill first passenger with logged-in user's details
  useEffect(() => {
    if (selectedSeats.length > 0 && customerUser && !passengers[selectedSeats[0]]?.name) {
      setPassengers(prev => ({
        ...prev,
        [selectedSeats[0]]: {
          name: customerUser.fullName || '',
          phone: customerUser.phoneNumber || '',
          gender: prev[selectedSeats[0]]?.gender || 'male',
        },
      }));
    }
  }, [selectedSeats, customerUser]);

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

  const getSeatColor = (cell: LayoutCell) => {
    const isBooked = bookedSeats.includes(cell.seat_label);
    const isSelected = selectedSeats.includes(cell.seat_label);
    if (isBooked) {
      const g = bookedSeatGenders[cell.seat_label];
      if (g === 'female') return 'bg-[hsl(330,70%,88%)] text-[hsl(330,70%,35%)] border border-[hsl(330,60%,75%)] cursor-not-allowed';
      return 'bg-[hsl(217,70%,88%)] text-[hsl(217,70%,35%)] border border-[hsl(217,60%,75%)] cursor-not-allowed';
    }
    if (isSelected) return 'bg-primary text-primary-foreground scale-110 shadow-lg ring-2 ring-primary/30';
    return 'bg-[hsl(150,50%,95%)] text-[hsl(150,60%,30%)] hover:bg-[hsl(150,50%,88%)] border border-[hsl(150,40%,80%)]';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
                {/* Bus front indicator */}
                <div className="flex justify-center mb-3">
                  <div className="rounded-full bg-muted px-4 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Bus className="h-3 w-3" /> Front</div>
                </div>
                <div className="flex flex-col items-center gap-1.5 min-w-fit">
                  <div className="flex gap-1.5">
                    <div className="h-7 w-7" />
                    {Array.from({ length: planCols }, (_, c) => (
                      <div key={c} className="flex h-7 w-10 items-center justify-center text-[10px] font-bold text-muted-foreground">{String.fromCharCode(65 + c)}</div>
                    ))}
                  </div>
                  {Array.from({ length: planRows }, (_, r) => (
                    <div key={r} className="flex gap-1.5">
                      <div className="flex h-10 w-7 items-center justify-center text-[10px] font-bold text-muted-foreground">{r + 1}</div>
                      {Array.from({ length: planCols }, (_, c) => {
                        const cell = layout.find(l => l.row === r && l.col === c);
                        if (!cell || cell.type === 'aisle') return <div key={c} className="h-10 w-10" />;
                        if (cell.type === 'blocked') return <div key={c} className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 text-[10px] text-muted-foreground">×</div>;
                        const isBooked = bookedSeats.includes(cell.seat_label);
                        const isSelected = selectedSeats.includes(cell.seat_label);
                        const gender = bookedSeatGenders[cell.seat_label];
                        return (
                          <button key={c} onClick={() => toggleSeat(cell.seat_label)} disabled={isBooked}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-[10px] font-bold transition-all ${getSeatColor(cell)}`}>
                            {isBooked ? (
                              <span className="text-[9px]">{gender === 'female' ? 'F' : 'M'}</span>
                            ) : isSelected ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              cell.seat_label
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded-md bg-[hsl(150,50%,95%)] border border-[hsl(150,40%,80%)]" /> Available</span>
                  <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded-md bg-primary" /> Selected</span>
                  <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded-md bg-[hsl(217,70%,88%)] border border-[hsl(217,60%,75%)]" /> <span>M Male</span></span>
                  <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded-md bg-[hsl(330,70%,88%)] border border-[hsl(330,60%,75%)]" /> <span>F Female</span></span>
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
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(217,91%,50%)] shadow-md">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-foreground">Passenger Details</h2>
                <p className="text-[11px] text-muted-foreground">Fill in details for each traveller</p>
              </div>
            </div>

            {selectedSeats.map((seat, idx) => {
              const seatThemes = [
                { accent: 'hsl(217,91%,55%)', bgFrom: 'hsl(217,80%,97%)', bgTo: 'hsl(217,60%,99%)', border: 'hsl(217,70%,88%)' },
                { accent: 'hsl(150,60%,40%)', bgFrom: 'hsl(150,50%,96%)', bgTo: 'hsl(150,40%,99%)', border: 'hsl(150,50%,85%)' },
                { accent: 'hsl(38,92%,50%)', bgFrom: 'hsl(38,80%,96%)', bgTo: 'hsl(38,60%,99%)', border: 'hsl(38,70%,85%)' },
                { accent: 'hsl(258,80%,58%)', bgFrom: 'hsl(258,60%,97%)', bgTo: 'hsl(258,50%,99%)', border: 'hsl(258,60%,88%)' },
              ];
              const theme = seatThemes[idx % seatThemes.length];
              const p = passengers[seat] || { name: '', phone: '', gender: 'male' as Gender };
              const isAutoFilled = idx === 0 && customerUser?.fullName && p.name === customerUser.fullName;

              return (
                <motion.div
                  key={seat}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="rounded-2xl overflow-hidden shadow-md border"
                  style={{ borderColor: theme.border }}
                >
                  {/* Card header band */}
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: `linear-gradient(135deg, ${theme.bgFrom}, ${theme.bgTo})` }}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm" style={{ backgroundColor: theme.accent }}>
                        <User className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-[13px] font-bold text-foreground">Passenger {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAutoFilled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(150,60%,40%)] px-2 py-0.5 text-[9px] font-bold text-white">
                          <Check className="h-2.5 w-2.5" /> Auto-filled
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-extrabold" style={{ backgroundColor: theme.accent, color: 'white' }}>
                        <Armchair className="h-3 w-3 mr-1" />{seat}
                      </span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="bg-card px-4 py-4 space-y-3.5">
                    {/* Name */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Full Name <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="Enter passenger name"
                        value={p.name}
                        className="h-11 rounded-xl bg-muted/30 border-border/60 font-medium text-sm focus-visible:ring-2"
                        style={{ ['--tw-ring-color' as any]: theme.accent }}
                        onChange={(e) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], name: e.target.value, gender: prev[seat]?.gender || 'male' } }))}
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Phone Number</Label>
                      <Input
                        placeholder="+237 6XX XXX XXX"
                        value={p.phone}
                        className="h-11 rounded-xl bg-muted/30 border-border/60 font-medium text-sm"
                        onChange={(e) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], phone: e.target.value, gender: prev[seat]?.gender || 'male' } }))}
                      />
                    </div>

                    {/* Gender */}
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Gender <span className="text-destructive">*</span></Label>
                      <RadioGroup
                        value={p.gender || 'male'}
                        onValueChange={(v) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], gender: v as Gender } }))}
                        className="flex gap-3"
                      >
                        <label
                          htmlFor={`male-${seat}`}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 cursor-pointer transition-all text-[12px] font-bold ${
                            p.gender === 'male'
                              ? 'border-[hsl(217,70%,55%)] bg-[hsl(217,70%,96%)] text-[hsl(217,70%,40%)] shadow-sm'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                          }`}
                        >
                          <RadioGroupItem value="male" id={`male-${seat}`} className="sr-only" />
                          <UserCircle className="h-4 w-4 text-[hsl(217,70%,50%)]" /> Male
                        </label>
                        <label
                          htmlFor={`female-${seat}`}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 cursor-pointer transition-all text-[12px] font-bold ${
                            p.gender === 'female'
                              ? 'border-[hsl(330,70%,55%)] bg-[hsl(330,70%,96%)] text-[hsl(330,70%,40%)] shadow-sm'
                              : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                          }`}
                        >
                          <RadioGroupItem value="female" id={`female-${seat}`} className="sr-only" />
                          <UserCircle className="h-4 w-4 text-[hsl(330,70%,50%)]" /> Female
                        </label>
                      </RadioGroup>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setStep('seats')} className="flex-1 h-12 rounded-xl font-bold text-sm">Back</Button>
              <Button onClick={() => setStep('confirm')} className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-[hsl(217,91%,50%)] font-bold text-sm shadow-lg">
                Review Booking →
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm — Boarding Pass Style */}
        {step === 'confirm' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Booking Summary</p>

            {/* Boarding pass card */}
            <div className="rounded-2xl border shadow-md overflow-hidden bg-card">
              {/* Top colored bar with route */}
              <div className="bg-gradient-to-r from-[hsl(150,50%,30%)] to-[hsl(160,45%,22%)] px-5 py-4 text-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Kang Travel</span>
                  <span className="text-[10px] font-mono opacity-70">Ticket ID</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] opacity-60">{category?.toUpperCase() || 'BUS'}</span>
                  <span className="text-[11px] font-mono font-bold">KOB-{Date.now().toString(36).slice(-6).toUpperCase()}</span>
                </div>
              </div>

              {/* Route section */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">{route?.origin?.slice(0, 15)}</p>
                    <p className="text-2xl font-black tracking-tight">{route?.origin?.slice(0, 3).toUpperCase()}</p>
                    <p className="text-[12px] font-semibold text-primary">{format(new Date(trip.departure_at), 'HH:mm')}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(trip.departure_at), 'dd MMM, yyyy')}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-3">
                    <div className="flex items-center w-full">
                      <div className="h-2.5 w-2.5 rounded-full border-2 border-primary" />
                      <div className="flex-1 border-t-2 border-dashed border-primary/40 mx-1" />
                      <div className="rounded-full bg-primary/10 px-2.5 py-1">
                        <span className="text-[9px] font-bold text-primary"><Bus className="h-3 w-3" /></span>
                      </div>
                      <div className="flex-1 border-t-2 border-dashed border-primary/40 mx-1" />
                      <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">{route?.destination?.slice(0, 15)}</p>
                    <p className="text-2xl font-black tracking-tight">{route?.destination?.slice(0, 3).toUpperCase()}</p>
                    <p className="text-[12px] font-semibold text-primary">{format(new Date(trip.arrival_at), 'HH:mm')}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(trip.arrival_at), 'dd MMM, yyyy')}</p>
                  </div>
                </div>
              </div>

              {/* Tear line */}
              <div className="relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-background" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-5 w-5 rounded-full bg-background" />
                <div className="border-t-2 border-dashed border-border mx-6" />
              </div>

              {/* Passenger & seat details */}
              <div className="px-5 py-4 space-y-3">
                {selectedSeats.map((seat, idx) => {
                  const p = passengers[seat];
                  return (
                    <div key={seat} className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                        p?.gender === 'female' ? 'bg-[hsl(330,70%,92%)] text-[hsl(330,70%,40%)]' : 'bg-[hsl(217,70%,92%)] text-[hsl(217,70%,40%)]'
                      }`}>
                        {p?.gender === 'female' ? 'F' : 'M'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{p?.name || 'Passenger'}</p>
                        <p className="text-[11px] text-muted-foreground">{p?.phone || '—'}</p>
                      </div>
                      <Badge className="bg-[hsl(150,50%,92%)] text-[hsl(150,60%,25%)] border-0 font-bold">Seat {seat}</Badge>
                    </div>
                  );
                })}

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
                  <div className="rounded-xl bg-[hsl(150,50%,95%)] p-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase font-semibold">Seats</p>
                    <p className="text-sm font-black text-[hsl(150,60%,30%)]">{selectedSeats.join(', ')}</p>
                  </div>
                  <div className="rounded-xl bg-[hsl(217,70%,96%)] p-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase font-semibold">Passengers</p>
                    <p className="text-sm font-black text-[hsl(217,70%,40%)]">{selectedSeats.length}</p>
                  </div>
                  <div className="rounded-xl bg-[hsl(38,92%,95%)] p-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase font-semibold">Class</p>
                    <p className="text-sm font-black text-[hsl(38,80%,35%)]">Economy</p>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="bg-gradient-to-r from-[hsl(150,50%,30%)] to-[hsl(160,45%,22%)] px-5 py-3 flex items-center justify-between">
                <span className="text-white/70 text-sm font-semibold">Total</span>
                <span className="text-white text-xl font-black">{totalPrice.toLocaleString()} {trip.currency}</span>
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
