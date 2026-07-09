import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Package, UtensilsCrossed, Pill, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { SafeImage } from "@/components/common/SafeImage";

const CANCELLABLE = new Set(["received", "accepted"]);

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

const ACTIVE_STATUSES = new Set([
  "received", "accepted", "preparing", "ready", "picked_up", "on_the_way", "arriving",
]);

type OrderRow = {
  id: string;
  status: string;
  total_xaf: number;
  created_at: string;
  store_id: string;
  daily_needs_stores: { name: string; banner_url: string | null; vertical: string } | null;
};

export default function DailyNeedsOrders() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const verticalParam = params.get("vertical") ?? "all";
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const { error } = await supabase
      .from("daily_needs_orders")
      .update({ status: "cancelled" })
      .eq("id", cancelTarget.id)
      .in("status", ["received", "accepted"]);
    setCancelling(false);
    if (error) {
      toast({ title: "Couldn't cancel order", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Order cancelled", description: `Order ${cancelTarget.id.slice(0, 8).toUpperCase()} was cancelled.` });
      setOrders((prev) => prev.map((o) => o.id === cancelTarget.id ? { ...o, status: "cancelled" } : o));
    }
    setCancelTarget(null);
  };

  // Fetch + realtime
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("daily_needs_orders")
        .select("id, status, total_xaf, created_at, store_id, daily_needs_stores(name, banner_url, vertical)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      setOrders((data as any) ?? []);
      setLoading(false);

      // Subscribe to status changes for this user's orders
      channel = supabase
        .channel(`dn-my-orders-${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "daily_needs_orders", filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            const row = payload.new;
            setOrders((prev) => prev.map((o) => (o.id === row.id ? { ...o, status: row.status, total_xaf: row.total_xaf } : o)));
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "daily_needs_orders", filter: `user_id=eq.${user.id}` },
          () => { load(); },
        )
        .subscribe();
    };
    load();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    if (verticalParam === "all") return orders;
    return orders.filter((o) => o.daily_needs_stores?.vertical === verticalParam);
  }, [orders, verticalParam]);

  const setVertical = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === "all") next.delete("vertical"); else next.set("vertical", v);
    setParams(next, { replace: true });
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-4 animate-fade-in">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/daily-needs")} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold leading-tight">My Orders</h1>
          <p className="text-xs text-muted-foreground">Food & pharmacy deliveries</p>
        </div>
        <Receipt className="size-5 text-muted-foreground" strokeWidth={2} />
      </header>

      <Tabs value={verticalParam} onValueChange={setVertical}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="food" className="gap-1.5">
            <UtensilsCrossed className="size-3.5" strokeWidth={2} /> Food
          </TabsTrigger>
          <TabsTrigger value="pharmacy" className="gap-1.5">
            <Pill className="size-3.5" strokeWidth={2} /> Pharmacy
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6 text-muted-foreground" />}
          title={verticalParam === "all" ? "No orders yet" : `No ${verticalParam} orders yet`}
          description="Your past Daily Needs orders will appear here."
          action={{
            label: verticalParam === "pharmacy" ? "Browse pharmacies" : verticalParam === "food" ? "Browse restaurants" : "Browse stores",
            onClick: () => navigate(
              verticalParam === "pharmacy" ? "/app/daily-needs/pharmacy"
                : verticalParam === "food" ? "/app/daily-needs/food"
                : "/app/daily-needs",
            ),
          }}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const isActive = ACTIVE_STATUSES.has(o.status);
            const canCancel = CANCELLABLE.has(o.status);
            return (
              <Card
                key={o.id}
                className="p-3 hover:bg-accent transition-colors"
              >
                <div
                  onClick={() => navigate(`/app/daily-needs/orders/${o.id}/details`)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0 relative">
                    {o.daily_needs_stores?.banner_url ? (
                      <SafeImage src={o.daily_needs_stores.banner_url} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center text-muted-foreground">
                        {o.daily_needs_stores?.vertical === "pharmacy"
                          ? <Pill className="size-5" strokeWidth={2} />
                          : <UtensilsCrossed className="size-5" strokeWidth={2} />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{o.daily_needs_stores?.name ?? "Order"}</p>
                      {isActive && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {(o.daily_needs_stores?.vertical ?? "store")} · {formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold">{Number(o.total_xaf).toLocaleString()} XAF</p>
                    <Badge variant={STATUS_VARIANT[o.status] ?? "secondary"} className="capitalize text-[10px]">
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
                {canCancel && (
                  <div className="mt-3 pt-3 border-t flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); setCancelTarget(o); }}
                    >
                      <X className="size-3.5" strokeWidth={2} />
                      Cancel order
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && (
                <>
                  Order <span className="font-mono">{cancelTarget.id.slice(0, 8).toUpperCase()}</span>
                  {" "}from <span className="font-medium">{cancelTarget.daily_needs_stores?.name ?? "store"}</span>
                  {" "}will be cancelled. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? "Cancelling…" : "Cancel order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
