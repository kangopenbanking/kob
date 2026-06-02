import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Truck, MapPin, Wallet, Star, ChevronRight, RadioTower } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FN = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1";

export default function DriverHome() {
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ offerId: string; action: "accept" | "decline" } | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: d } = await supabase.from("ddn_drivers").select("*").eq("user_id", user.id).maybeSingle();
    setDriver(d);
    if (d) {
      const [{ data: w }, { data: of }, { data: ac }] = await Promise.all([
        supabase.from("ddn_driver_wallets").select("*").eq("driver_id", d.id).maybeSingle(),
        supabase.from("ddn_assignment_offers")
          .select("id, expires_at, assignment_id, ddn_assignments!inner(id, pickup_lat, pickup_lng, drop_lat, drop_lng, distance_km, eta_min, delivery_fee_xaf, driver_earnings_xaf)")
          .eq("driver_id", d.id).eq("status", "offered")
          .order("created_at", { ascending: false }),
        supabase.from("ddn_assignments")
          .select("id, status, distance_km, eta_min, order_id, daily_needs_orders!inner(daily_needs_stores(name))")
          .eq("driver_id", d.id).in("status", ["accepted", "picked_up", "on_the_way", "arriving"])
          .order("created_at", { ascending: false }),
      ]);
      setWallet(w); setOffers(of ?? []); setActive(ac ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime: refresh on offer/assignment changes
  useEffect(() => {
    if (!driver?.id) return;
    const ch = supabase.channel(`driver-${driver.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ddn_assignment_offers", filter: `driver_id=eq.${driver.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ddn_assignments", filter: `driver_id=eq.${driver.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ddn_driver_wallets", filter: `driver_id=eq.${driver.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driver?.id, load]);

  // Background GPS push while online
  useEffect(() => {
    if (!driver || driver.status === "offline" || !("geolocation" in navigator)) return;
    let stopped = false;
    const push = async (pos: GeolocationPosition) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || stopped) return;
      fetch(`${FN}/ddn-driver-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          heading: pos.coords.heading ?? undefined,
          speed_kmh: pos.coords.speed ? pos.coords.speed * 3.6 : undefined,
          accuracy_m: pos.coords.accuracy,
        }),
      }).catch(() => {});
    };
    const id = navigator.geolocation.watchPosition(push, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
    return () => { stopped = true; navigator.geolocation.clearWatch(id); };
  }, [driver?.status]);

  const toggleOnline = async (online: boolean) => {
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FN}/ddn-driver-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ status: online ? "online" : "offline" }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { toast.error(body.error || "Could not change status"); return; }
    await load();
  };

  const respond = async (offerId: string, action: "accept" | "decline") => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${FN}/ddn-offer-respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ offer_id: offerId, action }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) toast.error(body.error || "Failed");
    else toast.success(action === "accept" ? "Offer accepted" : "Offer declined");
    await load();
  };

  if (loading) return <div className="p-4 space-y-3"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></div>;

  if (!driver) {
    return (
      <div className="p-6 space-y-4 text-center">
        <Truck className="size-12 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Become a Daily Needs driver</h1>
        <p className="text-sm text-muted-foreground">Earn from deliveries in your area. Complete a quick registration to get started.</p>
        <Button asChild><Link to="/app/driver/register">Get started</Link></Button>
      </div>
    );
  }

  const isOnline = driver.status === "online";

  return (
    <div className="pb-24 animate-fade-in">
      <div className={`relative overflow-hidden text-white px-4 pt-4 pb-10 rounded-b-[2rem] bg-gradient-to-br ${isOnline ? "from-[hsl(160,65%,38%)] via-[hsl(170,60%,42%)] to-[hsl(195,70%,45%)]" : "from-[hsl(220,30%,30%)] via-[hsl(225,25%,35%)] to-[hsl(230,20%,40%)]"}`}>
        <div className="absolute -top-16 -right-10 size-52 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="absolute -bottom-16 -left-10 size-44 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Driver</h1>
            <p className="text-xs text-white/80">{driver.full_name}</p>
          </div>
          <Link to="/app/driver/earnings" className="text-xs text-white/90 inline-flex items-center gap-1 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/25 transition">
            Earnings <ChevronRight className="size-3" />
          </Link>
        </div>

        <div className="relative bg-white/15 backdrop-blur rounded-2xl p-4 border border-white/20 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl border-2 border-white/70 flex items-center justify-center">
                <RadioTower className="size-4" strokeWidth={2} />
              </div>
              <span className="font-semibold">{isOnline ? "You're online" : "You're offline"}</span>
              {driver.status === "busy" && <Badge variant="secondary" className="bg-white/25 text-white border-0">On delivery</Badge>}
            </div>
            <p className="text-xs text-white/85 pl-10">
              {isOnline ? "Accepting nearby offers" : "Go online to receive offers"}
            </p>
          </div>
          <Switch
            checked={isOnline}
            disabled={busy || driver.status === "busy"}
            onCheckedChange={toggleOnline}
            aria-label="Toggle online"
          />
        </div>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 border-0 shadow-md bg-[hsl(220,75%,50%)] text-white">
            <div className="size-8 rounded-xl border-2 border-white/70 flex items-center justify-center mb-2">
              <Wallet className="size-4" strokeWidth={2} />
            </div>
            <p className="text-xs text-white/85">Available</p>
            <p className="text-lg font-bold">{Number(wallet?.available_xaf ?? 0).toLocaleString()} XAF</p>
          </Card>
          <Card className="p-4 border-0 shadow-md bg-[hsl(45,90%,55%)] text-white">
            <div className="size-8 rounded-xl border-2 border-white/70 flex items-center justify-center mb-2">
              <Star className="size-4" strokeWidth={2} />
            </div>
            <p className="text-xs text-white/85">Rating</p>
            <p className="text-lg font-bold">{Number(driver.rating).toFixed(2)}</p>
          </Card>
        </div>

      {offers.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">New offers ({offers.length})</h2>
            <Link to="/app/driver/offers" className="text-xs text-primary inline-flex items-center gap-1">
              View all <ChevronRight className="size-3" />
            </Link>
          </div>
          {offers.slice(0, 2).map((o) => {
            const a = o.ddn_assignments;
            const ttl = Math.max(0, Math.round((new Date(o.expires_at).getTime() - Date.now()) / 1000));
            return (
              <Card key={o.id} className="p-4 space-y-3 border-primary/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="size-4 text-primary" />
                    {a.distance_km ? `${a.distance_km} km` : "Nearby"} · ETA {a.eta_min ?? 30} min
                  </div>
                  <Badge variant="outline">{ttl}s</Badge>
                </div>
                <p className="text-lg font-semibold">
                  +{Number(a.driver_earnings_xaf).toLocaleString()} XAF
                  <span className="text-xs font-normal text-muted-foreground ml-1">(fee {Number(a.delivery_fee_xaf).toLocaleString()})</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirm({ offerId: o.id, action: "decline" })}>Decline</Button>
                  <Button className="flex-1" onClick={() => setConfirm({ offerId: o.id, action: "accept" })}>Accept</Button>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Active deliveries</h2>
        {active.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active deliveries.</p>
        ) : (
          active.map((a) => (
            <Link key={a.id} to={`/app/driver/active/${a.id}`}>
              <Card className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors">
                <div>
                  <p className="font-medium text-sm">{a.daily_needs_orders?.daily_needs_stores?.name ?? "Order"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{String(a.status).replaceAll("_", " ")}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Card>
            </Link>
          ))
        )}
      </section>

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
    </div>
  );
}
