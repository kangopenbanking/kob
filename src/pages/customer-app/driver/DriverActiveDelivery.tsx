import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Package, MapPin, ShieldCheck, Truck, RefreshCw, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { LiveDeliveryMap } from "@/components/daily-needs/LiveDeliveryMap";
import { toast } from "sonner";

const FN = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1";

export default function DriverActiveDelivery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<any>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmPickupOpen, setConfirmPickupOpen] = useState(false);
  const [confirmDeliverOpen, setConfirmDeliverOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("ddn_assignments")
      .select("*, daily_needs_orders!inner(id, total_xaf, delivery_address, delivery_latitude, delivery_longitude, daily_needs_stores(name, address))")
      .eq("id", id).maybeSingle();
    setAssignment(data); setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`driver-assign-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ddn_assignments", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  const callFn = async (path: string, body: Record<string, unknown>) => {
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FN}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast.error(data.error || "Action failed"); return null; }
    return data;
  };

  const confirmPickup = async () => {
    const r = await callFn("ddn-pickup-confirm", { assignment_id: id });
    if (r) { toast.success("Pickup confirmed"); load(); }
  };

  const verifyDelivery = async () => {
    if (!/^\d{3,8}$/.test(code.trim())) { toast.error("Enter the customer's delivery code"); return; }
    let coords: { drop_lat?: number; drop_lng?: number } = {};
    try {
      const pos: GeolocationPosition = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 }));
      coords = { drop_lat: pos.coords.latitude, drop_lng: pos.coords.longitude };
    } catch { /* optional */ }
    const r = await callFn("ddn-deliver-verify", { assignment_id: id, code: code.trim(), ...coords });
    if (r) { toast.success("Delivery confirmed"); setTimeout(() => navigate("/app/driver"), 800); }
  };

  if (loading) return <div className="p-4"><Skeleton className="h-64 rounded-xl" /></div>;
  if (!assignment) return <div className="p-8 text-center text-muted-foreground">Assignment not found.</div>;

  const o = assignment.daily_needs_orders;
  const canPickup = ["accepted"].includes(assignment.status);
  const canDeliver = ["picked_up", "on_the_way", "arriving"].includes(assignment.status);
  const done = assignment.status === "delivered";

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
        <h1 className="text-xl font-semibold">Active delivery</h1>
        <Badge variant="secondary" className="ml-auto capitalize">{String(assignment.status).replaceAll("_", " ")}</Badge>
      </div>

      <LiveDeliveryMap
        pickupLat={assignment.pickup_lat} pickupLng={assignment.pickup_lng}
        dropLat={assignment.drop_lat} dropLng={assignment.drop_lng}
      />

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Package className="size-4 text-primary" />
          <span className="font-medium">Pickup</span>
        </div>
        <p className="text-sm">{o.daily_needs_stores?.name}</p>
        <p className="text-xs text-muted-foreground">{o.daily_needs_stores?.address}</p>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="size-4 text-primary" />
          <span className="font-medium">Drop-off</span>
        </div>
        <p className="text-sm">{o.delivery_address}</p>
        <p className="text-xs text-muted-foreground">Order value {Number(o.total_xaf).toLocaleString()} XAF</p>
      </Card>

      {canPickup && (
        <Button className="w-full" size="lg" onClick={confirmPickup} disabled={busy}>
          <Truck className="size-4 mr-2" /> I have the items — start delivery
        </Button>
      )}

      {canDeliver && (
        <Card className="p-4 space-y-3 border-primary/40">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-primary" />
            <span className="font-medium">Delivery code</span>
          </div>
          <p className="text-xs text-muted-foreground">Ask the customer to read their 4-digit code.</p>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            inputMode="numeric"
            placeholder="• • • •"
            className="text-center text-2xl font-mono tracking-[0.4em]"
            aria-label="Delivery code"
          />
          <Button className="w-full" size="lg" onClick={verifyDelivery} disabled={busy || code.length < 3}>
            Confirm delivery
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="sm"
            disabled={busy}
            onClick={async () => {
              const reason = window.prompt("Why request a new code? (e.g. customer can't find SMS)") ?? "customer_unable";
              const r = await callFn("ddn-deliver-code-resend", { assignment_id: id, reason });
              if (r?.ok) {
                toast.success("New code sent to the customer");
                setCode("");
              }
            }}
          >
            <RefreshCw className="size-4 mr-2" /> Request a new code
          </Button>
        </Card>
      )}

      {done && (
        <Card className="p-4 text-center text-sm text-muted-foreground">
          Delivery complete. <Link to="/app/driver/earnings" className="text-primary">View earnings</Link>
        </Card>
      )}
    </div>
  );
}
