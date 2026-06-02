import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard } from "@/components/daily-needs/StoreCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function DailyNeedsFood() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("daily_needs_stores")
        .select("id, name, banner_url, rating, preparation_time_min, vertical")
        .eq("vertical", "food").eq("status", "active")
        .order("rating", { ascending: false });
      setStores(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
        <h1 className="text-xl font-semibold">Food</h1>
      </div>
      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : stores.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No restaurants available yet.</p>
      ) : (
        <div className="grid gap-3">{stores.map((s) => <StoreCard key={s.id} store={s} />)}</div>
      )}
    </div>
  );
}
