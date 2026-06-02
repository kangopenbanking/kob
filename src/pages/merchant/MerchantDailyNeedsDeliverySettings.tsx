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
import { Settings2 } from "lucide-react";

type Mode = "platform" | "owned" | "hybrid";

interface Settings {
  merchant_id: string;
  mode: Mode;
  delivery_radius_km: number;
  base_fee_xaf: number;
  per_km_fee_xaf: number;
  prep_time_min: number;
  auto_assign: boolean;
  platform_fee_pct: number;
}

export default function MerchantDailyNeedsDeliverySettings() {
  const { user } = useAuthenticatedUser();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: m } = await supabase
        .from("gateway_merchants").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!m) { setLoading(false); return; }
      setMerchantId(m.id);
      const { data } = await supabase
        .from("ddn_merchant_delivery_settings").select("*").eq("merchant_id", m.id).maybeSingle();
      setS(data ?? {
        merchant_id: m.id, mode: "platform", delivery_radius_km: 5,
        base_fee_xaf: 500, per_km_fee_xaf: 150, prep_time_min: 20,
        auto_assign: true, platform_fee_pct: 15,
      });
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase
      .from("ddn_merchant_delivery_settings")
      .upsert(s, { onConflict: "merchant_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Delivery settings saved" });
    }
  };

  if (loading || !s) {
    return <div className="p-6 max-w-2xl"><Skeleton className="h-64" /></div>;
  }

  const update = (patch: Partial<Settings>) => setS({ ...s, ...patch });

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <Settings2 className="size-6" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delivery settings</h1>
          <p className="text-sm text-muted-foreground">How orders from your Daily Needs stores are dispatched.</p>
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
            {s.mode === "platform" && "Orders are dispatched to the Daily Needs shared rider network."}
            {s.mode === "owned" && "Only your invited drivers receive offers. Falls back to the shared network if none are online."}
            {s.mode === "hybrid" && "Your drivers are tried first, then the shared network."}
          </p>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Delivery radius (km)</Label>
            <Input type="number" min={1} max={50} step={0.5}
              value={s.delivery_radius_km}
              onChange={(e) => update({ delivery_radius_km: parseFloat(e.target.value) || 5 })} />
          </div>
          <div className="space-y-1.5">
            <Label>Prep time (min)</Label>
            <Input type="number" min={5} max={240}
              value={s.prep_time_min}
              onChange={(e) => update({ prep_time_min: parseInt(e.target.value) || 20 })} />
          </div>
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
          <div className="space-y-1.5 col-span-2">
            <Label>Platform commission (%)</Label>
            <Input type="number" min={0} max={50} step={0.5}
              value={s.platform_fee_pct}
              onChange={(e) => update({ platform_fee_pct: parseFloat(e.target.value) || 0 })} />
            <p className="text-xs text-muted-foreground">Share retained by the Daily Needs platform on each delivery fee.</p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-assign drivers</Label>
            <p className="text-xs text-muted-foreground">Automatically dispatch the nearest available rider when an order is ready.</p>
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
