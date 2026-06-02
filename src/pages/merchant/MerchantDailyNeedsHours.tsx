import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Hours = Record<string, { open: string; close: string; closed: boolean }>;

const defaultHours: Hours = DAYS.reduce((acc, d) => {
  acc[d] = { open: "09:00", close: "18:00", closed: false };
  return acc;
}, {} as Hours);

export default function MerchantDailyNeedsHours() {
  const { toast } = useToast();
  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<string>("");
  const [hours, setHours] = useState<Hours>(defaultHours);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedReason, setPausedReason] = useState("");
  const [pausedUntil, setPausedUntil] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("daily_needs_stores")
        .select("id,name,opening_hours,is_paused,paused_reason,paused_until")
        .eq("merchant_id", user.id);
      setStores(data ?? []);
      if (data && data[0]) selectStore(data[0]);
      setLoading(false);
    })();
  }, []);

  const selectStore = (s: any) => {
    setStoreId(s.id);
    const merged = { ...defaultHours, ...(s.opening_hours ?? {}) };
    setHours(merged);
    setIsPaused(!!s.is_paused);
    setPausedReason(s.paused_reason ?? "");
    setPausedUntil(s.paused_until ? new Date(s.paused_until).toISOString().slice(0, 16) : "");
  };

  const save = async () => {
    if (!storeId) return;
    setSaving(true);
    const { error } = await supabase.from("daily_needs_stores").update({
      opening_hours: hours,
      is_paused: isPaused,
      paused_reason: pausedReason.trim() || null,
      paused_until: pausedUntil ? new Date(pausedUntil).toISOString() : null,
    }).eq("id", storeId);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Hours updated" });
  };

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>;
  }

  if (stores.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">Create a Daily Needs store first.</Card>;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <header>
        <h1 className="text-xl font-semibold">Store Hours & Availability</h1>
        <p className="text-sm text-muted-foreground">Control when your store accepts Daily Needs orders.</p>
      </header>

      {stores.length > 1 && (
        <div>
          <Label>Store</Label>
          <Select value={storeId} onValueChange={(v) => { const s = stores.find((x) => x.id === v); if (s) selectStore(s); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm flex items-center gap-2">
              {isPaused ? <Pause className="size-4 text-destructive" /> : <Play className="size-4 text-emerald-500" />}
              {isPaused ? "Store is paused" : "Store is open"}
            </p>
            <p className="text-xs text-muted-foreground">Toggle to instantly stop accepting new orders.</p>
          </div>
          <Switch checked={isPaused} onCheckedChange={setIsPaused} aria-label="Pause store" />
        </div>
        {isPaused && (
          <div className="space-y-2 pt-2 border-t">
            <div>
              <Label className="text-xs">Reason (shown to customers)</Label>
              <Input value={pausedReason} onChange={(e) => setPausedReason(e.target.value)} placeholder="On holiday until Monday" />
            </div>
            <div>
              <Label className="text-xs">Auto-resume at</Label>
              <Input type="datetime-local" value={pausedUntil} onChange={(e) => setPausedUntil(e.target.value)} />
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <p className="font-medium text-sm">Weekly hours</p>
        {DAYS.map((d) => {
          const h = hours[d];
          return (
            <div key={d} className="flex items-center gap-3">
              <p className="w-12 text-xs font-medium">{d}</p>
              <Switch
                checked={!h.closed}
                onCheckedChange={(open) => setHours({ ...hours, [d]: { ...h, closed: !open } })}
                aria-label={`${d} open`}
              />
              <Input type="time" value={h.open} disabled={h.closed} className="flex-1"
                onChange={(e) => setHours({ ...hours, [d]: { ...h, open: e.target.value } })} />
              <span className="text-muted-foreground text-xs">–</span>
              <Input type="time" value={h.close} disabled={h.closed} className="flex-1"
                onChange={(e) => setHours({ ...hours, [d]: { ...h, close: e.target.value } })} />
            </div>
          );
        })}
      </Card>

      <Button className="w-full" onClick={save} disabled={saving}>Save changes</Button>
    </div>
  );
}
