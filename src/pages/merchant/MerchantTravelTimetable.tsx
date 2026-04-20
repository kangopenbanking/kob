import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, Calendar, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface TimetableEntry {
  id: string; route_id: string; day_of_week: number;
  departure_time: string; arrival_time: string; price: number; is_active: boolean;
}

const MerchantTravelTimetable: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<any[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [formRouteId, setFormRouteId] = useState('');
  const [formDay, setFormDay] = useState('1');
  const [formDeparture, setFormDeparture] = useState('08:00');
  const [formArrival, setFormArrival] = useState('12:00');
  const [formPrice, setFormPrice] = useState('5000');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
    if (!merchant) { setLoading(false); return; }

    const { data: svcs } = await supabase.from('travel_services').select('id').eq('merchant_id', merchant.id);
    const svcIds = (svcs || []).map((s: any) => s.id);
    if (svcIds.length === 0) { setLoading(false); return; }

    const { data: routeData } = await supabase.from('travel_routes').select('*').in('service_id', svcIds);
    setRoutes(routeData || []);
    const routeIds = (routeData || []).map((r: any) => r.id);

    if (routeIds.length > 0) {
      const { data: ttData } = await supabase.from('travel_timetables').select('*').in('route_id', routeIds).order('day_of_week');
      setEntries((ttData as TimetableEntry[]) || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!formRouteId || !formDeparture || !formArrival) return;
    setSaving(true);
    const { error } = await supabase.from('travel_timetables').insert({
      route_id: formRouteId,
      day_of_week: parseInt(formDay),
      departure_time: formDeparture,
      arrival_time: formArrival,
      price: parseFloat(formPrice) || 0,
    } as any);
    if (error) toast.error(extractEdgeFunctionError(error));
    else { toast.success('Timetable entry added!'); setDialogOpen(false); fetchData(); }
    setSaving(false);
  };

  const toggleActive = async (entry: TimetableEntry) => {
    await supabase.from('travel_timetables').update({ is_active: !entry.is_active } as any).eq('id', entry.id);
    fetchData();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('travel_timetables').delete().eq('id', id);
    toast.success('Entry deleted');
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  // Group by day
  const grouped = DAYS.map((dayName, dayIdx) => ({
    day: dayName,
    dayIdx,
    entries: entries.filter(e => e.day_of_week === dayIdx),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Timetable</h1>
          <p className="text-sm text-muted-foreground">Weekly recurring schedule for your routes</p>
        </div>
        <Button size="sm" onClick={() => { setFormRouteId(routes[0]?.id || ''); setFormDay('1'); setFormDeparture('08:00'); setFormArrival('12:00'); setFormPrice('5000'); setDialogOpen(true); }} disabled={routes.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Add Schedule
        </Button>
      </div>

      {routes.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Create routes first before setting up a timetable.</CardContent></Card>
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No timetable entries yet. Add your first schedule!</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {grouped.filter(g => g.entries.length > 0).map(({ day, entries: dayEntries }) => (
            <Card key={day}>
              <CardHeader className="pb-3"><CardTitle className="text-base">{day}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {dayEntries.map((entry) => {
                  const route = routes.find(r => r.id === entry.route_id);
                  return (
                    <div key={entry.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0 basis-[55%]">
                        <p className="text-sm font-semibold truncate">{route ? `${route.origin} → ${route.destination}` : 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground truncate">{entry.departure_time} → {entry.arrival_time} · {entry.price?.toLocaleString()} XAF</p>
                      </div>
                      <div className="flex items-center gap-2 ml-auto shrink-0">
                        <Switch checked={entry.is_active} onCheckedChange={() => toggleActive(entry)} />
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteEntry(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Timetable Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Route</Label>
              <Select value={formRouteId} onValueChange={setFormRouteId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{routes.map(r => <SelectItem key={r.id} value={r.id}>{r.origin} → {r.destination}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select value={formDay} onValueChange={setFormDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Departure</Label><Input type="time" value={formDeparture} onChange={e => setFormDeparture(e.target.value)} /></div>
              <div className="space-y-2"><Label>Arrival</Label><Input type="time" value={formArrival} onChange={e => setFormArrival(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Price (XAF)</Label><Input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} /></div>
            <Button onClick={handleCreate} disabled={saving || !formRouteId} className="w-full">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantTravelTimetable;
