import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, MapPin, Phone, Upload, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDailyNeedsCart, formatXAF } from "@/hooks/useDailyNeedsCart";

function uuidv4() {
  return ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c / 4)).toString(16),
  );
}

export default function DailyNeedsCheckout() {
  const navigate = useNavigate();
  const cart = useDailyNeedsCart();

  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [prescriptionUrl, setPrescriptionUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Prefill phone from profile
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("phone_number").eq("id", user.id).maybeSingle();
      if (data?.phone_number && !phone) setPhone(data.phone_number);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If cart drops to zero, bounce
  useEffect(() => {
    if (cart.items.length === 0 && !submitting) navigate("/app/daily-needs/cart", { replace: true });
  }, [cart.items.length, navigate, submitting]);

  const canSubmit =
    address.trim().length >= 3 &&
    phone.trim().length >= 7 &&
    cart.items.length > 0 &&
    cart.store_id &&
    (!cart.requiresPrescription || prescriptionUrl.startsWith("http"));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        toast.error("Please sign in to place an order");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("daily-needs-order-create", {
        body: {
          store_id: cart.store_id,
          items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          delivery_address: address.trim(),
          delivery_phone: phone.trim(),
          prescription_url: prescriptionUrl.trim() || undefined,
          notes: notes.trim() || undefined,
          idempotency_key: uuidv4(),
        },
      });

      if (error) throw error;
      const orderId = data?.order?.id;
      if (!orderId) throw new Error("Order ID missing");

      toast.success("Order placed", {
        icon: <CheckCircle2 className="size-4" />,
        description: `${formatXAF(cart.total)} held in wallet until delivery`,
      });
      cart.clear();
      navigate(`/app/daily-needs/orders/${orderId}`, { replace: true });
    } catch (e: any) {
      const ctxBody = e?.context?.body;
      let msg = e?.message || "Failed to place order";
      try {
        const parsed = typeof ctxBody === "string" ? JSON.parse(ctxBody) : ctxBody;
        if (parsed?.error) msg = String(parsed.error).replace(/_/g, " ");
      } catch { /* ignore */ }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-32 space-y-4 max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
        <h1 className="text-xl font-semibold">Checkout</h1>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2"><MapPin className="size-4" /> Delivery details</h2>
        <div className="space-y-1.5">
          <Label htmlFor="addr">Address</Label>
          <Textarea
            id="addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, neighborhood, landmarks…"
            rows={2}
            maxLength={500}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="flex items-center gap-1"><Phone className="size-3.5" /> Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+237…"
            inputMode="tel"
            maxLength={20}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes for the rider (optional)</Label>
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </div>
      </Card>

      {cart.requiresPrescription && (
        <Card className="p-4 space-y-3 border-amber-500/30 bg-amber-500/5">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Upload className="size-4" /> Prescription required
          </h2>
          <p className="text-xs text-muted-foreground">
            Paste the URL of a clear photo of your prescription. A pharmacist will review before dispatch.
          </p>
          <Input
            value={prescriptionUrl}
            onChange={(e) => setPrescriptionUrl(e.target.value)}
            placeholder="https://…"
            inputMode="url"
          />
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <h2 className="text-sm font-semibold">Order summary</h2>
        <ul className="space-y-1 text-sm">
          {cart.items.map((i) => (
            <li key={i.product_id} className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">{i.quantity}× {i.name}</span>
              <span className="tabular-nums shrink-0">{formatXAF(i.price_xaf * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t pt-2 space-y-1 text-sm">
          <Row label="Subtotal" value={formatXAF(cart.subtotal)} />
          <Row label="Delivery" value={formatXAF(cart.deliveryFee)} />
          <Row label="Service fee" value={formatXAF(cart.serviceFee)} />
          <div className="flex justify-between font-semibold pt-1">
            <span>Total</span>
            <span className="tabular-nums">{formatXAF(cart.total)}</span>
          </div>
        </div>
      </Card>

      <div className="flex gap-2 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0 mt-0.5" />
        <p>Funds are held in your wallet escrow and released to the store after delivery is confirmed.</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-background/95 backdrop-blur border-t px-4 py-3">
        <div className="max-w-md mx-auto">
          <Button
            className="w-full h-12 rounded-xl"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Placing order…</>
            ) : (
              <>Pay with Wallet · {formatXAF(cart.total)}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
