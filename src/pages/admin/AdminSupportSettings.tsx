import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

const DAYS = [
  { v: 1, label: 'Mon' }, { v: 2, label: 'Tue' }, { v: 3, label: 'Wed' },
  { v: 4, label: 'Thu' }, { v: 5, label: 'Fri' }, { v: 6, label: 'Sat' }, { v: 7, label: 'Sun' },
];

const AdminSupportSettings: React.FC = () => {
  const [tz, setTz] = useState('UTC');
  const [start, setStart] = useState(8);
  const [end, setEnd] = useState(20);
  const [days, setDays] = useState<number[]>([1,2,3,4,5]);
  const [offlineMessage, setOfflineMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('support_business_hours').select('*').eq('id', 1).maybeSingle();
      if (data) {
        setTz(data.timezone); setStart(data.start_hour); setEnd(data.end_hour);
        setDays(data.active_days || []); setOfflineMessage(data.offline_message);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (end <= start) { toast.error('End hour must be after start hour.'); return; }
    if (days.length === 0) { toast.error('Pick at least one active day.'); return; }
    const { error } = await supabase.from('support_business_hours').update({
      timezone: tz, start_hour: start, end_hour: end, active_days: days,
      offline_message: offlineMessage, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (error) toast.error(error.message); else toast.success('Settings saved.');
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Live Support Settings</h1>
        <p className="text-sm text-muted-foreground">Define when agents are considered available. Outside these hours (or when no agent is online), guests automatically receive your offline reply.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tz">Timezone (IANA)</Label>
          <Input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} placeholder="Africa/Douala" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start">Start hour (0–23)</Label>
            <Input id="start" type="number" min={0} max={23} value={start} onChange={(e) => setStart(parseInt(e.target.value || '0', 10))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">End hour (1–24)</Label>
            <Input id="end" type="number" min={1} max={24} value={end} onChange={(e) => setEnd(parseInt(e.target.value || '0', 10))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Active days</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const active = days.includes(d.v);
              return (
                <Button key={d.v} type="button" size="sm" variant={active ? 'default' : 'outline'}
                  onClick={() => setDays((cur) => active ? cur.filter((x) => x !== d.v) : [...cur, d.v].sort())}
                  className="h-8 w-12">{d.label}</Button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="off">Offline auto-reply</Label>
          <Textarea id="off" rows={4} value={offlineMessage} onChange={(e) => setOfflineMessage(e.target.value)} maxLength={1000} />
          <p className="text-xs text-muted-foreground">Sent automatically when a guest writes outside business hours or when no agent is online.</p>
        </div>

        <Button onClick={save} className="rounded-xl">Save settings</Button>
      </Card>
    </div>
  );
};

export default AdminSupportSettings;
