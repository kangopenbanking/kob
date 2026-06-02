import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { OrderStatusTimeline } from "@/components/daily-needs/OrderStatusTimeline";
import { Skeleton } from "@/components/ui/skeleton";

export default function DailyNeedsOrderTrack() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("daily_needs_orders")
        .select("*, daily_needs_stores(name)")
        .eq("id", id!).maybeSingle();
      if (cancelled) return;
      setOrder(data); setLoading(false);
    };
    load();
    const channel = supabase
      .channel(`dn-order-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_needs_orders", filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [id]);

  if (loading) return <div className="p-4"><Skeleton className="h-64 rounded-xl" /></div>;
  if (!order) return <div className="p-8 text-center text-muted-foreground">Order not found.</div>;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
        <h1 className="text-xl font-semibold">Track order</h1>
      </div>
      <Card className="p-4 space-y-2">
        <p className="text-sm text-muted-foreground">{order.daily_needs_stores?.name}</p>
        <p className="font-semibold">{Number(order.total_xaf).toLocaleString()} XAF</p>
        <p className="text-xs text-muted-foreground">Delivery code: <span className="font-mono font-semibold text-foreground">{order.delivery_code}</span></p>
      </Card>
      <Card className="p-4">
        <OrderStatusTimeline status={order.status} />
      </Card>
    </div>
  );
}
