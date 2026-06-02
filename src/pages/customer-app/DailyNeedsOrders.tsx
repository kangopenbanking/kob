import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  received: "secondary",
  accepted: "outline",
  preparing: "outline",
  ready: "outline",
  picked_up: "outline",
  on_the_way: "outline",
  arriving: "outline",
  delivered: "default",
  cancelled: "destructive",
  refunded: "destructive",
};

export default function DailyNeedsOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("daily_needs_orders")
        .select("id, status, total_xaf, created_at, store_id, daily_needs_stores(name, banner_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setOrders(data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-semibold">My Orders</h1>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Your past Daily Needs orders will appear here."
          action={{ label: "Browse stores", onClick: () => navigate("/app/daily-needs") }}
        />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} onClick={() => navigate(`/app/daily-needs/orders/${o.id}`)} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent">
              <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {o.daily_needs_stores?.banner_url && <img src={o.daily_needs_stores.banner_url} alt="" className="size-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{o.daily_needs_stores?.name ?? "Order"}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-sm font-semibold">{Number(o.total_xaf).toLocaleString()} XAF</p>
                <Badge variant={STATUS_VARIANT[o.status] ?? "secondary"} className="capitalize text-[10px]">
                  {o.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
