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
    <div className="pb-8 animate-fade-in">
      <div className="relative bg-[hsl(160,65%,40%)] text-white px-4 pt-4 pb-5">

        <div className="relative flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"
            className="text-white hover:bg-white/15 hover:text-white -ml-2">
            <ChevronLeft />
          </Button>
          <div className="size-11 rounded-2xl border-2 border-white/70 flex items-center justify-center">
            <Pill className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Pharmacy</h1>
            <p className="text-xs text-white/85">OTC and prescription delivery</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="otc" className="gap-1.5"><Pill className="size-3.5" strokeWidth={2} /> OTC</TabsTrigger>
            <TabsTrigger value="rx" className="gap-1.5"><Stethoscope className="size-3.5" strokeWidth={2} /> Prescription</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {tab === "rx" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-3 text-xs text-amber-700 dark:text-amber-400">
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
    </div>
  );
}
