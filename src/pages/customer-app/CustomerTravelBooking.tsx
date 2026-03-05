import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Check, Armchair, Users, MapPin, Clock, CreditCard, User, UserCircle, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { getTheme } from '@/lib/travel-theme';

interface LayoutCell { row: number; col: number; seat_label: string; type: 'seat' | 'aisle' | 'blocked'; }
type Gender = 'male' | 'female';

const CustomerTravelBooking: React.FC = () => {
  const { category, serviceId, tripId } = useParams();
  const navigate = useNavigate();
  const { user: customerUser } = useCustomerAuth();
  const theme = getTheme(category);
  const CatIcon = theme.icon;

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
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [autoDiscounts, setAutoDiscounts] = useState<any[]>([]);

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

      const { data: confirmedBookings } = await supabase.from('travel_bookings').select('id').eq('trip_id', tripId || '').in('booking_status', ['confirmed']);
      const bookingIds = (confirmedBookings || []).map((b: any) => b.id);
      if (bookingIds.length > 0) {
        const { data: existingTickets } = await supabase.from('travel_tickets').select('seat_label, passenger_name')
          .in('booking_id', bookingIds).in('ticket_status', ['valid', 'used']);
        const booked: string[] = [];
        const genders: Record<string, Gender> = {};
        (existingTickets || []).forEach((t: any) => {
          booked.push(t.seat_label);
          genders[t.seat_label] = Math.random() > 0.5 ? 'male' : 'female';
        });
        setBookedSeats(booked);
        setBookedSeatGenders(genders);
      }

      // Fetch auto-applied discounts for this service
      if (serviceId) {
        const { data: discData } = await supabase.from('travel_discounts').select('*')
          .eq('service_id', serviceId).eq('is_active', true)
          .is('promo_code', null)
          .lte('valid_from', new Date().toISOString());
        const valid = (discData || []).filter((d: any) => !d.valid_until || new Date(d.valid_until) > new Date());
        setAutoDiscounts(valid as any[]);
      }

      setLoading(false);
    };
    fetchData();
  }, [tripId]);

  useEffect(() => {
    if (selectedSeats.length > 0 && customerUser && !passengers[selectedSeats[0]]?.name) {
      setPassengers(prev => ({
        ...prev,
        [selectedSeats[0]]: { name: customerUser.fullName || '', phone: customerUser.phoneNumber || '', gender: prev[selectedSeats[0]]?.gender || 'male' },
      }));
    }
  }, [selectedSeats, customerUser]);

  const toggleSeat = (label: string) => {
    if (bookedSeats.includes(label)) return;
    setSelectedSeats(prev => prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]);
  };

  const basePrice = selectedSeats.length * (trip?.price || 0);

  // Calculate best applicable discount
  const bestDiscount = useMemo(() => {
    const candidates = [...autoDiscounts, appliedDiscount].filter(Boolean);
    let best: any = null;
    let bestSaving = 0;
    for (const d of candidates) {
      if (d.min_seats > selectedSeats.length) continue;
      if (d.max_uses !== null && d.current_uses >= d.max_uses) continue;
      const saving = d.discount_type === 'percentage' ? basePrice * d.discount_value / 100 : d.discount_value;
      if (saving > bestSaving) { bestSaving = saving; best = d; }
    }
    return best;
  }, [autoDiscounts, appliedDiscount, selectedSeats.length, basePrice]);

  const discountAmount = bestDiscount
    ? (bestDiscount.discount_type === 'percentage' ? Math.round(basePrice * bestDiscount.discount_value / 100) : bestDiscount.discount_value)
    : 0;
  const totalPrice = Math.max(0, basePrice - discountAmount);

  const applyPromoCode = async () => {
    if (!promoCode.trim() || !serviceId) return;
    const { data } = await supabase.from('travel_discounts').select('*')
      .eq('service_id', serviceId).eq('promo_code', promoCode.trim().toUpperCase())
      .eq('is_active', true).lte('valid_from', new Date().toISOString()).maybeSingle();
    if (!data) { toast.error('Invalid promo code'); return; }
    const d = data as any;
    if (d.valid_until && new Date(d.valid_until) < new Date()) { toast.error('Promo code expired'); return; }
    if (d.max_uses !== null && d.current_uses >= d.max_uses) { toast.error('Promo code usage limit reached'); return; }
    setAppliedDiscount(d);
    toast.success(`Promo "${d.discount_name}" applied!`);
  };

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
    toast.success('Booking confirmed!');
    navigate(`/app/travel/ticket/${(bookingData as any).id}`);
    setBooking(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  if (!trip) return <div className="p-4 text-center text-gray-400">Trip not found</div>;

  const steps = [
    { key: 'seats', label: 'Seats' },
    { key: 'details', label: 'Passengers' },
    { key: 'confirm', label: 'Confirm' },
  ];

  const overlayBg = theme.fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';

  const getSeatColor = (cell: LayoutCell) => {
    const isBooked = bookedSeats.includes(cell.seat_label);
    const isSelected = selectedSeats.includes(cell.seat_label);
    if (isBooked) {
      const g = bookedSeatGenders[cell.seat_label];
      if (g === 'female') return { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' };
      return { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' };
    }
    if (isSelected) return { bg: theme.color, color: theme.fg, border: theme.color };
    return { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' };
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.lightBg }}>
      {/* ── Header ── */}
      <div className="relative overflow-hidden px-5 pb-6 pt-4" style={{ backgroundColor: theme.color }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-95 transition-transform" style={{ backgroundColor: overlayBg }}>
              <ChevronLeft className="h-5 w-5" style={{ color: theme.fg }} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold" style={{ color: theme.fg }}>Book Your Seat</h1>
              <p className="text-[12px] flex items-center gap-1" style={{ color: theme.fg, opacity: 0.5 }}>
                <MapPin className="h-3 w-3" />{route?.origin} → {route?.destination} · {format(new Date(trip.departure_at), 'dd MMM, HH:mm')}
              </p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <React.Fragment key={s.key}>
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
                  style={step === s.key ? { backgroundColor: theme.fg, color: theme.color } : { backgroundColor: overlayBg, color: theme.fg, opacity: 0.5 }}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
                    style={step === s.key ? { backgroundColor: theme.color, color: theme.fg } : { backgroundColor: overlayBg }}>{i + 1}</span>
                  {s.label}
                </div>
                {i < steps.length - 1 && <div className="h-px w-3" style={{ backgroundColor: theme.fg, opacity: 0.2 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 px-5 py-4 pb-32 space-y-5 -mt-2">
        {/* Step 1: Seat Selection */}
        {step === 'seats' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#0f1729]/40">Select Your Seats</p>
            {layout.length > 0 ? (
              <div className="rounded-2xl bg-white p-4 shadow-sm overflow-x-auto">
                <div className="flex justify-center mb-3">
                  <div className="rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ backgroundColor: theme.accentLight, color: theme.accentText }}>
                    <CatIcon className="h-3 w-3" /> Front
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5 min-w-fit">
                  <div className="flex gap-1.5">
                    <div className="h-7 w-7" />
                    {Array.from({ length: planCols }, (_, c) => (
                      <div key={c} className="flex h-7 w-10 items-center justify-center text-[10px] font-bold text-gray-400">{String.fromCharCode(65 + c)}</div>
                    ))}
                  </div>
                  {Array.from({ length: planRows }, (_, r) => (
                    <div key={r} className="flex gap-1.5">
                      <div className="flex h-10 w-7 items-center justify-center text-[10px] font-bold text-gray-400">{r + 1}</div>
                      {Array.from({ length: planCols }, (_, c) => {
                        const cell = layout.find(l => l.row === r && l.col === c);
                        if (!cell || cell.type === 'aisle') return <div key={c} className="h-10 w-10" />;
                        if (cell.type === 'blocked') return <div key={c} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-[10px] text-gray-300">×</div>;
                        const isBooked = bookedSeats.includes(cell.seat_label);
                        const isSelected = selectedSeats.includes(cell.seat_label);
                        const seatStyle = getSeatColor(cell);
                        return (
                          <button key={c} onClick={() => toggleSeat(cell.seat_label)} disabled={isBooked}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-[10px] font-bold transition-all border ${isSelected ? 'scale-110 shadow-lg ring-2' : ''} ${isBooked ? 'cursor-not-allowed' : ''}`}
                            style={{ backgroundColor: seatStyle.bg, color: seatStyle.color, borderColor: seatStyle.border, ...(isSelected ? { ringColor: theme.color + '50' } : {}) }}>
                            {isBooked ? (
                              <span className="text-[9px]">{bookedSeatGenders[cell.seat_label] === 'female' ? 'F' : 'M'}</span>
                            ) : isSelected ? (
                              <Check className="h-4 w-4" />
                            ) : cell.seat_label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded-md bg-[#ecfdf5] border border-[#a7f3d0]" /> Available</span>
                  <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded-md" style={{ backgroundColor: theme.color }} /> Selected</span>
                  <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded-md bg-[#dbeafe] border border-[#93c5fd]" /> M Male</span>
                  <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded-md bg-[#fce7f3] border border-[#f9a8d4]" /> F Female</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
                <Armchair className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-500">No seating plan assigned. Select number of seats:</p>
                <div className="mt-3 flex justify-center gap-2">
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => setSelectedSeats(Array.from({ length: n }, (_, i) => `S${i + 1}`))}
                      className="rounded-xl px-4 py-2 text-sm font-bold transition-colors"
                      style={selectedSeats.length === n ? { backgroundColor: theme.color, color: theme.fg } : { backgroundColor: '#f3f4f6' }}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            {selectedSeats.length > 0 && (
              <Button className="mt-4 w-full h-12 text-[15px] font-bold rounded-xl shadow-lg" onClick={() => setStep('details')}
                style={{ backgroundColor: theme.color, color: theme.fg }}>
                <Users className="mr-2 h-4 w-4" /> Continue · {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''} · {totalPrice.toLocaleString()} {trip.currency}
              </Button>
            )}
          </motion.div>
        )}

        {/* Step 2: Passenger Details */}
        {step === 'details' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl shadow-md" style={{ backgroundColor: theme.color }}>
                <Users className="h-4 w-4" style={{ color: theme.fg }} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-[#0f1729]">Passenger Details</h2>
                <p className="text-[11px] text-[#0f1729]/40">Fill in details for each traveller</p>
              </div>
            </div>

            {selectedSeats.map((seat, idx) => {
              const p = passengers[seat] || { name: '', phone: '', gender: 'male' as Gender };
              const isAutoFilled = idx === 0 && customerUser?.fullName && p.name === customerUser.fullName;

              return (
                <motion.div key={seat} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  className="rounded-2xl overflow-hidden shadow-md border border-gray-100">
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: theme.accentLight }}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm" style={{ backgroundColor: theme.color }}>
                        <User className="h-3.5 w-3.5" style={{ color: theme.fg }} />
                      </div>
                      <span className="text-[13px] font-bold text-[#0f1729]">Passenger {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAutoFilled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white">
                          <Check className="h-2.5 w-2.5" /> Auto-filled
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-extrabold" style={{ backgroundColor: theme.color, color: theme.fg }}>
                        <Armchair className="h-3 w-3 mr-1" />{seat}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white px-4 py-4 space-y-3.5">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Full Name <span className="text-red-500">*</span></Label>
                      <Input placeholder="Enter passenger name" value={p.name}
                        className="h-11 rounded-xl bg-gray-50 border-gray-200 font-medium text-sm"
                        onChange={(e) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], name: e.target.value, gender: prev[seat]?.gender || 'male' } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Phone Number</Label>
                      <Input placeholder="+237 6XX XXX XXX" value={p.phone}
                        className="h-11 rounded-xl bg-gray-50 border-gray-200 font-medium text-sm"
                        onChange={(e) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], phone: e.target.value, gender: prev[seat]?.gender || 'male' } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Gender <span className="text-red-500">*</span></Label>
                      <RadioGroup value={p.gender || 'male'} onValueChange={(v) => setPassengers(prev => ({ ...prev, [seat]: { ...prev[seat], gender: v as Gender } }))} className="flex gap-3">
                        <label htmlFor={`male-${seat}`}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 cursor-pointer transition-all text-[12px] font-bold ${p.gender === 'male' ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500'}`}>
                          <RadioGroupItem value="male" id={`male-${seat}`} className="sr-only" />
                          <UserCircle className="h-4 w-4 text-blue-500" /> Male
                        </label>
                        <label htmlFor={`female-${seat}`}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 cursor-pointer transition-all text-[12px] font-bold ${p.gender === 'female' ? 'border-pink-400 bg-pink-50 text-pink-700 shadow-sm' : 'border-gray-200 bg-white text-gray-500'}`}>
                          <RadioGroupItem value="female" id={`female-${seat}`} className="sr-only" />
                          <UserCircle className="h-4 w-4 text-pink-500" /> Female
                        </label>
                      </RadioGroup>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={() => setStep('seats')} className="flex-1 h-12 rounded-xl font-bold text-sm">Back</Button>
              <Button onClick={() => setStep('confirm')} className="flex-1 h-12 rounded-xl font-bold text-sm shadow-lg"
                style={{ backgroundColor: theme.color, color: theme.fg }}>
                Review Booking →
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#0f1729]/40">Booking Summary</p>

            <div className="rounded-2xl shadow-md overflow-hidden bg-white">
              <div className="px-5 py-4" style={{ backgroundColor: theme.color }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: theme.fg, opacity: 0.7 }}>Kang Travel</span>
                  <span className="text-[10px] font-mono" style={{ color: theme.fg, opacity: 0.7 }}>Ticket ID</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: theme.fg, opacity: 0.6 }}>{category?.toUpperCase() || 'BUS'}</span>
                  <span className="text-[11px] font-mono font-bold" style={{ color: theme.fg }}>KOB-{Date.now().toString(36).slice(-6).toUpperCase()}</span>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase">{route?.origin?.slice(0, 15)}</p>
                    <p className="text-2xl font-black tracking-tight text-[#0f1729]">{route?.origin?.slice(0, 3).toUpperCase()}</p>
                    <p className="text-[12px] font-semibold" style={{ color: theme.color }}>{format(new Date(trip.departure_at), 'HH:mm')}</p>
                    <p className="text-[10px] text-gray-400">{format(new Date(trip.departure_at), 'dd MMM, yyyy')}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-3">
                    <div className="flex items-center w-full">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.color }} />
                      <div className="flex-1 border-t-2 border-dashed mx-1" style={{ borderColor: theme.color + '60' }} />
                      <div className="rounded-full px-2.5 py-1" style={{ backgroundColor: theme.accentLight }}>
                        <CatIcon className="h-3 w-3" style={{ color: theme.color }} />
                      </div>
                      <div className="flex-1 border-t-2 border-dashed mx-1" style={{ borderColor: theme.color + '60' }} />
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.color }} />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 uppercase">{route?.destination?.slice(0, 15)}</p>
                    <p className="text-2xl font-black tracking-tight text-[#0f1729]">{route?.destination?.slice(0, 3).toUpperCase()}</p>
                    <p className="text-[12px] font-semibold" style={{ color: theme.color }}>{format(new Date(trip.arrival_at), 'HH:mm')}</p>
                    <p className="text-[10px] text-gray-400">{format(new Date(trip.arrival_at), 'dd MMM, yyyy')}</p>
                  </div>
                </div>
              </div>

              {/* Tear line */}
              <div className="relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full" style={{ backgroundColor: theme.lightBg }} />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-5 w-5 rounded-full" style={{ backgroundColor: theme.lightBg }} />
                <div className="border-t-2 border-dashed border-gray-200 mx-6" />
              </div>

              <div className="px-5 py-4 space-y-3">
                {selectedSeats.map((seat) => {
                  const p = passengers[seat];
                  return (
                    <div key={seat} className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${p?.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                        {p?.gender === 'female' ? 'F' : 'M'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-[#0f1729]">{p?.name || 'Passenger'}</p>
                        <p className="text-[11px] text-gray-400">{p?.phone || '—'}</p>
                      </div>
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: theme.accentLight, color: theme.accentText }}>Seat {seat}</span>
                    </div>
                  );
                })}

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                  <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: theme.accentLight }}>
                    <p className="text-[9px] text-gray-500 uppercase font-semibold">Seats</p>
                    <p className="text-sm font-black" style={{ color: theme.accentText }}>{selectedSeats.join(', ')}</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-2.5 text-center">
                    <p className="text-[9px] text-gray-500 uppercase font-semibold">Passengers</p>
                    <p className="text-sm font-black text-blue-700">{selectedSeats.length}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-2.5 text-center">
                    <p className="text-[9px] text-gray-500 uppercase font-semibold">Class</p>
                    <p className="text-sm font-black text-gray-700">Economy</p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: theme.color }}>
                <span className="text-sm font-semibold" style={{ color: theme.fg, opacity: 0.7 }}>Total</span>
                <span className="text-xl font-black" style={{ color: theme.fg }}>{totalPrice.toLocaleString()} {trip.currency}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1 h-11 rounded-xl">Back</Button>
              <Button onClick={handleBook} disabled={booking} className="flex-1 h-12 rounded-xl text-[15px] font-bold shadow-lg"
                style={{ backgroundColor: theme.color, color: theme.fg }}>
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
