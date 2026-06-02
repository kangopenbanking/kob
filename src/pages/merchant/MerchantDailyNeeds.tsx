import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed, Pill, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Skeleton } from "@/components/ui/skeleton";

export default function MerchantDailyNeeds() {
  const navigate = useNavigate();
  const { user } = useAuthenticatedUser();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: merchants } = await supabase
        .from("gateway_merchants").select("id").eq("user_id", user.id);
      const merchantIds = (merchants ?? []).map((m) => m.id);
      if (merchantIds.length === 0) { setLoading(false); return; }
      const { data } = await supabase
        .from("daily_needs_stores")
        .select("*")
        .in("merchant_id", merchantIds);
      setStores(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Daily Needs</h1>
          <p className="text-sm text-muted-foreground">Manage your Food or Pharmacy storefront.</p>
        </div>
        <Button onClick={() => navigate("/merchant/daily-needs/new")}>
          <Plus className="size-4 mr-2" /> New store
        </Button>
      </header>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : stores.length === 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Card onClick={() => navigate("/merchant/daily-needs/new?vertical=food")} className="p-6 cursor-pointer hover:border-foreground/30 transition-colors">
            <UtensilsCrossed className="size-7 mb-3" />
            <h3 className="font-semibold">Open a Food store</h3>
            <p className="text-sm text-muted-foreground mt-1">Restaurants, cafés, ghost kitchens.</p>
          </Card>
          <Card onClick={() => navigate("/merchant/daily-needs/new?vertical=pharmacy")} className="p-6 cursor-pointer hover:border-foreground/30 transition-colors">
            <Pill className="size-7 mb-3" />
            <h3 className="font-semibold">Open a Pharmacy</h3>
            <p className="text-sm text-muted-foreground mt-1">OTC products and prescription dispensing.</p>
          </Card>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {stores.map((s) => (
            <Card key={s.id} className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{s.name}</h3>
                <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground capitalize">{s.vertical} · {s.preparation_time_min} min prep · {s.delivery_radius_km} km radius</p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => navigate(`/merchant/daily-needs/${s.id}/edit`)}>Manage</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/merchant/daily-needs/${s.id}/menu`)}>Menu</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5 bg-muted/30">
        <h3 className="font-semibold text-sm mb-1">Already on WooCommerce?</h3>
        <p className="text-sm text-muted-foreground mb-3">Sync your existing catalog instead of rebuilding it.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/merchant/woo-sync")}>Connect WooCommerce</Button>
      </Card>
    </div>
  );
}
