import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, CheckCircle, MapPin, Clock, Calendar, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// Simple QR code generator using a free API (canvas-based would be ideal but this is lightweight)
const QRCodeDisplay: React.FC<{ value: string }> = ({ value }) => (
  <div className="flex flex-col items-center gap-2">
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=000000`}
      alt="QR Code"
      className="h-44 w-44 rounded-xl"
    />
    <p className="text-[10px] font-mono text-muted-foreground break-all max-w-[200px] text-center">{value}</p>
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
    const fetch = async () => {
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
    fetch();
  }, [bookingId]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!booking) return <div className="p-4 text-center text-muted-foreground">Booking not found</div>;

  const currentTicket = tickets[activeTicket];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-3 backdrop-blur-sm border-b">
        <button onClick={() => navigate('/app/home')} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">E-Ticket</h1>
        <Badge variant="outline" className="ml-auto">{booking.booking_ref}</Badge>
      </div>

      <div className="px-4 py-6 pb-24 space-y-5">
        {/* Success Banner */}
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-2 rounded-2xl bg-[hsl(150,40%,90%)] p-5 text-center">
          <CheckCircle className="h-10 w-10 text-[hsl(150,40%,35%)]" />
          <p className="text-lg font-bold text-[hsl(150,40%,25%)]">Booking Confirmed!</p>
          <p className="text-sm text-[hsl(150,40%,35%)]">Present this QR code at the boarding point</p>
        </motion.div>

        {/* Ticket selector if multiple */}
        {tickets.length > 1 && (
          <div className="flex gap-2 justify-center">
            {tickets.map((t: any, i: number) => (
              <button
                key={t.id}
                onClick={() => setActiveTicket(i)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeTicket === i ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              >
                Seat {t.seat_label}
              </button>
            ))}
          </div>
        )}

        {/* QR Ticket */}
        {currentTicket && (
          <motion.div key={currentTicket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex justify-center">
              <QRCodeDisplay value={currentTicket.qr_code} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{currentTicket.passenger_name}</span>
                <Badge variant="outline" className="ml-auto">Seat {currentTicket.seat_label}</Badge>
              </div>
              {currentTicket.passenger_phone && (
                <p className="text-sm text-muted-foreground pl-6">{currentTicket.passenger_phone}</p>
              )}
              <Badge variant={currentTicket.ticket_status === 'valid' ? 'default' : 'secondary'} className="capitalize">
                {currentTicket.ticket_status}
              </Badge>
            </div>
          </motion.div>
        )}

        {/* Journey Info */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Journey Details</p>
          {route && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{route.origin} → {route.destination}</span>
            </div>
          )}
          {trip && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(trip.departure_at), 'EEEE, dd MMMM yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{format(new Date(trip.departure_at), 'HH:mm')} → {format(new Date(trip.arrival_at), 'HH:mm')}</span>
              </div>
            </>
          )}
          <hr className="border-border" />
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total Paid</span>
            <span className="font-bold">{booking.total_amount?.toLocaleString()} {booking.currency}</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => navigate('/app/home')}>
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default CustomerTravelTicket;
