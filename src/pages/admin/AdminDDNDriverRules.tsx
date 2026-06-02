import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, BellRing, AlarmClock, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Rules = {
  id: string;
  offer_in_app_enabled: boolean;
  offer_push_enabled: boolean;
  offer_warn_seconds: number;
  assignment_change_in_app: boolean;
  assignment_change_push: boolean;
  missed_pickup_minutes: number;
  missed_pickup_push: boolean;
  missed_pickup_in_app: boolean;
};

export default function AdminDDNDriverRules() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("ddn_driver_notification_rules")
      .select("*").eq("singleton", true).maybeSingle();
    if (error) toast.error(error.message);
    setRules(data as any); setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (patch: Partial<Rules>) => setRules((r) => (r ? { ...r, ...patch } : r));

  const save = async () => {
    if (!rules) return;
    setSaving(true);
    const { error } = await supabase
      .from("ddn_driver_notification_rules")
      .update({
        offer_in_app_enabled: rules.offer_in_app_enabled,
        offer_push_enabled: rules.offer_push_enabled,
        offer_warn_seconds: Number(rules.offer_warn_seconds),
        assignment_change_in_app: rules.assignment_change_in_app,
        assignment_change_push: rules.assignment_change_push,
        missed_pickup_minutes: Number(rules.missed_pickup_minutes),
        missed_pickup_push: rules.missed_pickup_push,
        missed_pickup_in_app: rules.missed_pickup_in_app,
      } as any)
      .eq("id", rules.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Rules updated");
  };

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>;
  if (!rules) return <div className="p-6 text-sm text-muted-foreground">Rules not initialised.</div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Truck className="size-6 text-primary" /> Driver notification rules</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure what drivers receive in-app and via push for offers, assignment changes, and missed pickups.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium"><BellRing className="size-4 text-primary" /> Offer notifications</div>
        <Row label="In-app notification on new offer" checked={rules.offer_in_app_enabled} onChange={(v) => update({ offer_in_app_enabled: v })} />
        <Row label="Push notification on new offer" checked={rules.offer_push_enabled} onChange={(v) => update({ offer_push_enabled: v })} />
        <div className="grid grid-cols-2 gap-3 items-end pt-1">
          <div className="space-y-1">
            <Label className="text-xs">Warn driver when remaining seconds ≤</Label>
            <Input type="number" min={3} max={60} value={rules.offer_warn_seconds} onChange={(e) => update({ offer_warn_seconds: Number(e.target.value) })} />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium"><Truck className="size-4 text-primary" /> Assignment changes</div>
        <Row label="In-app on cancellation / failure" checked={rules.assignment_change_in_app} onChange={(v) => update({ assignment_change_in_app: v })} />
        <Row label="Push on cancellation / failure" checked={rules.assignment_change_push} onChange={(v) => update({ assignment_change_push: v })} />
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium"><AlarmClock className="size-4 text-primary" /> Missed pickup window</div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Flag driver after (minutes)</Label>
            <Input type="number" min={2} max={120} value={rules.missed_pickup_minutes} onChange={(e) => update({ missed_pickup_minutes: Number(e.target.value) })} />
          </div>
        </div>
        <Row label="In-app on missed pickup" checked={rules.missed_pickup_in_app} onChange={(v) => update({ missed_pickup_in_app: v })} />
        <Row label="Push on missed pickup" checked={rules.missed_pickup_push} onChange={(v) => update({ missed_pickup_push: v })} />
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}><Save className="size-4 mr-2" /> Save rules</Button>
      </div>
    </div>
  );
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
