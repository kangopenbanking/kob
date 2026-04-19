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

  const activeCount = services?.filter(s => s.is_active).length || 0;

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <header className="pt-4 md:pt-0 mb-5">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Travel Services</h1>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">
          {isLoading ? 'Loading...' : `${activeCount} active service${activeCount !== 1 ? 's' : ''}`}
        </p>
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
