import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Ticket, Clock, Search, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: '#dcfce7', text: '#166534', label: 'Confirmed' },
  cancelled: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
  completed: { bg: '#e0e7ff', text: '#3730a3', label: 'Completed' },
};

const CustomerTravelHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchHistory = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setLoading(false); return; }

      const { data: bookingData } = await supabase.from('travel_bookings').select('*')
        .eq('user_id', authUser.id).order('created_at', { ascending: false });
      setBookings(bookingData || []);

      if (!bookingData?.length) { setLoading(false); return; }

      const bookingIds = bookingData.map((b: any) => b.id);
      const tripIds = [...new Set(bookingData.map((b: any) => b.trip_id))];

      const [ticketRes, tripRes] = await Promise.all([
        supabase.from('travel_tickets').select('*').in('booking_id', bookingIds),
        supabase.from('travel_trips').select('*').in('id', tripIds),
      ]);
      setTickets(ticketRes.data || []);
      setTrips(tripRes.data || []);

      const routeIds = [...new Set((tripRes.data || []).map((t: any) => t.route_id))];
      if (routeIds.length) {
        const { data: routeData } = await supabase.from('travel_routes').select('*').in('id', routeIds);
        setRoutes(routeData || []);
      }
      setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('travel-cancel-booking', {
        body: { booking_id: cancelTarget.id, reason: 'customer_request' },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(
        data.refund_amount > 0
          ? `Booking cancelled. ${data.refund_amount.toLocaleString()} ${data.currency} refunded to your wallet.`
          : 'Booking cancelled. No refund applies for late cancellation.'
      );
      setCancelTarget(null);
      await fetchHistory();
    } catch (e: any) {
      toast.error(e.message || 'Cancellation failed');
    } finally {
      setCancelling(false);
    }
  };


  const filtered = bookings.filter(b => {
    if (statusFilter !== 'all' && b.booking_status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const trip = trips.find(t => t.id === b.trip_id);
      const route = trip ? routes.find(r => r.id === trip.route_id) : null;
      const matchRef = b.booking_ref?.toLowerCase().includes(q);
      const matchRoute = route && (`${route.origin} ${route.destination}`).toLowerCase().includes(q);
      if (!matchRef && !matchRoute) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-foreground px-5 pb-8 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/10 active:scale-95 transition-transform">
            <ChevronLeft className="h-5 w-5 text-background" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Booking History</h1>
            <p className="text-xs text-white/50">{bookings.length} total booking{bookings.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            placeholder="Search by reference or route..."
            className="w-full rounded-xl bg-white/10 border-none text-white placeholder:text-white/30 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 py-3 flex gap-2 overflow-x-auto">
        {['all', 'confirmed', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${statusFilter === s ? 'bg-[#0f1729] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-5 pb-32 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Ticket className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No bookings found</p>
            <p className="text-xs text-gray-300 mt-1">Your travel bookings will appear here</p>
          </div>
        ) : (
          filtered.map((b, i) => {
            const trip = trips.find(t => t.id === b.trip_id);
            const route = trip ? routes.find(r => r.id === trip.route_id) : null;
            const bTickets = tickets.filter(t => t.booking_id === b.id);
            const status = statusStyles[b.booking_status] || statusStyles.confirmed;
            return (
              <motion.div key={b.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
                onClick={() => {
                  if (bTickets.length > 0) navigate(`/app/travel/ticket/${b.id}`);
                }}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f1729]/5">
                        <Ticket className="h-4 w-4 text-[#0f1729]/60" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[#0f1729]">{route ? `${route.origin} → ${route.destination}` : 'Trip'}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{b.booking_ref}</p>
                      </div>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: status.bg, color: status.text }}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-gray-400 mt-3">
                    {trip && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(trip.departure_at), 'dd MMM, HH:mm')}
                      </span>
                    )}
                    <span>{bTickets.length} ticket{bTickets.length !== 1 ? 's' : ''}</span>
                    <span className="ml-auto font-bold text-[#0f1729] text-[13px]">
                      {b.total_amount?.toLocaleString()} {b.currency}
                    </span>
                  </div>

                  {b.payment_method === 'cash' && (
                    <span className="inline-block mt-2 rounded-full px-2 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Cash Payment
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CustomerTravelHistory;
