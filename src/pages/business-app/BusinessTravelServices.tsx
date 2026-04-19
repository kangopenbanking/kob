import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bus, Compass, Plane, Train, Plus, Loader2, Check, ChevronRight, Ticket, Search, Eye, XCircle, RefreshCw, ScanLine, MapPin, Calendar, Monitor, ArrowLeft, Users, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

/* ── Category config ── */
const categories = [
  { key: 'bus', label: 'Bus Travel', icon: Bus, color: 'bg-[hsl(48,90%,52%)]', textColor: 'text-[hsl(0,0%,10%)]', available: true },
  { key: 'tours', label: 'Tours', icon: Compass, color: 'bg-[hsl(187,100%,42%)]', textColor: 'text-white', available: true },
  { key: 'airlines', label: 'Airlines', icon: Plane, color: 'bg-[hsl(0,65%,51%)]', textColor: 'text-white', available: false },
  { key: 'trains', label: 'Trains', icon: Train, color: 'bg-[hsl(0,0%,13%)]', textColor: 'text-white', available: false },
] as const;

type Tab = 'services' | 'bookings';

const BusinessTravelServices: React.FC = () => {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();
  const [activeTab, setActiveTab] = useState<Tab>('bookings');
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupType, setSetupType] = useState('');
  const [setupName, setSetupName] = useState('');
  const [saving, setSaving] = useState(false);

  // Booking state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  /* ── Data queries ── */
  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = useQuery({
    queryKey: ['biz-travel-services', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data } = await supabase.from('travel_services').select('*').eq('merchant_id', merchantId);
      return (data as any[]) || [];
    },
    enabled: !!merchantId,
  });

  const { data: bookingsData, isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ['biz-travel-bookings', merchantId],
    queryFn: async () => {
      if (!merchantId) return { bookings: [], tickets: [], routes: [], trips: [] };
      const { data: svcs } = await supabase.from('travel_services').select('id').eq('merchant_id', merchantId);
      const svcIds = (svcs || []).map((s: any) => s.id);
      if (!svcIds.length) return { bookings: [], tickets: [], routes: [], trips: [] };

      const { data: routeData } = await supabase.from('travel_routes').select('*').in('service_id', svcIds);
      const routeIds = (routeData || []).map((r: any) => r.id);
      if (!routeIds.length) return { bookings: [], tickets: [], routes: routeData || [], trips: [] };

      const { data: tripData } = await supabase.from('travel_trips').select('*').in('route_id', routeIds);
      const tripIds = (tripData || []).map((t: any) => t.id);
      if (!tripIds.length) return { bookings: [], tickets: [], routes: routeData || [], trips: tripData || [] };

      const { data: bookingData } = await supabase.from('travel_bookings').select('*').in('trip_id', tripIds).order('created_at', { ascending: false });
      const bookingIds = (bookingData || []).map((b: any) => b.id);
      const { data: ticketData } = bookingIds.length
        ? await supabase.from('travel_tickets').select('*').in('booking_id', bookingIds)
        : { data: [] };

      return {
        bookings: bookingData || [],
        tickets: ticketData || [],
        routes: routeData || [],
        trips: tripData || [],
      };
    },
    enabled: !!merchantId,
  });

  const { bookings = [], tickets = [], routes = [], trips = [] } = bookingsData || {};

  /* ── Derived data ── */
  const activeCount = services.filter((s: any) => s.is_active).length;
  const filtered = bookings.filter((b: any) => {
    if (statusFilter !== 'all' && b.booking_status !== statusFilter) return false;
    if (search && !b.booking_ref?.toLowerCase().includes(search.toLowerCase()) && !b.customer_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const totalRevenue = bookings.filter((b: any) => b.payment_status === 'paid').reduce((s: number, b: any) => s + (b.total_amount || 0), 0);

  /* ── Actions ── */
  const handleCreate = async () => {
    if (!merchantId || !setupName.trim()) return;
    setSaving(true);
    const cat = categories.find(c => c.key === setupType);
    const { error } = await supabase.from('travel_services').insert({
      merchant_id: merchantId,
      service_type: setupType,
      display_name: setupName.trim(),
      theme_color: cat?.key === 'bus' ? '#F5C518' : cat?.key === 'tours' ? '#00BCD4' : null,
    } as any);
    if (error) toast.error(extractEdgeFunctionError(error));
    else { toast.success(`${cat?.label} service created!`); setSetupOpen(false); refetchServices(); }
    setSaving(false);
  };

  const toggleActive = async (svc: any) => {
    await supabase.from('travel_services').update({ is_active: !svc.is_active } as any).eq('id', svc.id);
    refetchServices();
  };

  const cancelBooking = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('travel-cancel-booking', {
        body: { booking_id: id, reason: 'Cancelled by merchant' },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success(`Booking cancelled · refund ${(data as any)?.refund_amount?.toLocaleString() || 0} XAF`);
      refetchBookings();
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e));
    }
  };

  const formatXAF = (n: number) => new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/biz/travel')} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/60">
            <ArrowLeft className="h-4 w-4 text-foreground" strokeWidth={2} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight text-foreground">Travel Services</h1>
            <p className="text-[11px] text-muted-foreground">{activeCount} active service{activeCount !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Desktop advisory */}
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2.5 mb-4">
          <Monitor className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.8} />
          <div>
            <p className="text-[11px] font-semibold text-amber-700">Mobile Booking Manager</p>
            <p className="text-[10px] text-amber-600/80">For full management (routes, seating, timetables, staff), use the desktop Merchant Portal.</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-2xl bg-muted/60 p-1">
          {([['bookings', 'Bookings'], ['services', 'Services']] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 rounded-xl py-2.5 text-xs font-bold transition-all',
                activeTab === tab ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ────── BOOKINGS TAB ────── */}
        {activeTab === 'bookings' && (
          <motion.div key="bookings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 px-5 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Bookings', value: bookings.length, color: 'text-foreground' },
                { label: 'Revenue', value: formatXAF(totalRevenue), color: 'text-emerald-600' },
                { label: 'Passengers', value: tickets.length, color: 'text-foreground' },
              ].map((s, i) => (
                <div key={i} className="rounded-2xl border border-border/40 bg-card p-3 text-center">
                  <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Search & Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search ref or name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl text-xs" />
              </div>
              <div className="flex rounded-xl border border-border/40 overflow-hidden">
                {(['all', 'confirmed', 'cancelled'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-3 py-2 text-[10px] font-semibold capitalize transition-colors',
                      statusFilter === s ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted/60'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="rounded-xl gap-1.5 text-[11px] font-semibold flex-1 h-10 bg-foreground text-background hover:bg-foreground/90"
                onClick={() => navigate('/biz/travel/counter-booking')}
              >
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} /> Counter Booking
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5 text-[11px] font-semibold flex-1 h-10 border-border/50"
                onClick={() => navigate('/biz/travel/scanner')}
              >
                <ScanLine className="h-3.5 w-3.5" strokeWidth={1.8} /> Scan Ticket
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-xl h-10 w-10 shrink-0"
                onClick={() => refetchBookings()}
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.8} />
              </Button>
            </div>

            {/* Booking List */}
            {bookingsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Ticket className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm font-medium text-muted-foreground">No bookings found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Bookings from customers and counter sales appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((b: any) => {
                  const trip = trips.find((t: any) => t.id === b.trip_id);
                  const route = trip ? routes.find((r: any) => r.id === trip.route_id) : null;
                  const bTickets = tickets.filter((t: any) => t.booking_id === b.id);
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-border/40 bg-card p-3.5 active:bg-muted/40 transition-colors"
                      onClick={() => setSelectedBooking(b)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl shrink-0',
                          b.booking_status === 'confirmed' ? 'bg-emerald-500/10' : 'bg-rose-500/10',
                        )}>
                          <Ticket className={cn(
                            'h-4 w-4',
                            b.booking_status === 'confirmed' ? 'text-emerald-600' : 'text-rose-600',
                          )} strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[13px] font-bold font-mono text-foreground">{b.booking_ref}</p>
                            <Badge
                              variant={b.booking_status === 'confirmed' ? 'default' : 'destructive'}
                              className="text-[9px] h-5"
                            >
                              {b.booking_status}
                            </Badge>
                          </div>
                          {route && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {route.origin} → {route.destination}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] font-semibold text-foreground">{formatXAF(b.total_amount || 0)}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Users className="h-3 w-3" /> {bTickets.length}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(b.created_at), 'dd MMM, HH:mm')}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-2" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ────── SERVICES TAB ────── */}
        {activeTab === 'services' && (
          <motion.div key="services" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 px-5 space-y-4">
            {/* Category Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map(cat => {
                const existing = services.find((s: any) => s.service_type === cat.key);
                const CatIcon = cat.icon;
                return (
                  <div key={cat.key} className="relative rounded-2xl border border-border/40 bg-card p-4 overflow-hidden">
                    {!cat.available && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
                        <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
                      </div>
                    )}
                    <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-xl', cat.color)}>
                      <CatIcon className={cn('h-5 w-5', cat.textColor)} />
                    </div>
                    <p className="text-[13px] font-bold text-foreground mb-0.5">{cat.label}</p>
                    {existing ? (
                      <div className="space-y-2 mt-2">
                        <p className="text-[11px] text-muted-foreground truncate">{existing.display_name}</p>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={existing.is_active}
                            onCheckedChange={() => toggleActive(existing)}
                            className="scale-75 origin-left"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {existing.is_active ? 'Live' : 'Paused'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 rounded-xl text-[10px] h-8 w-full gap-1"
                        onClick={() => { setSetupType(cat.key); setSetupName(''); setSetupOpen(true); }}
                        disabled={!cat.available}
                      >
                        <Plus className="h-3 w-3" /> Set Up
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Active Services List */}
            {services.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Your Services</p>
                <div className="space-y-2">
                  {services.map((svc: any) => {
                    const cat = categories.find(c => c.key === svc.service_type);
                    const CatIcon = cat?.icon || Bus;
                    return (
                      <div key={svc.id} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3.5">
                        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', cat?.color || 'bg-muted')}>
                          <CatIcon className={cn('h-4 w-4', cat?.textColor || 'text-foreground')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate">{svc.display_name}</p>
                          <p className="text-[10px] text-muted-foreground">{cat?.label}</p>
                        </div>
                        <Badge variant={svc.is_active ? 'default' : 'secondary'} className="text-[9px] h-5">
                          {svc.is_active ? 'Active' : 'Off'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Desktop full management link */}
            <div className="rounded-2xl border border-border/40 bg-muted/30 p-4 text-center space-y-2">
              <BookOpen className="h-6 w-6 text-muted-foreground/40 mx-auto" strokeWidth={1.5} />
              <p className="text-xs font-medium text-muted-foreground">Routes, Seating Plans, Timetables & Staff</p>
              <p className="text-[10px] text-muted-foreground/60">
                These advanced features are available on the desktop Merchant Portal for the best experience.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──── Setup Service Sheet ──── */}
      <Sheet open={setupOpen} onOpenChange={setSetupOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-[2rem] border-t-0 px-5">
          <SheetHeader>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" />
            <SheetTitle className="text-left">Set Up {categories.find(c => c.key === setupType)?.label}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4 pb-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Agency / Brand Name</Label>
              <Input
                placeholder="e.g. Touristique Express"
                value={setupName}
                onChange={e => setSetupName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={!setupName.trim() || saving}
              className="w-full h-11 rounded-xl font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Create Service
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ──── Booking Detail Dialog ──── */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-sm rounded-3xl mx-4">
          <DialogHeader>
            <DialogTitle className="text-base">Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (() => {
            const trip = trips.find((t: any) => t.id === selectedBooking.trip_id);
            const route = trip ? routes.find((r: any) => r.id === trip.route_id) : null;
            const bTickets = tickets.filter((t: any) => t.booking_id === selectedBooking.id);
            return (
              <div className="space-y-4">
                {/* Route */}
                {route && (
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <p className="text-sm font-bold text-foreground">{route.origin} → {route.destination}</p>
                    {trip?.departure_at && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {format(new Date(trip.departure_at), 'PPp')}
                      </p>
                    )}
                  </div>
                )}

                {/* Details */}
                <div className="space-y-2">
                  {[
                    ['Reference', selectedBooking.booking_ref],
                    ['Amount', formatXAF(selectedBooking.total_amount || 0)],
                    ['Status', selectedBooking.booking_status],
                    ['Payment', selectedBooking.payment_status],
                    ['Booked', format(new Date(selectedBooking.created_at), 'dd MMM yyyy, HH:mm')],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-foreground capitalize">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Tickets */}
                {bTickets.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      Tickets ({bTickets.length})
                    </p>
                    <div className="space-y-1.5">
                      {bTickets.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between rounded-xl border border-border/40 p-2.5">
                          <div>
                            <p className="text-[12px] font-semibold text-foreground">{t.passenger_name}</p>
                            <p className="text-[10px] text-muted-foreground">Seat {t.seat_label} · {t.passenger_phone || 'No phone'}</p>
                          </div>
                          <Badge
                            variant={t.ticket_status === 'valid' ? 'default' : t.ticket_status === 'used' ? 'secondary' : 'destructive'}
                            className="text-[9px] h-5"
                          >
                            {t.ticket_status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cancel action */}
                {selectedBooking.booking_status === 'confirmed' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full rounded-xl h-10 text-xs gap-1.5"
                    onClick={() => { cancelBooking(selectedBooking.id); setSelectedBooking(null); }}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancel & Refund
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessTravelServices;
