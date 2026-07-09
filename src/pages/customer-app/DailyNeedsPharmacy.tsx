import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Pill,
  Stethoscope,
  ShieldCheck,
  Camera,
  PackageCheck,
  Bike,
  Info,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard } from "@/components/daily-needs/StoreCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HowItWorksFlow } from "@/components/customer-app/HowItWorksFlow";
import { useHowItWorksSteps } from "@/hooks/useHowItWorksSteps";

type TabKey = "all" | "otc" | "rx";

export default function DailyNeedsPharmacy() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("daily_needs_stores")
        .select("id, name, banner_url, rating, preparation_time_min, vertical")
        .eq("vertical", "pharmacy")
        .eq("status", "active")
        .order("rating", { ascending: false });
      if (!cancelled) {
        setStores(data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const visible = q ? stores.filter((s) => s.name?.toLowerCase().includes(q)) : stores;

  return (
    <div className="pb-8 animate-fade-in">
      <div className="relative bg-[#29909e] text-white px-4 pt-4 pb-5">
        <div className="relative flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="text-white hover:bg-white/15 hover:text-white -ml-2"
          >
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

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pharmacies"
            className="pl-10 h-11 rounded-2xl bg-white text-foreground border-0 shadow-lg"
            aria-label="Search pharmacies"
          />
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="otc" className="gap-1.5">
              <Pill className="size-3.5" strokeWidth={2} /> OTC
            </TabsTrigger>
            <TabsTrigger value="rx" className="gap-1.5">
              <Stethoscope className="size-3.5" strokeWidth={2} /> Prescription
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {tab === "otc" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 mb-3 text-xs text-emerald-800 dark:text-emerald-300 flex gap-2">
                <ShieldCheck className="size-4 shrink-0 mt-0.5" strokeWidth={2} />
                <div className="space-y-0.5">
                  <p className="font-semibold">Over-the-counter (OTC) medicines</p>
                  <p className="opacity-90">
                    No prescription needed. Always read the label and respect dosage. Consult a pharmacist if symptoms persist beyond 3 days or you are pregnant, breastfeeding, or on chronic treatment.
                  </p>
                </div>
              </div>
            )}

            {tab === "rx" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 mb-3 text-xs text-amber-700 dark:text-amber-400 flex gap-2">
                <Info className="size-4 shrink-0 mt-0.5" strokeWidth={2} />
                <div className="space-y-0.5">
                  <p className="font-semibold">Prescription required</p>
                  <p className="opacity-90">
                    Prescription items require a clear photo of a valid prescription. A pharmacist will approve before dispatch.
                  </p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {q ? "No pharmacies match your search." : "No pharmacies available yet."}
                </p>
                {q && (
                  <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {visible.map((s) => (
                  <StoreCard
                    key={s.id}
                    store={s}
                    hrefSuffix={tab !== "all" ? `?filter=${tab}` : ""}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <PharmacyHowItWorks />


        <div className="rounded-xl bg-muted/60 px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
          Safety first: never share your prescription with third parties. If you experience a medical
          emergency, call your local emergency services immediately — this service is not a substitute
          for professional medical advice.
        </div>
      </div>
    </div>
  );
}

function PharmacyHowItWorks() {
  const steps = useHowItWorksSteps("pharmacy", [
    { icon: Pill, title: "Choose a pharmacy", description: "Browse nearby pharmacies, filter by OTC or Prescription, and pick one with good ratings and fast prep time.", color: "hsl(160, 65%, 90%)", iconColor: "hsl(160, 65%, 35%)" },
    { icon: PackageCheck, title: "Add items to your cart", description: "OTC items can be added freely. Prescription items will be flagged with a badge and require approval.", color: "hsl(160, 65%, 90%)", iconColor: "hsl(160, 65%, 35%)" },
    { icon: Camera, title: "Upload your prescription", description: "At checkout, upload a clear photo or PDF of a valid prescription (max 8 MB). One file covers all Rx items in the order.", color: "hsl(160, 65%, 90%)", iconColor: "hsl(160, 65%, 35%)" },
    { icon: ShieldCheck, title: "Pharmacist review", description: "A licensed pharmacist verifies your prescription. You'll be notified once it's approved — or contacted if anything is missing.", color: "hsl(160, 65%, 90%)", iconColor: "hsl(160, 65%, 35%)" },
    { icon: Bike, title: "Delivered to your door", description: "After approval, your order is prepared and dispatched. Track the rider live and confirm delivery with your one-time code.", color: "hsl(160, 65%, 90%)", iconColor: "hsl(160, 65%, 35%)" },
  ]);
  return <HowItWorksFlow title="How Pharmacy works" storageKey="pharmacy" steps={steps} />;
}

