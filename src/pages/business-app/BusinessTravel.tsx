import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Bus, Route, Armchair, Calendar, BookOpen, ScanLine, Ticket, Users, Bell, MapPin, Sparkles, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const travelMenuItems = [
  { icon: Bus, label: 'Services', subtitle: 'Manage transport services', path: 'services', color: 'text-amber-600 bg-amber-500/10' },
  { icon: Route, label: 'Routes', subtitle: 'Configure routes & trips', path: 'routes', color: 'text-blue-600 bg-blue-500/10' },
  { icon: Armchair, label: 'Seating Plans', subtitle: 'Design seat layouts', path: 'seating', color: 'text-violet-600 bg-violet-500/10' },
  { icon: Calendar, label: 'Timetable', subtitle: 'Schedules & departures', path: 'timetable', color: 'text-emerald-600 bg-emerald-500/10' },
  { icon: BookOpen, label: 'Bookings', subtitle: 'View & manage bookings', path: 'bookings', color: 'text-sky-600 bg-sky-500/10' },
  { icon: MapPin, label: 'Counter Booking', subtitle: 'Walk-in ticket sales', path: 'counter-booking', color: 'text-teal-600 bg-teal-500/10' },
  { icon: ScanLine, label: 'Ticket Scanner', subtitle: 'Scan & validate tickets', path: 'scanner', color: 'text-rose-600 bg-rose-500/10' },
  { icon: Ticket, label: 'Discounts', subtitle: 'Promo codes & offers', path: 'discounts', color: 'text-orange-600 bg-orange-500/10' },
  { icon: Users, label: 'Staff Roles', subtitle: 'Manage travel staff', path: 'staff-roles', color: 'text-indigo-600 bg-indigo-500/10' },
  { icon: Bell, label: 'Notifications', subtitle: 'Alerts & messages', path: 'notifications', color: 'text-pink-600 bg-pink-500/10' },
  { icon: BookOpen, label: 'Guide', subtitle: 'How to use Travel Services', path: 'guide', color: 'text-foreground bg-muted' },
];

const BusinessTravel: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { merchantId } = useMerchantContext();

  const { data: services, isLoading } = useQuery({
    queryKey: ['biz-travel-services', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from('travel_services')
        .select('id, display_name, service_type, is_active')
        .eq('merchant_id', merchantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId,
  });

  const [busy, setBusy] = useState<null | 'seed' | 'clear'>(null);
  const activeCount = services?.filter(s => s.is_active).length || 0;

  const seedDemo = async () => {
    if (!merchantId) return;
    setBusy('seed');
    try {
      const { data, error } = await supabase.functions.invoke('travel-seed-demo-data', { body: { merchant_id: merchantId } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success('Demo travel data added.');
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to seed demo data');
    } finally { setBusy(null); }
  };

  const clearMine = async () => {
    if (!merchantId) return;
    setBusy('clear');
    try {
      const { data, error } = await supabase.functions.invoke('travel-admin-reset-data', {
        body: { scope: 'merchant', merchant_id: merchantId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const c = (data as any)?.deleted || {};
      toast.success(`Cleared · ${c.services || 0} services, ${c.bookings || 0} bookings`);
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to clear data');
    } finally { setBusy(null); }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <header className="pt-4 md:pt-0 mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Travel Services</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {isLoading ? 'Loading...' : `${activeCount} active service${activeCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[11px] rounded-xl" disabled={!!busy} onClick={seedDemo}>
            {busy === 'seed' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />}
            Demo Data
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[11px] rounded-xl border-destructive/40 text-destructive hover:bg-destructive/5" disabled={!!busy}>
                {busy === 'clear' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />}
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all travel data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes all your travel services, routes, trips, bookings, and tickets. Confirmed bookings will not be refunded automatically — cancel them first if needed. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearMine} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Clear Everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* Quick Stats */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : services && services.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl border border-border/40 bg-card p-3 text-center">
            <p className="text-lg font-bold text-foreground">{services.length}</p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{activeCount}</p>
            <p className="text-[11px] text-muted-foreground">Active</p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card p-3 text-center">
            <p className="text-lg font-bold text-foreground">{services.length - activeCount}</p>
            <p className="text-[11px] text-muted-foreground">Inactive</p>
          </div>
        </div>
      ) : null}

      {/* Navigation Grid */}
      <div className={cn('gap-3', isMobile ? 'space-y-2' : 'grid grid-cols-2 gap-3')}>
        {travelMenuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="w-full rounded-2xl border border-border/40 bg-card p-4 flex items-center gap-3.5 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
              onClick={() => navigate(`/biz/travel/${item.path}`)}
            >
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', item.color.split(' ')[1])}>
                <Icon className={cn('h-5 w-5', item.color.split(' ')[0])} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default BusinessTravel;
