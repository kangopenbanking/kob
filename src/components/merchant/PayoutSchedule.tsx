import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Cadence = "manual" | "daily" | "weekly" | "monthly";
interface Schedule { cadence: Cadence; day_of_week: number; day_of_month: number; }

const STORAGE_KEY = "merchant_payout_schedule_v1";
const DEFAULT: Schedule = { cadence: "manual", day_of_week: 1, day_of_month: 1 };

export function PayoutSchedule() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>(DEFAULT);
  const [keySuffix, setKeySuffix] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const suffix = user ? `:${user.id}` : "";
      setKeySuffix(suffix);
      try {
        const raw = localStorage.getItem(STORAGE_KEY + suffix);
        if (raw) setSchedule({ ...DEFAULT, ...JSON.parse(raw) });
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY + keySuffix, JSON.stringify(schedule));
      toast.success("Payout schedule saved");
    } finally { setSaving(false); }
  };

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-base font-semibold">Payout Schedule</h3>
            <p className="text-xs text-muted-foreground">Choose how often funds are automatically settled to your account.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cadence</Label>
              <Select value={schedule.cadence} onValueChange={(v: Cadence) => setSchedule({ ...schedule, cadence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual — withdraw on demand</SelectItem>
                  <SelectItem value="daily">Daily — every business day</SelectItem>
                  <SelectItem value="weekly">Weekly — on a chosen day</SelectItem>
                  <SelectItem value="monthly">Monthly — on a chosen date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {schedule.cadence === "weekly" && (
              <div className="space-y-2">
                <Label>Day of week</Label>
                <Select value={String(schedule.day_of_week)} onValueChange={(v) => setSchedule({ ...schedule, day_of_week: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dayNames.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {schedule.cadence === "monthly" && (
              <div className="space-y-2">
                <Label>Day of month</Label>
                <Select value={String(schedule.day_of_month)} onValueChange={(v) => setSchedule({ ...schedule, day_of_month: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
