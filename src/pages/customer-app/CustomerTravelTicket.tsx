import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, CheckCircle, MapPin, Clock, Calendar, User, Download, Bus, AlertTriangle, Armchair } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

const QRCodeDisplay: React.FC<{ value: string }> = ({ value }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="rounded-xl bg-white p-2.5 shadow-inner border border-border/50">
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=1a1a1a&margin=2`}
        alt="QR Code" className="h-36 w-36 rounded-lg"
      />
    </div>
    <p className="text-[9px] font-mono text-muted-foreground/60">Scan at boarding gate</p>
  </div>
);

const TicketDivider: React.FC = () => (
  <div className="relative flex items-center my-1">
    <div className="absolute -left-8 w-6 h-6 rounded-full bg-background border-r border-border" />
    <div className="absolute -right-8 w-6 h-6 rounded-full bg-background border-l border-border" />
    <div className="w-full border-t-2 border-dashed border-border/60" />
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
  const ticketRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadPdf = () => {
    const ct = tickets[activeTicket];
    if (!ct) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 200] });

    // Header band
    doc.setFillColor(22, 78, 55);
    doc.rect(0, 0, 100, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('E-TICKET', 50, 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(booking.booking_ref || '', 50, 19, { align: 'center' });

    // Route
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const origin = route?.origin || '—';
    const dest = route?.destination || '—';
    doc.text(origin, 10, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('→', 50, 40, { align: 'center' });
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(dest, 90, 40, { align: 'right' });

    // Date & Time
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    if (trip) {
      doc.text(format(new Date(trip.departure_at), 'EEEE, dd MMM yyyy'), 10, 50);
      doc.text(`${format(new Date(trip.departure_at), 'HH:mm')} — ${format(new Date(trip.arrival_at), 'HH:mm')}`, 10, 56);
    }

    // Dashed line
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(5, 64, 95, 64);

    // Passenger info
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('PASSENGER', 10, 72);
    doc.text('SEAT', 65, 72);
    doc.text('STATUS', 80, 72);

    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(ct.passenger_name || '—', 10, 79);
    doc.text(ct.seat_label || '—', 65, 79);
    doc.setFontSize(9);
    doc.setTextColor(22, 128, 70);
    doc.text((ct.ticket_status || 'valid').toUpperCase(), 80, 79);

    // Amount
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(5, 86, 95, 86);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('TOTAL PAID', 10, 94);
    doc.setFontSize(13);
    doc.setTextColor(22, 78, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(`${booking.total_amount?.toLocaleString()} ${booking.currency}`, 10, 101);

    // QR placeholder note
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Present your QR code at boarding gate.', 50, 115, { align: 'center' });
    doc.text('Arrive 30min–1hr before departure.', 50, 120, { align: 'center' });

    doc.save(`ticket-${booking.booking_ref || 'download'}.pdf`);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!booking) return <div className="p-4 text-center text-muted-foreground">Booking not found</div>;

  const currentTicket = tickets[activeTicket];

  return (
    <div className="min-h-screen bg-[hsl(150,20%,96%)]">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(150,55%,28%)] via-[hsl(155,50%,22%)] to-[hsl(160,48%,16%)] px-4 pb-10 pt-3">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(150,70%,45%/0.15),transparent_50%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[hsl(150,55%,28%/0.3)] to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => navigate('/app/home')} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm active:scale-95 transition-transform">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-[hsl(45,100%,65%)]" />
              <h1 className="text-lg font-bold text-white">E-Ticket</h1>
            </div>
            <Badge className="ml-auto border-0 bg-[hsl(45,100%,50%/0.2)] text-[hsl(45,100%,75%)] text-[11px] font-mono">{booking.booking_ref}</Badge>
          </div>
          {/* Success banner */}
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(150,70%,50%/0.2)]">
              <CheckCircle className="h-6 w-6 text-[hsl(150,70%,65%)]" />
            </div>
            <div>
              <p className="font-bold text-white text-[15px]">Booking Confirmed!</p>
              <p className="text-[12px] text-white/50">Your ticket is ready. Present the QR code at boarding.</p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 px-4 -mt-5 pb-28 space-y-4">
        {/* Ticket selector pills */}
        {tickets.length > 1 && (
          <div className="flex gap-2 justify-center pt-1">
            {tickets.map((t: any, i: number) => (
              <button key={t.id} onClick={() => setActiveTicket(i)}
                className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-all ${activeTicket === i
                  ? 'bg-[hsl(150,55%,28%)] text-white shadow-md'
                  : 'bg-white text-muted-foreground border border-border shadow-sm'}`}>
                <Armchair className="inline h-3 w-3 mr-1" />Seat {t.seat_label}
              </button>
            ))}
          </div>
        )}

        {/* ═══ TICKET CARD ═══ */}
        {currentTicket && (
          <motion.div ref={ticketRef} key={currentTicket.id}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="rounded-3xl bg-white shadow-xl overflow-hidden border border-border/40">

            {/* Top color band */}
            <div className="bg-gradient-to-r from-[hsl(150,55%,30%)] via-[hsl(155,50%,35%)] to-[hsl(45,90%,50%)] h-2" />

            {/* Route header */}
            <div className="px-4 sm:px-6 pt-5 pb-3">
              {route && (
                <div className="flex items-center justify-between gap-1 min-w-0">
                  <div className="text-center flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">From</p>
                    <p className="text-base sm:text-xl font-black text-foreground truncate">{route.origin}</p>
                  </div>
                  <div className="flex flex-col items-center shrink-0 px-1 sm:px-4">
                    <div className="flex items-center gap-0.5 sm:gap-1">
                      <div className="h-2 w-2 rounded-full bg-[hsl(150,55%,35%)]" />
                      <div className="h-[2px] w-6 sm:w-12 bg-gradient-to-r from-[hsl(150,55%,35%)] to-[hsl(45,90%,50%)]" />
                      <Bus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[hsl(45,90%,45%)] shrink-0" />
                      <div className="h-[2px] w-6 sm:w-12 bg-gradient-to-r from-[hsl(45,90%,50%)] to-[hsl(150,55%,35%)]" />
                      <div className="h-2 w-2 rounded-full bg-[hsl(150,55%,35%)]" />
                    </div>
                  </div>
                  <div className="text-center flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">To</p>
                    <p className="text-base sm:text-xl font-black text-foreground truncate">{route.destination}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Date/time chips */}
            {trip && (
              <div className="px-4 sm:px-6 pb-3 flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(150,40%,94%)] px-2.5 py-1.5 text-[10px] sm:text-[11px] font-semibold text-[hsl(150,55%,25%)]">
                  <Calendar className="h-3 w-3 shrink-0" />{format(new Date(trip.departure_at), 'EEE, dd MMM yyyy')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(217,40%,94%)] px-2.5 py-1.5 text-[10px] sm:text-[11px] font-semibold text-[hsl(217,70%,40%)]">
                  <Clock className="h-3 w-3 shrink-0" />{format(new Date(trip.departure_at), 'HH:mm')} — {format(new Date(trip.arrival_at), 'HH:mm')}
                </span>
              </div>
            )}

            {/* ─── Tear line ─── */}
            <TicketDivider />

            {/* QR + Passenger section */}
            <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start">
              <QRCodeDisplay value={currentTicket.qr_code} />
              <div className="flex-1 space-y-3 pt-1">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Passenger</p>
                  <p className="text-[15px] font-bold text-foreground leading-tight">{currentTicket.passenger_name}</p>
                  {currentTicket.passenger_phone && (
                    <p className="text-[12px] text-muted-foreground mt-0.5">{currentTicket.passenger_phone}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="rounded-xl bg-[hsl(45,95%,92%)] px-3 py-2 text-center">
                    <p className="text-[8px] font-bold uppercase text-[hsl(45,80%,35%)] tracking-wider">Seat</p>
                    <p className="text-lg font-black text-[hsl(45,85%,38%)]">{currentTicket.seat_label}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-center ${currentTicket.ticket_status === 'valid' ? 'bg-[hsl(150,50%,92%)]' : 'bg-muted'}`}>
                    <p className="text-[8px] font-bold uppercase tracking-wider text-[hsl(150,50%,30%)]">Status</p>
                    <p className={`text-sm font-extrabold capitalize ${currentTicket.ticket_status === 'valid' ? 'text-[hsl(150,60%,32%)]' : 'text-muted-foreground'}`}>{currentTicket.ticket_status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Tear line ─── */}
            <TicketDivider />

            {/* Amount footer */}
            <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-[hsl(150,30%,96%)] to-[hsl(45,40%,96%)]">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Total Paid</p>
                  <p className="text-xl font-black text-[hsl(150,55%,28%)]">{booking.total_amount?.toLocaleString()} <span className="text-sm font-bold">{booking.currency}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Ref</p>
                  <p className="text-sm font-mono font-bold text-foreground">{booking.booking_ref}</p>
                </div>
              </div>
            </div>

            {/* Bottom color band */}
            <div className="bg-gradient-to-r from-[hsl(45,90%,50%)] via-[hsl(155,50%,35%)] to-[hsl(150,55%,30%)] h-2" />
          </motion.div>
        )}

        {/* Travel advice */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl bg-[hsl(38,92%,95%)] border border-[hsl(38,70%,85%)] p-4 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(38,90%,50%/0.15)]">
            <AlertTriangle className="h-4.5 w-4.5 text-[hsl(38,85%,45%)]" />
          </div>
          <div>
            <p className="font-bold text-sm text-[hsl(38,60%,25%)]">Arrive Early</p>
            <p className="text-[12px] text-[hsl(38,40%,35%)] leading-relaxed mt-0.5">
              Please arrive at the station <strong>30 minutes to 1 hour</strong> before your scheduled departure to allow time for check-in and boarding.
            </p>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handleDownloadPdf}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[hsl(150,55%,30%)] to-[hsl(155,50%,38%)] text-white font-bold shadow-lg hover:opacity-90 transition-opacity"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Ticket
          </Button>
        </div>

        <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => navigate('/app/home')}>
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default CustomerTravelTicket;
