import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function DriverHistory() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: drv } = await supabase.from("ddn_drivers").select("id").eq("user_id", user.id).maybeSingle();
      if (!drv) { setLoading(false); return; }
      const { data } = await supabase.from("ddn_assignments")
        .select("id,status,distance_km,driver_earnings_xaf,delivered_at,created_at,order_id")
        .eq("driver_id", drv.id)
        .order("created_at", { ascending: false })
        .limit(60);
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft className="size-5" /></Button>
        <h1 className="text-xl font-semibold">Delivery History</h1>
      </header>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<History className="size-6 text-muted-foreground" />} title="No deliveries yet" description="Your completed trips will appear here." />
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <Card key={a.id} className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <MapPin className="size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.distance_km ? `${Number(a.distance_km).toFixed(1)} km` : "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{format(new Date(a.created_at), "MMM d, HH:mm")}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{Number(a.driver_earnings_xaf ?? 0).toLocaleString()} XAF</p>
                <Badge variant={a.status === "delivered" ? "default" : "outline"} className="text-[10px] capitalize">{a.status.replace(/_/g, " ")}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
