import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Download, MapPin, Navigation, Package, Phone, Receipt, StickyNote, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { OrderStatusTimeline } from "@/components/daily-needs/OrderStatusTimeline";
import { downloadOrderReceipt } from "@/lib/daily-needs/orderReceipt";
import { toast } from "@/hooks/use-toast";

const CANCELLABLE = new Set(["received", "accepted"]);

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  received: "secondary",
  accepted: "outline",
  preparing: "outline",
  ready: "outline",
  picked_up: "outline",
  on_the_way: "outline",
  arriving: "outline",
  delivered: "default",
  cancelled: "destructive",
  refunded: "destructive",
};

const TRACKABLE = new Set(["accepted", "preparing", "ready", "picked_up", "on_the_way", "arriving"]);

type Item = {
  id: string;
  name_snapshot: string;
  quantity: number;
  unit_price_xaf: number;
  total_xaf: number;
};

type Order = {
  id: string;
  status: string;
  subtotal_xaf: number;
  delivery_fee_xaf: number;
  service_fee_xaf: number;
  total_xaf: number;
  delivery_address: string;
  delivery_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  store_id: string;
  daily_needs_stores: { name: string; vertical: string; banner_url: string | null } | null;
};

export default function DailyNeedsOrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    const { error } = await supabase
      .from("daily_needs_orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .in("status", ["received", "accepted"]);
    setCancelling(false);
    setConfirmCancel(false);
    if (error) {
      toast({ title: "Couldn't cancel order", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Order cancelled" });
      setOrder((prev) => prev ? { ...prev, status: "cancelled" } : prev);
    }
  };

  const handleDownload = () => {
    if (!order) return;
    downloadOrderReceipt({
      id: order.id,
      status: order.status,
      vertical: order.daily_needs_stores?.vertical ?? null,
      store_name: order.daily_needs_stores?.name ?? null,
      subtotal_xaf: order.subtotal_xaf,
      delivery_fee_xaf: order.delivery_fee_xaf,
      service_fee_xaf: order.service_fee_xaf,
      total_xaf: order.total_xaf,
      delivery_address: order.delivery_address,
      delivery_phone: order.delivery_phone,
      notes: order.notes,
      created_at: order.created_at,
      updated_at: order.updated_at,
      delivered_at: order.delivered_at,
      items: items.map((it) => ({
        name: it.name_snapshot,
        quantity: it.quantity,
        unit_price_xaf: it.unit_price_xaf,
        total_xaf: it.total_xaf,
      })),
    });
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      const [{ data: o }, { data: its }] = await Promise.all([
        supabase
          .from("daily_needs_orders")
          .select("id, status, subtotal_xaf, delivery_fee_xaf, service_fee_xaf, total_xaf, delivery_address, delivery_phone, notes, created_at, updated_at, delivered_at, store_id, daily_needs_stores(name, vertical, banner_url)")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("daily_needs_order_items")
          .select("id, name_snapshot, quantity, unit_price_xaf, total_xaf")
          .eq("order_id", id)
          .order("created_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setOrder((o as any) ?? null);
      setItems((its as any) ?? []);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel(`dn-order-details-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "daily_needs_orders", filter: `id=eq.${id}` },
        (payload: any) => {
          setOrder((prev) => (prev ? { ...prev, ...payload.new } : prev));
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [id]);

  if (loading) {
    return (
      <div className="px-4 pt-4 pb-8 space-y-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/daily-needs/orders")} aria-label="Back">
            <ChevronLeft />
          </Button>
          <h1 className="text-xl font-semibold">Order details</h1>
        </div>
        <p className="text-center text-muted-foreground py-12">Order not found.</p>
      </div>
    );
  }

  const isTrackable = TRACKABLE.has(order.status);
  const canCancel = CANCELLABLE.has(order.status);
  const shortId = order.id.slice(0, 8).toUpperCase();

  return (
    <div className="px-4 pt-4 pb-10 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/app/daily-needs/orders")} aria-label="Back">
          <ChevronLeft />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold leading-tight truncate">Order #{shortId}</h1>
          <p className="text-xs text-muted-foreground capitalize">
            {order.daily_needs_stores?.vertical ?? "Order"} · {order.daily_needs_stores?.name}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[order.status] ?? "secondary"} className="capitalize">
          {order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <Card className="p-4">
        <OrderStatusTimeline status={order.status} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {isTrackable && (
          <Button
            variant="secondary"
            className="w-full gap-2"
            onClick={() => navigate(`/app/daily-needs/orders/${order.id}`)}
          >
            <Navigation className="size-4" strokeWidth={2} />
            Track live delivery
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleDownload}
        >
          <Download className="size-4" strokeWidth={2} />
          Download receipt
        </Button>
        {canCancel && (
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive sm:col-span-2"
            onClick={() => setConfirmCancel(true)}
          >
            <X className="size-4" strokeWidth={2} />
            Cancel order
          </Button>
        )}
      </div>


      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" strokeWidth={2} />
          <h2 className="text-sm font-semibold">Items ({items.length})</h2>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items recorded.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-start gap-3 text-sm">
                <span className="min-w-[2rem] h-6 inline-flex items-center justify-center rounded-md bg-muted text-xs font-semibold">
                  {it.quantity}×
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{it.name_snapshot}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(it.unit_price_xaf).toLocaleString()} XAF each
                  </p>
                </div>
                <p className="font-semibold text-sm whitespace-nowrap">
                  {Number(it.total_xaf).toLocaleString()} XAF
                </p>
              </li>
            ))}
          </ul>
        )}
        <Separator />
        <div className="space-y-1.5 text-sm">
          <Row label="Subtotal" value={order.subtotal_xaf} />
          <Row label="Delivery fee" value={order.delivery_fee_xaf} />
          <Row label="Service fee" value={order.service_fee_xaf} />
          <Separator className="my-1.5" />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>{Number(order.total_xaf).toLocaleString()} XAF</span>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" strokeWidth={2} />
          <h2 className="text-sm font-semibold">Delivery</h2>
        </div>
        <p className="text-muted-foreground">{order.delivery_address}</p>
        {order.delivery_phone && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-3.5" strokeWidth={2} /> {order.delivery_phone}
          </p>
        )}
        {order.notes && (
          <p className="flex items-start gap-2 text-muted-foreground">
            <StickyNote className="size-3.5 mt-0.5 flex-shrink-0" strokeWidth={2} />
            <span>{order.notes}</span>
          </p>
        )}
      </Card>

      <Card className="p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" strokeWidth={2} />
          <h2 className="text-sm font-semibold">Timeline</h2>
        </div>
        <TimeRow label="Placed" iso={order.created_at} />
        <TimeRow label="Last updated" iso={order.updated_at} />
        {order.delivered_at && <TimeRow label="Delivered" iso={order.delivered_at} />}
      </Card>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              Order <span className="font-mono">{shortId}</span> will be cancelled. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? "Cancelling…" : "Cancel order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{Number(value).toLocaleString()} XAF</span>
    </div>
  );
}

function TimeRow({ label, iso }: { label: string; iso: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{format(new Date(iso), "MMM d, yyyy · HH:mm")}</span>
    </div>
  );
}
