import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Pill, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard } from "@/components/daily-needs/StoreCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function DailyNeedsPharmacy() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "otc" | "rx">("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("daily_needs_stores")
        .select("id, name, banner_url, rating, preparation_time_min, vertical")
        .eq("vertical", "pharmacy").eq("status", "active")
        .order("rating", { ascending: false });
      setStores(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
        <div>
          <h1 className="text-xl font-semibold leading-tight">Pharmacy</h1>
          <p className="text-xs text-muted-foreground">Order OTC products instantly, or upload a prescription for review.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="otc" className="gap-1.5"><Pill className="size-3.5" /> OTC</TabsTrigger>
          <TabsTrigger value="rx" className="gap-1.5"><Stethoscope className="size-3.5" /> Prescription</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {tab === "rx" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-3 text-xs text-amber-700 dark:text-amber-400">
              Prescription items require a clear photo of a valid prescription. A pharmacist will approve before dispatch.
            </div>
          )}
          {loading ? (
            <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
          ) : stores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No pharmacies available yet.</p>
          ) : (
            <div className="grid gap-3">
              {stores.map((s) => (
                <StoreCard key={s.id} store={s} hrefSuffix={tab !== "all" ? `?filter=${tab}` : ""} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
