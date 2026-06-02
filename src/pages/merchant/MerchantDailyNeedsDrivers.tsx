import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Bike, UserPlus, Phone, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function MerchantDailyNeedsDrivers() {
  const { user } = useAuthenticatedUser();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: merchants } = await supabase
      .from("gateway_merchants").select("id").eq("user_id", user.id);
    const ids = (merchants ?? []).map((m) => m.id);
    if (ids.length === 0) { setLoading(false); return; }
    const { data } = await supabase
      .from("ddn_drivers")
      .select("*")
      .in("owner_merchant_id", ids)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const inviteLink = `${window.location.origin}/app/driver/register`;
  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteLink);
    toast({ title: "Invite link copied", description: "Share with riders to onboard them to your fleet." });
  };

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Drivers</h1>
          <p className="text-sm text-muted-foreground">Riders assigned to your storefronts.</p>
        </div>
        <Button onClick={copyInvite}>
          <UserPlus className="size-4 mr-2" /> Invite a driver
        </Button>
      </header>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Bike className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No owned drivers yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Your stores currently rely on the shared Daily Needs delivery network. Invite riders to build your own fleet.
          </p>
          <Button variant="outline" onClick={copyInvite}>Copy invite link</Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map((d) => (
            <Card key={d.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{d.full_name}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{d.vehicle_type} · {d.vehicle_registration ?? "—"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={d.approval_status === "approved" ? "default" : "secondary"} className="capitalize">
                    {d.approval_status}
                  </Badge>
                  <Badge variant="outline" className="capitalize text-xs">{d.status}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="size-3" /> {d.phone ?? "—"}</span>
                <span className="flex items-center gap-1"><Star className="size-3" /> {d.rating ?? "—"}</span>
                <span>{d.total_deliveries ?? 0} deliveries</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
