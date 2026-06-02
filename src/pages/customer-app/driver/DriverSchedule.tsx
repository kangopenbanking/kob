import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Shift = { day_of_week: number; start_minute: number; end_minute: number; enabled: boolean; id?: string };

function toTime(m: number) { const h = Math.floor(m / 60); const mm = m % 60; return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`; }
function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

export default function DriverSchedule() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Record<number, Shift>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: drv } = await supabase.from("ddn_drivers").select("id").eq("user_id", user.id).maybeSingle();
      if (!drv) { setLoading(false); return; }
      setDriverId(drv.id);
      const { data } = await supabase.from("ddn_driver_shifts").select("*").eq("driver_id", drv.id);
      const map: Record<number, Shift> = {};
      for (let d = 0; d < 7; d++) map[d] = { day_of_week: d, start_minute: 9 * 60, end_minute: 18 * 60, enabled: false };
      for (const s of data ?? []) map[s.day_of_week] = { ...s };
      setShifts(map);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!driverId) return;
    setSaving(true);
    // wipe + reinsert (idempotent simple approach)
    await supabase.from("ddn_driver_shifts").delete().eq("driver_id", driverId);
    const rows = Object.values(shifts).filter((s) => s.enabled).map((s) => ({
      driver_id: driverId, day_of_week: s.day_of_week,
      start_minute: s.start_minute, end_minute: s.end_minute, enabled: true,
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from("ddn_driver_shifts").insert(rows);
      if (error) { setSaving(false); toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    }
    setSaving(false);
    toast({ title: "Schedule saved" });
  };

  if (loading) return <div className="p-4 space-y-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft className="size-5" /></Button>
        <h1 className="text-xl font-semibold flex items-center gap-2"><Calendar className="size-5" /> Weekly schedule</h1>
      </header>

      <Card className="p-4 space-y-3">
        {DAYS.map((d, i) => {
          const s = shifts[i];
          return (
            <div key={i} className="flex items-center gap-2">
              <p className="w-12 text-xs font-medium">{d}</p>
              <Switch checked={s.enabled} onCheckedChange={(v) => setShifts({ ...shifts, [i]: { ...s, enabled: v } })} aria-label={`${d} enabled`} />
              <Input type="time" value={toTime(s.start_minute)} disabled={!s.enabled} className="flex-1"
                onChange={(e) => setShifts({ ...shifts, [i]: { ...s, start_minute: toMin(e.target.value) } })} />
              <span className="text-muted-foreground text-xs">–</span>
              <Input type="time" value={toTime(s.end_minute)} disabled={!s.enabled} className="flex-1"
                onChange={(e) => setShifts({ ...shifts, [i]: { ...s, end_minute: toMin(e.target.value) } })} />
            </div>
          );
        })}
      </Card>

      <Button className="w-full" onClick={save} disabled={saving}>Save schedule</Button>
    </div>
  );
}
