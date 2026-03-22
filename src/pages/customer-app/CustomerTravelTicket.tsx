import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, CheckCircle, MapPin, Clock, Calendar, Download, AlertTriangle, Armchair } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { getTheme } from '@/lib/travel-theme';
import { QRCodeSVG } from 'qrcode.react';

const QRCodeDisplay: React.FC<{ value: string; themeColor?: string }> = ({ value, themeColor = '#1a1a1a' }) => (
  <div className="flex flex-col items-center gap-1">
    <div className="rounded-xl bg-white p-3 shadow-inner border border-gray-100">
      <QRCodeSVG
        value={value}
        size={144}
        level="H"
        marginSize={1}
        fgColor={themeColor}
        bgColor="#ffffff"
      />
    </div>
    <p className="text-[9px] font-mono text-gray-400">Scan at boarding gate</p>
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
  const [service, setService] = useState<any>(null);
  const [activeTicket, setActiveTicket] = useState(0);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Determine category from service_type
  const category = service?.service_type || 'bus';
  const theme = getTheme(category);
  const CatIcon = theme.icon;

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
        if (routeData) {
          const { data: svcData } = await supabase.from('travel_services').select('service_type, display_name').eq('id', (routeData as any).service_id).maybeSingle();
          setService(svcData);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [bookingId]);

  const handleDownloadPdf = () => {
    const ct = tickets[activeTicket];
    if (!ct) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 200] });

    doc.setFillColor(22, 78, 55);
    doc.rect(0, 0, 100, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('E-TICKET', 50, 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(booking.booking_ref || '', 50, 19, { align: 'center' });

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(route?.origin || '—', 10, 40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('→', 50, 40, { align: 'center' });
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(route?.destination || '—', 90, 40, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    if (trip) {
      doc.text(format(new Date(trip.departure_at), 'EEEE, dd MMM yyyy'), 10, 50);
      doc.text(`${format(new Date(trip.departure_at), 'HH:mm')} — ${format(new Date(trip.arrival_at), 'HH:mm')}`, 10, 56);
    }

    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(5, 64, 95, 64);
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

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Present your QR code at boarding gate.', 50, 115, { align: 'center' });
    doc.text('Arrive 30min–1hr before departure.', 50, 120, { align: 'center' });

    doc.save(`ticket-${booking.booking_ref || 'download'}.pdf`);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>;
  if (!booking) return <div className="p-4 text-center text-gray-400">Booking not found</div>;

  const currentTicket = tickets[activeTicket];
  const overlayBg = theme.fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.lightBg }}>
      {/* ── Header ── */}
      <div className="relative overflow-hidden px-5 pb-8 pt-4" style={{ backgroundColor: theme.color }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => navigate('/app/home')} className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-95 transition-transform" style={{ backgroundColor: overlayBg }}>
              <ChevronLeft className="h-5 w-5" style={{ color: theme.fg }} />
            </button>
            <div className="flex items-center gap-2">
              <CatIcon className="h-5 w-5" style={{ color: theme.fg }} />
              <h1 className="text-lg font-bold" style={{ color: theme.fg }}>E-Ticket</h1>
            </div>
            <div className="ml-auto rounded-full px-3 py-1" style={{ backgroundColor: overlayBg }}>
              <span className="text-[11px] font-mono font-bold" style={{ color: theme.fg }}>{booking.booking_ref}</span>
            </div>
          </div>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: overlayBg }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: theme.fg === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}>
              <CheckCircle className="h-6 w-6" style={{ color: theme.fg }} />
            </div>
            <div>
              <p className="font-bold text-[15px]" style={{ color: theme.fg }}>Booking Confirmed!</p>
              <p className="text-[12px]" style={{ color: theme.fg, opacity: 0.5 }}>Your ticket is ready. Present QR at boarding.</p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 px-5 -mt-5 pb-28 space-y-4">
        {/* Ticket pills */}
        {tickets.length > 1 && (
          <div className="flex gap-2 justify-center pt-1">
            {tickets.map((t: any, i: number) => (
              <button key={t.id} onClick={() => setActiveTicket(i)}
                className="rounded-full px-4 py-1.5 text-[12px] font-bold transition-all"
                style={activeTicket === i ? { backgroundColor: theme.color, color: theme.fg } : { backgroundColor: 'white', color: '#6b7280' }}>
                <Armchair className="inline h-3 w-3 mr-1" />Seat {t.seat_label}
              </button>
            ))}
          </div>
        )}

        {/* ═══ TICKET CARD ═══ */}
        {currentTicket && (
          <motion.div ref={ticketRef} key={currentTicket.id}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
            className="rounded-3xl bg-white shadow-xl overflow-hidden border border-gray-100">

            <div className="h-2" style={{ backgroundImage: `repeating-linear-gradient(to right, ${theme.color} 0px, ${theme.color} 6px, transparent 6px, transparent 12px)` }} />

            <div className="px-5 pt-5 pb-3">
              {route && (
                <div className="flex items-center justify-between gap-1 min-w-0">
                  <div className="text-center flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">From</p>
                    <p className="text-lg font-black text-[#0f1729] truncate">{route.origin}</p>
                  </div>
                  <div className="flex flex-col items-center shrink-0 px-2">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.color }} />
                      <div className="h-[2px] w-8" style={{ backgroundColor: theme.color + '40' }} />
                      <CatIcon className="h-4 w-4" style={{ color: theme.color }} />
                      <div className="h-[2px] w-8" style={{ backgroundColor: theme.color + '40' }} />
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.color }} />
                    </div>
                  </div>
                  <div className="text-center flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">To</p>
                    <p className="text-lg font-black text-[#0f1729] truncate">{route.destination}</p>
                  </div>
                </div>
              )}
            </div>

            {trip && (
              <div className="px-5 pb-3 flex gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold" style={{ backgroundColor: theme.accentLight, color: theme.accentText }}>
                  <Calendar className="h-3 w-3" />{format(new Date(trip.departure_at), 'EEE, dd MMM yyyy')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600">
                  <Clock className="h-3 w-3" />{format(new Date(trip.departure_at), 'HH:mm')} — {format(new Date(trip.arrival_at), 'HH:mm')}
                </span>
              </div>
            )}

            {/* Tear line */}
            <div className="relative flex items-center my-1">
              <div className="absolute -left-3 w-6 h-6 rounded-full" style={{ backgroundColor: theme.lightBg }} />
              <div className="absolute -right-3 w-6 h-6 rounded-full" style={{ backgroundColor: theme.lightBg }} />
              <div className="w-full border-t-2 border-dashed border-gray-200" />
            </div>

            <div className="px-5 py-4 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
              <QRCodeDisplay value={currentTicket.qr_code} themeColor={theme.color === '#ffbe0b' ? '#92400e' : theme.color} />
              <div className="flex-1 space-y-3 pt-1">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Passenger</p>
                  <p className="text-[15px] font-bold text-[#0f1729]">{currentTicket.passenger_name}</p>
                  {currentTicket.passenger_phone && <p className="text-[12px] text-gray-400 mt-0.5">{currentTicket.passenger_phone}</p>}
                </div>
                <div className="flex gap-3">
                  <div className="rounded-xl px-3 py-2 text-center" style={{ backgroundColor: theme.accentLight }}>
                    <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: theme.accentText }}>Seat</p>
                    <p className="text-lg font-black" style={{ color: theme.accentText }}>{currentTicket.seat_label}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-center ${currentTicket.ticket_status === 'valid' ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                    <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-800">Status</p>
                    <p className={`text-sm font-extrabold capitalize ${currentTicket.ticket_status === 'valid' ? 'text-emerald-700' : 'text-gray-500'}`}>{currentTicket.ticket_status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tear line */}
            <div className="relative flex items-center my-1">
              <div className="absolute -left-3 w-6 h-6 rounded-full" style={{ backgroundColor: theme.lightBg }} />
              <div className="absolute -right-3 w-6 h-6 rounded-full" style={{ backgroundColor: theme.lightBg }} />
              <div className="w-full border-t-2 border-dashed border-gray-200" />
            </div>

            <div className="px-5 py-4" style={{ backgroundColor: theme.accentLight }}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">Total Paid</p>
                  <p className="text-xl font-black" style={{ color: theme.accentText }}>{booking.total_amount?.toLocaleString()} <span className="text-sm font-bold">{booking.currency}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">Ref</p>
                  <p className="text-sm font-mono font-bold text-[#0f1729]">{booking.booking_ref}</p>
                </div>
              </div>
            </div>

            <div className="h-2" style={{ backgroundImage: `repeating-linear-gradient(to right, ${theme.color} 0px, ${theme.color} 6px, transparent 6px, transparent 12px)` }} />
          </motion.div>
        )}

        {/* Travel advice */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl p-4 flex items-start gap-3" style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a' }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-sm text-amber-900">Arrive Early</p>
            <p className="text-[12px] text-amber-700 leading-relaxed mt-0.5">
              Please arrive at the station <strong>30 minutes to 1 hour</strong> before your scheduled departure.
            </p>
          </div>
        </motion.div>

        <div className="flex gap-3">
          <Button onClick={handleDownloadPdf} className="flex-1 h-12 rounded-xl font-bold shadow-lg" style={{ backgroundColor: theme.color, color: theme.fg }}>
            <Download className="h-4 w-4 mr-2" /> Download Ticket
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
