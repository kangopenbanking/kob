import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SafeImage } from "@/components/common/SafeImage";

export default function DailyNeedsFavorites() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: favs }, { data: orders }] = await Promise.all([
      supabase.from("daily_needs_favorites")
        .select("id, store_id, daily_needs_stores(id,name,banner_url,vertical)")
        .eq("user_id", user.id),
      supabase.from("daily_needs_orders")
        .select("id, store_id, total_xaf, daily_needs_stores(id,name,banner_url)")
        .eq("user_id", user.id).eq("status", "delivered")
        .order("created_at", { ascending: false }).limit(5),
    ]);
    setFavorites(favs ?? []);
    setRecent(orders ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (favId: string) => {
    await supabase.from("daily_needs_favorites").delete().eq("id", favId);
    toast({ title: "Removed from favorites" });
    load();
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-6">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-semibold">Favorites</h1>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Heart className="size-4" /> Saved stores</h2>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : favorites.length === 0 ? (
          <EmptyState
            icon={<Heart className="size-6 text-muted-foreground" />}
            title="No favorites yet"
            description="Tap the heart on a store to save it here."
            action={{ label: "Browse stores", onClick: () => navigate("/app/daily-needs") }}
          />
        ) : (
          <div className="space-y-2">
            {favorites.map((f) => (
              <Card key={f.id} className="p-3 flex items-center gap-3">
                <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {f.daily_needs_stores?.banner_url && <SafeImage src={f.daily_needs_stores.banner_url} alt="" className="size-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/app/daily-needs/store/${f.store_id}`)}>
                  <p className="font-medium text-sm truncate">{f.daily_needs_stores?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{f.daily_needs_stores?.vertical}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(f.id)} aria-label="Remove favorite">
                  <Heart className="size-4 fill-destructive text-destructive" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><RotateCw className="size-4" /> Reorder</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Completed orders will appear here for quick reorder.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((o) => (
              <Card key={o.id} onClick={() => navigate(`/app/daily-needs/store/${o.store_id}`)} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent">
                <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {o.daily_needs_stores?.banner_url && <SafeImage src={o.daily_needs_stores.banner_url} alt="" className="size-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{o.daily_needs_stores?.name}</p>
                  <p className="text-xs text-muted-foreground">{Number(o.total_xaf).toLocaleString()} XAF</p>
                </div>
                <Button variant="outline" size="sm">Reorder</Button>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
