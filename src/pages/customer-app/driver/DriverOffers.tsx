import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Inbox, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FN = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1";

type Offer = {
  id: string;
  expires_at: string;
  status: string;
  ddn_assignments: {
    id: string;
    pickup_lat: number | null;
    pickup_lng: number | null;
    drop_lat: number | null;
    drop_lng: number | null;
    distance_km: number | null;
    eta_min: number | null;
    delivery_fee_xaf: number;
    driver_earnings_xaf: number;
  };
};

export default function DriverOffers() {
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [tick, setTick] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [warnSeconds, setWarnSeconds] = useState(10);
  const [confirm, setConfirm] = useState<{ offerId: string; action: "accept" | "decline" } | null>(null);
  const warnedRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: d } = await supabase
      .from("ddn_drivers").select("id").eq("user_id", user.id).maybeSingle();
    if (!d) { setLoading(false); return; }
    setDriverId(d.id);
    const [{ data }, { data: rules }] = await Promise.all([
      supabase.from("ddn_assignment_offers")
        .select("id, expires_at, status, ddn_assignments!inner(id, pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km, eta_min, delivery_fee_xaf, driver_earnings_xaf)")
        .eq("driver_id", d.id).eq("status", "offered")
        .order("created_at", { ascending: false }),
      supabase.from("ddn_driver_notification_rules").select("offer_warn_seconds").eq("singleton", true).maybeSingle(),
    ]);
    setOffers((data ?? []) as any);
    if (rules?.offer_warn_seconds) setWarnSeconds(Number(rules.offer_warn_seconds));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Realtime offers
  useEffect(() => {
    if (!driverId) return;
    const ch = supabase.channel(`driver-offers-${driverId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "ddn_assignment_offers", filter: `driver_id=eq.${driverId}` },
        load,
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driverId, load]);

  // Warn-toast as offers approach expiry (rules-configurable threshold)
  useEffect(() => {
    for (const o of offers) {
      const ttl = Math.max(0, Math.round((new Date(o.expires_at).getTime() - Date.now()) / 1000));
      if (ttl > 0 && ttl <= warnSeconds && !warnedRef.current.has(o.id)) {
        warnedRef.current.add(o.id);
        toast.warning(`Offer expiring in ${ttl}s`, { description: "Accept now or it will be reassigned." });
      }
    }
  }, [tick, offers, warnSeconds]);

  const respond = async (offerId: string, action: "accept" | "decline") => {
    setBusyId(offerId);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FN}/ddn-offer-respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ offer_id: offerId, action }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) toast.error(body.error || "Failed to respond");
    else toast.success(action === "accept" ? "Offer accepted — head to pickup" : "Offer declined");
    await load();
  };

  if (loading) {
    return <div className="p-4 space-y-3"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></div>;
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon"><Link to="/app/driver"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-xl font-semibold">Offers</h1>
          <p className="text-xs text-muted-foreground">Accept or decline incoming deliveries</p>
        </div>
      </div>

      {offers.length === 0 ? (
        <Card className="p-10 text-center">
          <Inbox className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No new offers</h3>
          <p className="text-sm text-muted-foreground mt-1">Stay online — new deliveries appear here automatically.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => {
            const a = o.ddn_assignments;
            const ttl = Math.max(0, Math.round((new Date(o.expires_at).getTime() - Date.now()) / 1000));
            const expired = ttl === 0;
            const warn = ttl > 0 && ttl <= warnSeconds;
            return (
              <Card key={o.id + tick} className={`p-4 space-y-3 ${warn ? "border-destructive" : "border-primary/40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="size-4 text-primary" />
                    {a.distance_km ? `${Number(a.distance_km).toFixed(1)} km` : "Nearby"} · ETA {a.eta_min ?? 30} min
                  </div>
                  <Badge variant={expired ? "destructive" : warn ? "destructive" : "outline"}>
                    {expired ? "Expired" : `${ttl}s`}
                  </Badge>
                </div>
                <p className="text-lg font-semibold">
                  +{Number(a.driver_earnings_xaf).toLocaleString()} XAF
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    (fee {Number(a.delivery_fee_xaf).toLocaleString()})
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" disabled={busyId === o.id || expired}
                    onClick={() => setConfirm({ offerId: o.id, action: "decline" })}>Decline</Button>
                  <Button className="flex-1" disabled={busyId === o.id || expired}
                    onClick={() => setConfirm({ offerId: o.id, action: "accept" })}>Accept</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "accept" ? "Accept this delivery?" : "Decline this offer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "accept"
                ? "You commit to picking up and delivering this order. Repeated cancellations may affect your rating."
                : "This offer will be reassigned to another driver."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) respond(confirm.offerId, confirm.action); setConfirm(null); }}>
              {confirm?.action === "accept" ? "Yes, accept" : "Yes, decline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
