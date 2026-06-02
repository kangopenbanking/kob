import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Settings2, Clock } from "lucide-react";

type Mode = "platform" | "owned" | "hybrid";
type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Hours = Record<Day, { open: string; close: string } | null>;

interface Settings {
  merchant_id: string;
  mode: Mode;
  delivery_radius_km: number;
  max_radius_km: number;
  base_fee_xaf: number;
  per_km_fee_xaf: number;
  min_fee_xaf: number;
  max_fee_xaf: number | null;
  surge_multiplier: number;
  prep_time_min: number;
  auto_assign: boolean;
  platform_fee_pct: number;
  operating_hours: Hours;
  accept_outside_hours: boolean;
}

const DAYS: { key: Day; label: string }[] = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

const defaultHours: Hours = {
  mon: { open: "08:00", close: "22:00" }, tue: { open: "08:00", close: "22:00" },
  wed: { open: "08:00", close: "22:00" }, thu: { open: "08:00", close: "22:00" },
  fri: { open: "08:00", close: "22:00" }, sat: { open: "08:00", close: "22:00" },
  sun: { open: "08:00", close: "22:00" },
};

export default function MerchantDailyNeedsDeliverySettings() {
  const { user } = useAuthenticatedUser();
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: m } = await supabase
        .from("gateway_merchants").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!m) { setLoading(false); return; }
      const { data } = await supabase
        .from("ddn_merchant_delivery_settings").select("*").eq("merchant_id", m.id).maybeSingle();
      const row = (data as any) ?? {};
      setS({
        merchant_id: m.id,
        mode: row.mode ?? "platform",
        delivery_radius_km: Number(row.delivery_radius_km ?? 5),
        max_radius_km: Number(row.max_radius_km ?? 15),
        base_fee_xaf: row.base_fee_xaf ?? 500,
        per_km_fee_xaf: row.per_km_fee_xaf ?? 150,
        min_fee_xaf: row.min_fee_xaf ?? 0,
        max_fee_xaf: row.max_fee_xaf ?? null,
        surge_multiplier: Number(row.surge_multiplier ?? 1.0),
        prep_time_min: row.prep_time_min ?? 20,
        auto_assign: row.auto_assign ?? true,
        platform_fee_pct: Number(row.platform_fee_pct ?? 15),
        operating_hours: (row.operating_hours as Hours) ?? defaultHours,
        accept_outside_hours: row.accept_outside_hours ?? false,
      });
      setLoading(false);
    })();
  }, [user]);

  const validate = (v: Settings): string | null => {
    if (v.delivery_radius_km <= 0 || v.delivery_radius_km > 50) return "Delivery radius must be 0.5–50 km.";
    if (v.max_radius_km < v.delivery_radius_km) return "Max radius must be ≥ delivery radius.";
    if (v.max_radius_km > 50) return "Max radius cannot exceed 50 km.";
    if (v.base_fee_xaf < 0 || v.per_km_fee_xaf < 0) return "Fees cannot be negative.";
    if (v.min_fee_xaf < 0) return "Minimum fee cannot be negative.";
    if (v.max_fee_xaf != null && v.max_fee_xaf < v.min_fee_xaf) return "Max fee must be ≥ min fee.";
    if (v.surge_multiplier < 0.5 || v.surge_multiplier > 5) return "Surge multiplier must be 0.5–5.";
    if (v.platform_fee_pct < 0 || v.platform_fee_pct > 50) return "Platform commission must be 0–50%.";
    for (const d of DAYS) {
      const h = v.operating_hours[d.key];
      if (h && h.open >= h.close) return `Operating hours: ${d.label} close must be after open.`;
    }
    return null;
  };

  const save = async () => {
    if (!s) return;
    const err = validate(s);
    if (err) { toast({ title: "Please fix", description: err, variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase
      .from("ddn_merchant_delivery_settings")
      .upsert(s, { onConflict: "merchant_id" });
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Delivery settings saved" });
  };

  if (loading || !s) return <div className="p-6 max-w-2xl"><Skeleton className="h-64" /></div>;

  const update = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  const updateDay = (d: Day, h: { open: string; close: string } | null) =>
    update({ operating_hours: { ...s.operating_hours, [d]: h } });

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <Settings2 className="size-6" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delivery settings</h1>
          <p className="text-sm text-muted-foreground">Dispatch, fulfillment, hours, and fee overrides.</p>
        </div>
      </header>

      <Card className="p-6 space-y-5">
        <div className="space-y-2">
          <Label>Fulfillment mode</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["platform", "owned", "hybrid"] as Mode[]).map((m) => (
              <Button key={m} variant={s.mode === m ? "default" : "outline"} size="sm" onClick={() => update({ mode: m })}>
                {m === "platform" ? "Shared network" : m === "owned" ? "My drivers" : "Both"}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {s.mode === "platform" && "Orders dispatched to the Daily Needs shared rider network."}
            {s.mode === "owned" && "Only your invited drivers receive offers."}
            {s.mode === "hybrid" && "Your drivers first, then the shared network."}
          </p>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Delivery radius (km)</Label>
            <Input type="number" min={0.5} max={50} step={0.5}
              value={s.delivery_radius_km}
              onChange={(e) => update({ delivery_radius_km: parseFloat(e.target.value) || 5 })} />
            <p className="text-xs text-muted-foreground">Default service area.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Max dispatch radius (km)</Label>
            <Input type="number" min={1} max={50} step={0.5}
              value={s.max_radius_km}
              onChange={(e) => update({ max_radius_km: parseFloat(e.target.value) || 15 })} />
            <p className="text-xs text-muted-foreground">Cap on how far a driver can be from pickup.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Prep time (min)</Label>
            <Input type="number" min={5} max={240}
              value={s.prep_time_min}
              onChange={(e) => update({ prep_time_min: parseInt(e.target.value) || 20 })} />
          </div>
          <div className="space-y-1.5">
            <Label>Surge multiplier</Label>
            <Input type="number" min={0.5} max={5} step={0.1}
              value={s.surge_multiplier}
              onChange={(e) => update({ surge_multiplier: parseFloat(e.target.value) || 1 })} />
            <p className="text-xs text-muted-foreground">Applied to the computed delivery fee (1.0 = no surge).</p>
          </div>
        </div>

        <Separator />

        <h3 className="text-sm font-medium">Fee structure</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Base fee (XAF)</Label>
            <Input type="number" min={0}
              value={s.base_fee_xaf}
              onChange={(e) => update({ base_fee_xaf: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1.5">
            <Label>Per-km fee (XAF)</Label>
            <Input type="number" min={0}
              value={s.per_km_fee_xaf}
              onChange={(e) => update({ per_km_fee_xaf: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1.5">
            <Label>Min fee (XAF)</Label>
            <Input type="number" min={0}
              value={s.min_fee_xaf}
              onChange={(e) => update({ min_fee_xaf: parseInt(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground">Floor for short trips.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Max fee (XAF, optional)</Label>
            <Input type="number" min={0}
              value={s.max_fee_xaf ?? ""}
              placeholder="No cap"
              onChange={(e) => {
                const v = e.target.value.trim();
                update({ max_fee_xaf: v === "" ? null : parseInt(v) || null });
              }} />
            <p className="text-xs text-muted-foreground">Cap for long trips.</p>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Platform commission (%)</Label>
            <Input type="number" min={0} max={50} step={0.5}
              value={s.platform_fee_pct}
              onChange={(e) => update({ platform_fee_pct: parseFloat(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground">Share retained by the Daily Needs platform.</p>
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4" />
            <h3 className="text-sm font-medium">Operating hours</h3>
          </div>
          <div className="space-y-2">
            {DAYS.map((d) => {
              const h = s.operating_hours[d.key];
              const open = !!h;
              return (
                <div key={d.key} className="flex items-center gap-3">
                  <Switch checked={open} onCheckedChange={(v) => updateDay(d.key, v ? { open: "08:00", close: "22:00" } : null)} />
                  <span className="w-10 text-xs font-medium">{d.label}</span>
                  {open && h ? (
                    <>
                      <Input type="time" className="w-28" value={h.open}
                        onChange={(e) => updateDay(d.key, { ...h, open: e.target.value })} />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input type="time" className="w-28" value={h.close}
                        onChange={(e) => updateDay(d.key, { ...h, close: e.target.value })} />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-4">
            <div>
              <Label>Accept orders outside hours</Label>
              <p className="text-xs text-muted-foreground">Still allow dispatch when the store is closed (delivery only).</p>
            </div>
            <Switch checked={s.accept_outside_hours} onCheckedChange={(v) => update({ accept_outside_hours: v })} />
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-assign drivers</Label>
            <p className="text-xs text-muted-foreground">Dispatch the nearest rider automatically when ready.</p>
          </div>
          <Switch checked={s.auto_assign} onCheckedChange={(v) => update({ auto_assign: v })} />
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </Card>
    </div>
  );
}
