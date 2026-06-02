import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, User, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function DriverProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("ddn_drivers").select("*").eq("user_id", user.id).maybeSingle();
      setDriver(data);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!driver) return;
    setSaving(true);
    const { error } = await supabase.from("ddn_drivers").update({
      full_name: driver.full_name,
      phone: driver.phone,
      address: driver.address,
      vehicle_type: driver.vehicle_type,
      vehicle_registration: driver.vehicle_registration,
    }).eq("id", driver.id);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Profile updated" });
  };

  if (loading) return <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;
  if (!driver) return <div className="p-4 text-sm text-muted-foreground">Not registered as a driver.</div>;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft className="size-5" /></Button>
        <h1 className="text-xl font-semibold">Driver Profile</h1>
      </header>

      <Card className="p-4 flex items-center gap-3">
        <div className="size-14 rounded-full bg-muted flex items-center justify-center overflow-hidden">
          {driver.photo_url ? <img src={driver.photo_url} alt="" className="size-full object-cover" /> : <User className="size-6 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">{driver.full_name}</p>
          <div className="flex items-center gap-1 flex-wrap mt-1">
            <Badge variant={driver.approval_status === "approved" ? "default" : "secondary"} className="text-[10px] capitalize">{driver.approval_status}</Badge>
            <Badge variant={driver.kyc_status === "verified" ? "default" : "outline"} className="text-[10px] capitalize">KYC {driver.kyc_status}</Badge>
            <span className="text-xs text-muted-foreground">⭐ {driver.rating?.toFixed(1) ?? "—"}</span>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div><Label>Full name</Label><Input value={driver.full_name ?? ""} onChange={(e) => setDriver({ ...driver, full_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={driver.phone ?? ""} onChange={(e) => setDriver({ ...driver, phone: e.target.value })} /></div>
        <div><Label>Address</Label><Input value={driver.address ?? ""} onChange={(e) => setDriver({ ...driver, address: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Vehicle type</Label><Input value={driver.vehicle_type ?? ""} onChange={(e) => setDriver({ ...driver, vehicle_type: e.target.value })} placeholder="bike" /></div>
          <div><Label>Plate</Label><Input value={driver.vehicle_registration ?? ""} onChange={(e) => setDriver({ ...driver, vehicle_registration: e.target.value })} /></div>
        </div>
        <Button className="w-full" onClick={save} disabled={saving}><Bike className="size-4 mr-1" />Save changes</Button>
      </Card>
    </div>
  );
}
