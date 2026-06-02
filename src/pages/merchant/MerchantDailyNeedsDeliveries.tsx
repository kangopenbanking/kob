import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Package, RefreshCw, Wifi } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  offered: "secondary",
  accepted: "outline",
  picked_up: "outline",
  on_the_way: "outline",
  arriving: "outline",
  delivered: "default",
  cancelled: "destructive",
  failed: "destructive",
  expired: "destructive",
};

const ACTIVE_STATUSES = ["pending", "offered", "accepted", "picked_up", "on_the_way", "arriving"];

export default function MerchantDailyNeedsDeliveries() {
  const { user } = useAuthenticatedUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "completed" | "all">("active");

  // Merchant ids owned by this user
  const merchantsQ = useQuery({
    queryKey: ["merchant-ids", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_merchants").select("id").eq("user_id", user!.id);
      return (data ?? []).map((m) => m.id);
    },
  });

  const merchantIds = merchantsQ.data ?? [];

  const deliveriesQ = useQuery({
    queryKey: ["ddn-assignments", merchantIds.join(",")],
    enabled: merchantIds.length > 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("ddn_assignments")
        .select("*, ddn_drivers(full_name, phone, vehicle_type)")
        .in("merchant_id", merchantIds)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  // Realtime subscription — every status change refetches authoritative state
  useEffect(() => {
    if (merchantIds.length === 0) return;
    const channel = supabase
      .channel(`ddn-merchant-${merchantIds.join("-")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ddn_assignments", filter: `merchant_id=in.(${merchantIds.join(",")})` },
        () => {
          qc.invalidateQueries({ queryKey: ["ddn-assignments", merchantIds.join(",")] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantIds.join(","), qc]);

  const rows = useMemo(() => {
    const all = deliveriesQ.data ?? [];
    if (tab === "active") return all.filter((r: any) => ACTIVE_STATUSES.includes(r.status));
    if (tab === "completed") return all.filter((r: any) => !ACTIVE_STATUSES.includes(r.status));
    return all;
  }, [deliveriesQ.data, tab]);

  const loading = merchantsQ.isLoading || deliveriesQ.isLoading;
  const counts = useMemo(() => {
    const all = deliveriesQ.data ?? [];
    return {
      active: all.filter((r: any) => ACTIVE_STATUSES.includes(r.status)).length,
      completed: all.filter((r: any) => !ACTIVE_STATUSES.includes(r.status)).length,
      all: all.length,
    };
  }, [deliveriesQ.data]);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deliveries</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Wifi className="size-3 text-emerald-600" />
            Live — updates as drivers accept, pick up, and deliver.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => deliveriesQ.refetch()}>
          <RefreshCw className="size-4 mr-2" /> Refresh
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Package className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No deliveries to show</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === "active"
              ? "Active deliveries appear here automatically once orders are marked ready."
              : "Completed and cancelled deliveries will show up here."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r: any) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Truck className="size-4" />
                    <span className="font-mono text-xs">#{r.id.slice(0, 8)}</span>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"} className="capitalize">
                      {String(r.status).replace(/_/g, " ")}
                    </Badge>
                    {r.delivered_at && (
                      <span className="text-xs text-muted-foreground">
                        Delivered {formatDistanceToNow(new Date(r.delivered_at), { addSuffix: true })}
                      </span>
                    )}
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
