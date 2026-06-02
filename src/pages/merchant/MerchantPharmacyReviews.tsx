import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, XCircle, FileText, Clock, ExternalLink, Loader2, Stethoscope } from "lucide-react";

interface OrderRow {
  id: string;
  created_at: string;
  total_xaf: number;
  status: string;
  prescription_status: string | null;
  prescription_url: string | null;
  delivery_phone: string | null;
  user_id: string;
  store: { id: string; name: string } | null;
}

export default function MerchantPharmacyReviews() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<Record<string, "approve" | "reject" | null>>({});

  const load = async () => {
    setLoading(true);
    const { data: stores } = await supabase
      .from("daily_needs_stores")
      .select("id, name, gateway_merchants:merchant_id!inner(user_id)")
      .eq("vertical", "pharmacy");
    const storeIds = (stores ?? []).map((s: any) => s.id);
    if (!storeIds.length) { setOrders([]); setLoading(false); return; }

    const filter = tab === "pending" ? null : tab;
    let q = supabase
      .from("daily_needs_orders")
      .select("id, created_at, total_xaf, status, prescription_status, prescription_url, delivery_phone, user_id, store:store_id(id, name)")
      .in("store_id", storeIds)
      .not("prescription_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
    q = filter ? q.eq("prescription_status", filter) : q.or("prescription_status.is.null,prescription_status.eq.pending");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setOrders((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const counts = useMemo(() => ({ pending: orders.length }), [orders.length]);

  const act = async (order_id: string, decision: "approved" | "rejected") => {
    setActing((s) => ({ ...s, [order_id]: decision === "approved" ? "approve" : "reject" }));
    try {
      const { data, error } = await supabase.functions.invoke("daily-needs-prescription-review", {
        body: { order_id, decision, notes: notes[order_id]?.trim() || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(decision === "approved" ? "Prescription approved" : "Prescription rejected");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setActing((s) => ({ ...s, [order_id]: null }));
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" /> Prescription reviews
          </h1>
          <p className="text-sm text-muted-foreground">
            Approve or reject customer-uploaded prescriptions before dispatch.
          </p>
        </div>
        {tab === "pending" && counts.pending > 0 && (
          <Badge variant="secondary" className="h-7 px-3">{counts.pending} pending</Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-3 w-full md:w-auto">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
      ) : orders.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <FileText className="size-8 mx-auto mb-3 opacity-50" />
          No {tab} prescriptions.
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const isActing = !!acting[o.id];
            return (
              <Card key={o.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium text-sm truncate">Order #{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                      <Clock className="size-3" />
                      {new Date(o.created_at).toLocaleString()} · {o.store?.name ?? "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{Math.round(Number(o.total_xaf)).toLocaleString()} XAF</p>
                    <Badge
                      variant={o.prescription_status === "approved" ? "default" : o.prescription_status === "rejected" ? "destructive" : "secondary"}
                      className="mt-1 capitalize text-[10px]"
                    >
                      {o.prescription_status ?? "pending"}
                    </Badge>
                  </div>
                </div>

                {o.prescription_url && (
                  <a
                    href={o.prescription_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <FileText className="size-3.5" /> Open prescription
                    <ExternalLink className="size-3" />
                  </a>
                )}

                {tab === "pending" && (
                  <>
                    <Textarea
                      value={notes[o.id] ?? ""}
                      onChange={(e) => setNotes((s) => ({ ...s, [o.id]: e.target.value }))}
                      placeholder="Optional note for the customer (e.g. reason for rejection)…"
                      rows={2}
                      maxLength={500}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isActing}
                        onClick={() => act(o.id, "rejected")}
                      >
                        {acting[o.id] === "reject"
                          ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Rejecting…</>
                          : <><XCircle className="size-3.5 mr-1.5" /> Reject</>}
                      </Button>
                      <Button
                        size="sm"
                        disabled={isActing}
                        onClick={() => act(o.id, "approved")}
                      >
                        {acting[o.id] === "approve"
                          ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Approving…</>
                          : <><CheckCircle2 className="size-3.5 mr-1.5" /> Approve</>}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
