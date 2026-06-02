import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Truck, Package, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  offered: "secondary",
  accepted: "outline",
  picked_up: "outline",
  on_the_way: "outline",
  delivered: "default",
  cancelled: "destructive",
  failed: "destructive",
};

export default function MerchantDailyNeedsDeliveries() {
  const { user } = useAuthenticatedUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: merchants } = await supabase
      .from("gateway_merchants").select("id").eq("user_id", user.id);
    const ids = (merchants ?? []).map((m) => m.id);
    if (ids.length === 0) { setRows([]); setLoading(false); return; }
    const { data } = await supabase
      .from("ddn_assignments")
      .select("*, ddn_drivers(full_name, phone, vehicle_type)")
      .in("merchant_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deliveries</h1>
          <p className="text-sm text-muted-foreground">Live + recent delivery assignments for your stores.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="size-4 mr-2" /> Refresh
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Package className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No deliveries yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Deliveries appear here automatically once an order is marked ready.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Truck className="size-4" />
                    <span className="font-mono text-xs">#{r.id.slice(0, 8)}</span>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"} className="capitalize">
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-sm">
                    {r.ddn_drivers?.full_name ?? "Awaiting driver"} ·{" "}
                    <span className="text-muted-foreground">{r.ddn_drivers?.vehicle_type ?? "—"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.distance_km ? `${Number(r.distance_km).toFixed(1)} km · ` : ""}
                    {r.eta_min ? `ETA ${r.eta_min} min · ` : ""}
                    Created {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm font-medium">{Number(r.delivery_fee_xaf ?? 0).toLocaleString()} XAF</p>
                  <p className="text-xs text-muted-foreground">
                    Driver: {Number(r.driver_earnings_xaf ?? 0).toLocaleString()} · Platform: {Number(r.platform_fee_xaf ?? 0).toLocaleString()}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/merchant/daily-needs/${r.merchant_id}`)}>
                    View store
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
