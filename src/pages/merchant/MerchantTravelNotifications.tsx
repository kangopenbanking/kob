import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bell, Send, Loader2, Users, Megaphone, Clock, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const notificationTypes = [
  { value: 'general', label: 'General Notice', icon: Info, color: 'text-blue-500' },
  { value: 'delay', label: 'Trip Delay', icon: Clock, color: 'text-amber-500' },
  { value: 'cancellation', label: 'Trip Cancellation', icon: AlertTriangle, color: 'text-destructive' },
  { value: 'schedule_change', label: 'Schedule Change', icon: Clock, color: 'text-purple-500' },
  { value: 'promotion', label: 'Promotion', icon: Megaphone, color: 'text-green-500' },
];

const MerchantTravelNotifications: React.FC = () => {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [notifType, setNotifType] = useState('general');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetTrip, setTargetTrip] = useState('all');
  const [targetAudience, setTargetAudience] = useState('all_passengers');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
    if (!merchant) { setLoading(false); return; }
    setMerchantId(merchant.id);

    // Fetch services, routes, trips
    const { data: svcs } = await supabase.from('travel_services').select('id').eq('merchant_id', merchant.id);
    const svcIds = (svcs || []).map((s: any) => s.id);

    if (svcIds.length > 0) {
      const { data: routeData } = await supabase.from('travel_routes').select('*').in('service_id', svcIds);
      setRoutes(routeData || []);
      const routeIds = (routeData || []).map((r: any) => r.id);
      if (routeIds.length > 0) {
        const { data: tripData } = await supabase.from('travel_trips').select('*').in('route_id', routeIds).eq('status', 'scheduled').order('departure_time', { ascending: true });
        setTrips(tripData || []);
      }
    }

    // Fetch sent notifications
    const { data: notifData } = await supabase
      .from('merchant_travel_notifications')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((notifData as any[]) || []);
    setLoading(false);
  };

  const sendNotification = async () => {
    if (!merchantId || !title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();

    // Get recipient count based on target
    let recipientsCount = 0;
    if (targetTrip !== 'all') {
      const { count } = await supabase.from('travel_bookings').select('id', { count: 'exact', head: true }).eq('trip_id', targetTrip).eq('booking_status', 'confirmed');
      recipientsCount = count || 0;
    } else {
      // All passengers across active trips
      const tripIds = trips.map(t => t.id);
      if (tripIds.length > 0) {
        const { count } = await supabase.from('travel_bookings').select('id', { count: 'exact', head: true }).in('trip_id', tripIds).eq('booking_status', 'confirmed');
        recipientsCount = count || 0;
      }
    }

    // Save notification record
    const { error } = await supabase.from('merchant_travel_notifications').insert({
      merchant_id: merchantId,
      trip_id: targetTrip !== 'all' ? targetTrip : null,
      notification_type: notifType,
      title: title.trim(),
      message: message.trim(),
      target_audience: targetAudience,
      recipients_count: recipientsCount,
      created_by: user?.id,
    } as any);

    if (error) {
      toast.error(extractEdgeFunctionError(error));
    } else {
      // Send in-app notifications to passengers
      if (targetTrip !== 'all') {
        const { data: bookings } = await supabase.from('travel_bookings').select('user_id').eq('trip_id', targetTrip).eq('booking_status', 'confirmed');
        const userIds = [...new Set((bookings || []).map((b: any) => b.user_id))];
        if (userIds.length > 0) {
          const notifs = userIds.map(uid => ({
            user_id: uid,
            type: notifType === 'cancellation' ? 'warning' : notifType === 'delay' ? 'warning' : 'info',
            title: title.trim(),
            message: message.trim(),
            icon: 'travel',
          }));
          await supabase.from('app_notifications').insert(notifs);
        }
      } else {
        const tripIds = trips.map(t => t.id);
        if (tripIds.length > 0) {
          const { data: bookings } = await supabase.from('travel_bookings').select('user_id').in('trip_id', tripIds).eq('booking_status', 'confirmed');
          const userIds = [...new Set((bookings || []).map((b: any) => b.user_id))];
          if (userIds.length > 0) {
            const notifs = userIds.map(uid => ({
              user_id: uid,
              type: 'info',
              title: title.trim(),
              message: message.trim(),
              icon: 'travel',
            }));
            await supabase.from('app_notifications').insert(notifs);
          }
        }
      }

      toast.success(`Notification sent to ${recipientsCount} passenger(s)`);
      setDialogOpen(false);
      setTitle('');
      setMessage('');
      setNotifType('general');
      setTargetTrip('all');
      fetchData();
    }
    setSending(false);
  };

  const getRouteForTrip = (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return null;
    return routes.find(r => r.id === trip.route_id);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Passenger Notifications</h1>
          <p className="text-sm text-muted-foreground">Send push notices and alerts to your passengers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Bell className="mr-2 h-4 w-4" /> Send Notification</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Send Push Notification</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Notification Type</Label>
                <Select value={notifType} onValueChange={setNotifType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {notificationTypes.map(nt => (
                      <SelectItem key={nt.value} value={nt.value}>{nt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Target Trip</Label>
                <Select value={targetTrip} onValueChange={setTargetTrip}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Active Trips</SelectItem>
                    {trips.map(t => {
                      const route = routes.find(r => r.id === t.route_id);
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          {route ? `${route.origin} → ${route.destination}` : 'Unknown'} · {format(new Date(t.departure_time), 'PP')}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="e.g. Trip Delay Notice" value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea placeholder="Write your message to passengers..." value={message} onChange={e => setMessage(e.target.value)} rows={4} />
              </div>

              <Button onClick={sendNotification} disabled={sending || !title.trim() || !message.trim()} className="w-full">
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send to Passengers
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{notifications.length}</p><p className="text-xs text-muted-foreground">Total Sent</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{notifications.reduce((s, n) => s + (n.recipients_count || 0), 0)}</p><p className="text-xs text-muted-foreground">Total Recipients</p></CardContent></Card>
        <Card className="col-span-2 sm:col-span-1"><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{trips.length}</p><p className="text-xs text-muted-foreground">Active Trips</p></CardContent></Card>
      </div>

      {/* Notification History */}
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
          <CardDescription>All notifications sent to passengers</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No notifications sent yet. Click "Send Notification" to get started.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map(n => {
                const typeInfo = notificationTypes.find(nt => nt.value === n.notification_type) || notificationTypes[0];
                const TypeIcon = typeInfo.icon;
                const route = n.trip_id ? getRouteForTrip(n.trip_id) : null;
                return (
                  <div key={n.id} className="flex items-start gap-3 rounded-lg border p-4">
                    <TypeIcon className={`h-5 w-5 mt-0.5 shrink-0 ${typeInfo.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{n.title}</p>
                        <Badge variant="outline" className="text-xs">{typeInfo.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 break-words">{n.message}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {n.recipients_count} recipients</span>
                        {route && <span>{route.origin} → {route.destination}</span>}
                        <span>{format(new Date(n.created_at), 'PPp')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantTravelNotifications;
