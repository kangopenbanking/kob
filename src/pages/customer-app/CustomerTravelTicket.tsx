import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, CheckCircle, MapPin, Clock, Calendar, User, Download, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const QRCodeDisplay: React.FC<{ value: string }> = ({ value }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="rounded-2xl bg-white p-3 shadow-inner">
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=000000&margin=4`}
        alt="QR Code" className="h-44 w-44 rounded-xl"
      />
    </div>
    <p className="text-[10px] font-mono text-muted-foreground break-all max-w-[200px] text-center">{value.slice(0, 18)}...</p>
  </div>
);

const CustomerTravelTicket: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [trip, setTrip] = useState<any>(null);
  const [route, setRoute] = useState<any>(null);
  const [activeTicket, setActiveTicket] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const { data: bookingData } = await supabase.from('travel_bookings').select('*').eq('id', bookingId || '').maybeSingle();
      if (!bookingData) { setLoading(false); return; }
      setBooking(bookingData);

      const [ticketRes, tripRes] = await Promise.all([
        supabase.from('travel_tickets').select('*').eq('booking_id', bookingId || ''),
        supabase.from('travel_trips').select('*').eq('id', (bookingData as any).trip_id).maybeSingle(),
      ]);
      setTickets((ticketRes.data as any[]) || []);
      const tripData = tripRes.data as any;
      setTrip(tripData);

      if (tripData?.route_id) {
        const { data: routeData } = await supabase.from('travel_routes').select('*').eq('id', tripData.route_id).maybeSingle();
        setRoute(routeData);
      }
      setLoading(false);
    };
    fetchData();
  }, [bookingId]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!booking) return <div className="p-4 text-center text-muted-foreground">Booking not found</div>;

  const currentTicket = tickets[activeTicket];

  return (
    <div className="min-h-screen bg-background">
      {/* Dark header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(150,50%,25%)] to-[hsl(160,45%,18%)] px-4 pb-6 pt-3">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(150,60%,40%/0.2),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/app/home')} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <h1 className="text-lg font-bold text-white">E-Ticket</h1>
            <Badge className="ml-auto border-0 bg-white/15 text-white text-[11px]">{booking.booking_ref}</Badge>
          </div>
          {/* Success */}
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <CheckCircle className="h-8 w-8 text-[hsl(150,70%,65%)]" />
            <div>
              <p className="font-bold text-white">Booking Confirmed!</p>
              <p className="text-[12px] text-white/60">Present this QR code at boarding</p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 px-4 -mt-3 pb-24 space-y-4">
        {/* Ticket selector */}
        {tickets.length > 1 && (
          <div className="flex gap-2 justify-center">
            {tickets.map((t: any, i: number) => (
              <button key={t.id} onClick={() => setActiveTicket(i)}
                className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors ${activeTicket === i ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                Seat {t.seat_label}
              </button>
            ))}
          </div>
        )}

        {/* QR Ticket card */}
        {currentTicket && (
          <motion.div key={currentTicket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border bg-gradient-to-b from-card to-[hsl(150,50%,25%/0.04)] p-6 shadow-md text-center space-y-4"
            <QRCodeDisplay value={currentTicket.qr_code} />
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{currentTicket.passenger_name}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">Seat {currentTicket.seat_label}</Badge>
              </div>
              {currentTicket.passenger_phone && <p className="text-[13px] text-muted-foreground pl-6">{currentTicket.passenger_phone}</p>}
              <Badge variant={currentTicket.ticket_status === 'valid' ? 'default' : 'secondary'} className="capitalize">{currentTicket.ticket_status}</Badge>
            </div>
          </motion.div>
        )}

        {/* Journey details */}
        <div className="rounded-2xl border bg-card p-5 space-y-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Journey Details</p>
          {route && (
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><span className="font-semibold text-sm">{route.origin} → {route.destination}</span></div>
          )}
          {trip && (
            <>
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Calendar className="h-4 w-4" />{format(new Date(trip.departure_at), 'EEEE, dd MMMM yyyy')}</div>
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Clock className="h-4 w-4" />{format(new Date(trip.departure_at), 'HH:mm')} → {format(new Date(trip.arrival_at), 'HH:mm')}</div>
            </>
          )}
          <div className="border-t border-border pt-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Paid</span>
            <span className="text-lg font-black">{booking.total_amount?.toLocaleString()} {booking.currency}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => navigate('/app/home')}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CustomerTravelTicket;
