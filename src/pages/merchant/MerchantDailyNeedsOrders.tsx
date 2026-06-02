import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ChefHat, CheckCircle2, X, Clock, Bike, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type OrderRow = {
  id: string;
  status: string;
  total_xaf: number;
  delivery_address: string;
  delivery_phone: string | null;
  created_at: string;
  daily_needs_stores: { name: string } | null;
  daily_needs_order_items: { id: string; quantity: number; product_name: string }[];
};

const COLUMNS = [
  { key: "new", label: "New", icon: Clock, statuses: ["received"], next: "accepted" as const, nextLabel: "Accept" },
  { key: "preparing", label: "Preparing", icon: ChefHat, statuses: ["accepted", "preparing"], next: "ready" as const, nextLabel: "Mark ready" },
  { key: "ready", label: "Ready", icon: PackageCheck, statuses: ["ready"], next: "picked_up" as const, nextLabel: "Handed to driver" },
  { key: "out", label: "Out for delivery", icon: Bike, statuses: ["picked_up", "on_the_way", "arriving"], next: null, nextLabel: "" },
];

export default function MerchantDailyNeedsOrders() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState("new");

  const { data: storeIds = [] } = useQuery({
    queryKey: ["merchant-ddn-store-ids"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("daily_needs_stores").select("id").eq("merchant_id", user.id);
      return (data ?? []).map((s) => s.id);
    },
  });

  const { data, isLoading, refetch } = useQuery<OrderRow[]>({
    queryKey: ["merchant-ddn-orders", storeIds],
    enabled: storeIds.length > 0,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("daily_needs_orders")
        .select("id,status,total_xaf,delivery_address,delivery_phone,created_at,daily_needs_stores(name),daily_needs_order_items(id,quantity,product_name)")
        .in("store_id", storeIds)
        .in("status", ["received", "accepted", "preparing", "ready", "picked_up", "on_the_way", "arriving"])
        .order("created_at", { ascending: false });
      return (data ?? []) as any;
    },
  });

  // Live updates via Realtime
  useEffect(() => {
    if (storeIds.length === 0) return;
    const channel = supabase
      .channel("merchant-ddn-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_needs_orders" }, () => {
        qc.invalidateQueries({ queryKey: ["merchant-ddn-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [storeIds.join(","), qc]);

  const grouped = useMemo(() => {
    const out: Record<string, OrderRow[]> = { new: [], preparing: [], ready: [], out: [] };
    for (const o of data ?? []) {
      const col = COLUMNS.find((c) => c.statuses.includes(o.status));
      if (col) out[col.key].push(o);
    }
    return out;
  }, [data]);

  const transition = async (orderId: string, next: string) => {
    const { error } = await supabase.from("daily_needs_orders").update({ status: next as any }).eq("id", orderId);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Order updated" });
    refetch();
  };

  const reject = async (orderId: string) => {
    if (!confirm("Reject this order? The customer will be refunded.")) return;
    await transition(orderId, "cancelled");
  };

  const active = COLUMNS.find((c) => c.key === tab)!;
  const items = grouped[tab] ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Daily Needs Orders</h1>
        <Badge variant="outline">Live</Badge>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          {COLUMNS.map((c) => (
            <TabsTrigger key={c.key} value={c.key} className="text-xs">
              {c.label} {grouped[c.key]?.length > 0 && `(${grouped[c.key].length})`}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<active.icon className="size-6 text-muted-foreground" />}
          title={`No ${active.label.toLowerCase()} orders`}
          description="New orders will appear here automatically."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((o) => (
            <Card key={o.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{o.daily_needs_stores?.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</p>
                </div>
                <p className="text-sm font-bold">{Number(o.total_xaf).toLocaleString()} XAF</p>
              </div>

              <div className="space-y-1">
                {o.daily_needs_order_items?.map((it) => (
                  <p key={it.id} className="text-xs text-foreground">{it.quantity} × {it.product_name}</p>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                <p className="truncate">{o.delivery_address}</p>
                {o.delivery_phone && <p>{o.delivery_phone}</p>}
              </div>

              {active.next && (
                <div className="flex gap-2 pt-1">
                  {active.key === "new" && (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => reject(o.id)}>
                      <X className="size-4 mr-1" /> Reject
                    </Button>
                  )}
                  <Button size="sm" className="flex-1" onClick={() => transition(o.id, active.next!)}>
                    <CheckCircle2 className="size-4 mr-1" /> {active.nextLabel}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
