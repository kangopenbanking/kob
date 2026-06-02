import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { OrderStatusTimeline } from "@/components/daily-needs/OrderStatusTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveDeliveryMap } from "@/components/daily-needs/LiveDeliveryMap";
import { DeliveryCodeCard } from "@/components/daily-needs/DeliveryCodeCard";
import { useSmoothedEta } from "@/hooks/useSmoothedEta";

const ACTIVE = new Set(["accepted", "picked_up", "on_the_way", "arriving"]);

export default function DailyNeedsOrderTrack() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load order + assignment
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      const { data: o } = await supabase
        .from("daily_needs_orders")
        .select("*, daily_needs_stores(name)")
        .eq("id", id).maybeSingle();
      const { data: a } = await supabase
        .from("ddn_assignments")
        .select("id, status, driver_id, pickup_lat, pickup_lng, drop_lat, drop_lng, eta_min, distance_km")
        .eq("order_id", id).maybeSingle();
      if (cancelled) return;
      setOrder(o); setAssignment(a); setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`dn-track-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_needs_orders", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ddn_assignments", filter: `order_id=eq.${id}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [id]);

  // Live driver location (only when assignment is active)
  useEffect(() => {
    const driverId = assignment?.driver_id;
    if (!driverId || !ACTIVE.has(assignment.status)) { setDriverLoc(null); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("ddn_driver_locations").select("lat, lng").eq("driver_id", driverId).maybeSingle();
      if (!cancelled && data) setDriverLoc({ lat: Number(data.lat), lng: Number(data.lng) });
    };
    load();
    const ch = supabase
      .channel(`dn-driver-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ddn_driver_locations", filter: `driver_id=eq.${driverId}` },
        (p: any) => { const r = p.new; if (r) setDriverLoc({ lat: Number(r.lat), lng: Number(r.lng) }); })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [assignment?.driver_id, assignment?.status]);

  // Smoothed ETA — debounces GPS noise and computes a stable ETA the customer can trust
  const { etaMin: smoothEta, distanceKm: smoothKm } = useSmoothedEta({
    driver: driverLoc,
    destination: assignment?.drop_lat && assignment?.drop_lng
      ? { lat: Number(assignment.drop_lat), lng: Number(assignment.drop_lng) }
      : null,
  });

  if (loading) return <div className="p-4"><Skeleton className="h-64 rounded-xl" /></div>;
  if (!order) return <div className="p-8 text-center text-muted-foreground">Order not found.</div>;

  const showCode = ["ready", "picked_up", "on_the_way", "arriving"].includes(assignment?.status ?? order.status);
  const eta = smoothEta ?? assignment?.eta_min;
  const km = smoothKm ?? assignment?.distance_km;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
        <h1 className="text-xl font-semibold">Track order</h1>
      </div>

      <Card className="p-4 space-y-1">
        <p className="text-sm text-muted-foreground">{order.daily_needs_stores?.name}</p>
        <p className="font-semibold">{Number(order.total_xaf).toLocaleString()} XAF</p>
        {eta != null && (
          <p className="text-xs text-muted-foreground">
            ETA ~{eta} min{km != null ? ` · ${km} km` : ""}
          </p>
        )}
      </Card>

      <LiveDeliveryMap
        driverLat={driverLoc?.lat} driverLng={driverLoc?.lng}
        pickupLat={assignment?.pickup_lat} pickupLng={assignment?.pickup_lng}
        dropLat={assignment?.drop_lat} dropLng={assignment?.drop_lng}
      />

      {showCode && <DeliveryCodeCard code={order.delivery_code} />}

      <Card className="p-4">
        <OrderStatusTimeline status={order.status} />
      </Card>
    </div>
  );
}
