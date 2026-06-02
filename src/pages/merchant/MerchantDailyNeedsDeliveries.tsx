import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Truck, Package, RefreshCw, Wifi, Search, Download, Eye,
  Clock, CheckCircle2, MapPin, Bike, Phone,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary", offered: "secondary",
  accepted: "outline", picked_up: "outline", on_the_way: "outline", arriving: "outline",
  delivered: "default",
  cancelled: "destructive", assignment_failed: "destructive", failed: "destructive", expired: "destructive",
};

const ACTIVE_STATUSES = ["pending", "offered", "accepted", "picked_up", "on_the_way", "arriving"];
const ALL_STATUSES = [
  "pending", "offered", "accepted", "picked_up", "on_the_way",
  "arriving", "delivered", "cancelled", "assignment_failed",
];

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: any[]) {
  const headers = [
    "id", "status", "driver", "vehicle", "distance_km", "eta_min",
    "delivery_fee_xaf", "platform_fee_xaf", "driver_earnings_xaf",
    "created_at", "assigned_at", "picked_up_at", "delivered_at",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.id, r.status, r.ddn_drivers?.full_name ?? "", r.ddn_drivers?.vehicle_type ?? "",
      r.distance_km ?? "", r.eta_min ?? "",
      r.delivery_fee_xaf ?? 0, r.platform_fee_xaf ?? 0, r.driver_earnings_xaf ?? 0,
      r.created_at ?? "", r.assigned_at ?? "", r.picked_up_at ?? "", r.delivered_at ?? "",
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `deliveries-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function MerchantDailyNeedsDeliveries() {
  const { user } = useAuthenticatedUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "completed" | "all">("active");
  const [statusFilter, setStatusFilter] = useState<string>("any");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"7" | "30" | "90" | "all">("30");
  const [detail, setDetail] = useState<any | null>(null);

  const merchantsQ = useQuery({
    queryKey: ["merchant-ids", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_merchants").select("id").eq("user_id", user!.id);
      return (data ?? []).map((m) => m.id);
    },
  });
  const merchantIds = merchantsQ.data ?? [];

  const deliveriesQ = useQuery({
    queryKey: ["ddn-assignments", merchantIds.join(","), range],
    enabled: merchantIds.length > 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      let q = supabase
        .from("ddn_assignments")
        .select("*, ddn_drivers(full_name, phone, vehicle_type, rating)")
        .in("merchant_id", merchantIds)
        .order("created_at", { ascending: false })
        .limit(500);
      if (range !== "all") {
        const since = new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (merchantIds.length === 0) return;
    const channel = supabase
      .channel(`ddn-merchant-${merchantIds.join("-")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ddn_assignments", filter: `merchant_id=in.(${merchantIds.join(",")})` },
        () => qc.invalidateQueries({ queryKey: ["ddn-assignments", merchantIds.join(",")] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantIds.join(","), qc]);

  const filtered = useMemo(() => {
    let rows = deliveriesQ.data ?? [];
    if (tab === "active") rows = rows.filter((r: any) => ACTIVE_STATUSES.includes(r.status));
    else if (tab === "completed") rows = rows.filter((r: any) => !ACTIVE_STATUSES.includes(r.status));
    if (statusFilter !== "any") rows = rows.filter((r: any) => r.status === statusFilter);
    const s = search.trim().toLowerCase();
    if (s) rows = rows.filter((r: any) =>
      r.id.toLowerCase().includes(s) ||
      (r.ddn_drivers?.full_name ?? "").toLowerCase().includes(s) ||
      (r.order_id ?? "").toLowerCase().includes(s),
    );
    return rows;
  }, [deliveriesQ.data, tab, statusFilter, search]);

  const loading = merchantsQ.isLoading || deliveriesQ.isLoading;
  const counts = useMemo(() => {
    const all = deliveriesQ.data ?? [];
    return {
      active: all.filter((r: any) => ACTIVE_STATUSES.includes(r.status)).length,
      completed: all.filter((r: any) => !ACTIVE_STATUSES.includes(r.status)).length,
      all: all.length,
    };
  }, [deliveriesQ.data]);

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deliveries</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Wifi className="size-3 text-emerald-600" />
            Live — updates as drivers accept, pick up, and deliver.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCsv(filtered)} disabled={filtered.length === 0}>
            <Download className="size-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => deliveriesQ.refetch()}>
            <RefreshCw className="size-4 mr-2" /> Refresh
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active">Active ({counts.active})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by delivery id, driver, or order id"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => setRange(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Package className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold">No deliveries to show</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try widening the date range or clearing filters.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Truck className="size-4" />
                    <span className="font-mono text-xs">#{r.id.slice(0, 8)}</span>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"} className="capitalize">
                      {String(r.status).replace(/_/g, " ")}
                    </Badge>
                    {r.delivered_at && (
                      <span className="text-xs text-muted-foreground">
                        Delivered {formatDistanceToNow(new Date(r.delivered_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm">
                    {r.ddn_drivers?.full_name ?? "Awaiting driver"} ·{" "}
                    <span className="text-muted-foreground">{r.ddn_drivers?.vehicle_type ?? "—"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.distance_km ? `${Number(r.distance_km).toFixed(1)} km · ` : ""}
                    {r.eta_min ? `ETA ${r.eta_min} min · ` : ""}
                    Created {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm font-medium">{Number(r.delivery_fee_xaf ?? 0).toLocaleString()} XAF</p>
                  <p className="text-xs text-muted-foreground">
                    Driver: {Number(r.driver_earnings_xaf ?? 0).toLocaleString()} · Platform: {Number(r.platform_fee_xaf ?? 0).toLocaleString()}
                  </p>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
                      <Eye className="size-3.5 mr-1" /> Details
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/merchant/daily-needs/${r.merchant_id}`)}>
                      Store
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Truck className="size-4" /> Delivery #{detail.id.slice(0, 8)}
                </SheetTitle>
                <SheetDescription>
                  <Badge variant={STATUS_VARIANT[detail.status] ?? "secondary"} className="capitalize">
                    {String(detail.status).replace(/_/g, " ")}
                  </Badge>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <section className="space-y-2">
                  <h4 className="text-sm font-semibold">Driver</h4>
                  {detail.ddn_drivers ? (
                    <div className="text-sm space-y-1">
                      <p className="flex items-center gap-2"><Bike className="size-3.5" /> {detail.ddn_drivers.full_name} · {detail.ddn_drivers.vehicle_type ?? "—"}</p>
                      {detail.ddn_drivers.phone && (
                        <p className="flex items-center gap-2 text-muted-foreground"><Phone className="size-3.5" /> {detail.ddn_drivers.phone}</p>
                      )}
                      {detail.ddn_drivers.rating != null && (
                        <p className="text-xs text-muted-foreground">Rating {Number(detail.ddn_drivers.rating).toFixed(2)}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No driver assigned yet.</p>
                  )}
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-semibold">Timeline</h4>
                  <ol className="space-y-3 text-sm">
                    <TimelineEntry icon={<Clock className="size-3.5" />} label="Created" at={detail.created_at} />
                    <TimelineEntry icon={<Bike className="size-3.5" />} label="Assigned to driver" at={detail.assigned_at} />
                    <TimelineEntry icon={<Package className="size-3.5" />} label="Picked up" at={detail.picked_up_at} />
                    <TimelineEntry icon={<CheckCircle2 className="size-3.5" />} label="Delivered" at={detail.delivered_at} />
                  </ol>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-semibold">Route</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <MapPin className="size-3.5" />
                    {detail.distance_km ? `${Number(detail.distance_km).toFixed(1)} km` : "—"} ·
                    ETA {detail.eta_min ?? "—"} min
                  </p>
                  {detail.pickup_lat && detail.drop_lat && (
                    <p className="text-xs font-mono text-muted-foreground">
                      {Number(detail.pickup_lat).toFixed(4)}, {Number(detail.pickup_lng).toFixed(4)}
                      {" → "}
                      {Number(detail.drop_lat).toFixed(4)}, {Number(detail.drop_lng).toFixed(4)}
                    </p>
                  )}
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-semibold">Fees</h4>
                  <div className="text-sm grid grid-cols-2 gap-y-1">
                    <span className="text-muted-foreground">Customer pays</span>
                    <span className="text-right">{Number(detail.delivery_fee_xaf ?? 0).toLocaleString()} XAF</span>
                    <span className="text-muted-foreground">Driver earnings</span>
                    <span className="text-right">{Number(detail.driver_earnings_xaf ?? 0).toLocaleString()} XAF</span>
                    <span className="text-muted-foreground">Platform fee</span>
                    <span className="text-right">{Number(detail.platform_fee_xaf ?? 0).toLocaleString()} XAF</span>
                  </div>
                </section>

                <Button variant="outline" className="w-full" onClick={() => navigate(`/merchant/daily-needs/${detail.merchant_id}`)}>
                  Open store
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TimelineEntry({ icon, label, at }: { icon: React.ReactNode; label: string; at: string | null }) {
  const done = !!at;
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 flex size-6 items-center justify-center rounded-full ${done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        {icon}
      </span>
      <div className="flex-1">
        <p className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>{label}</p>
        {at && <p className="text-xs text-muted-foreground">{format(new Date(at), "PPpp")}</p>}
      </div>
    </li>
  );
}
