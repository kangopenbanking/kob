import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingCart, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuantityStepper } from "@/components/daily-needs/QuantityStepper";
import { useDailyNeedsCart, formatXAF } from "@/hooks/useDailyNeedsCart";
import { SafeImage } from "@/components/common/SafeImage";

export default function DailyNeedsCart() {
  const navigate = useNavigate();
  const cart = useDailyNeedsCart();

  if (cart.items.length === 0) {
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
          <h1 className="text-xl font-semibold">Your cart</h1>
        </div>
        <div className="py-16 flex flex-col items-center text-muted-foreground gap-3">
          <ShoppingCart className="size-10" />
          <p>Your cart is empty.</p>
          <Button variant="outline" onClick={() => navigate("/app/daily-needs")}>Browse Daily Needs</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-32 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Your cart</h1>
            {cart.store_name && (
              <p className="text-xs text-muted-foreground">From {cart.store_name}</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={cart.clear}
          aria-label="Clear cart"
        >
          <Trash2 className="size-4 mr-1" /> Clear
        </Button>
      </div>

      <div className="space-y-2">
        {cart.items.map((item) => (
          <Card key={item.product_id} className="p-3 flex items-center gap-3">
            <div className="size-14 rounded-lg bg-muted overflow-hidden shrink-0">
              {item.image_url && <SafeImage src={item.image_url} alt={item.name} className="size-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">{formatXAF(item.price_xaf)} each</p>
              {item.requires_prescription && (
                <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5">Prescription required</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="text-sm font-semibold tabular-nums">
                {formatXAF(item.price_xaf * item.quantity)}
              </span>
              <QuantityStepper
                value={item.quantity}
                size="sm"
                onChange={(n) => cart.updateQuantity(item.product_id, n)}
                ariaLabel={`Quantity of ${item.name}`}
              />
            </div>
          </Card>
        ))}
      </div>

      {cart.requiresPrescription && (
        <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
          <Info className="size-4 shrink-0 mt-0.5" />
          <p>One or more items require a valid prescription. You'll be asked to upload it at checkout.</p>
        </div>
      )}

      <Card className="p-4 space-y-2">
        <Row label="Subtotal" value={formatXAF(cart.subtotal)} />
        <Row label="Delivery" value={formatXAF(cart.deliveryFee)} />
        <Row label="Service fee" value={formatXAF(cart.serviceFee)} muted />
        <div className="border-t pt-2 mt-2 flex justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatXAF(cart.total)}</span>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-background/95 backdrop-blur border-t px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="text-sm">
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="font-semibold tabular-nums">{formatXAF(cart.total)}</p>
          </div>
          <Button className="flex-1 h-12 rounded-xl" onClick={() => navigate("/app/daily-needs/checkout")}>
            Checkout
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${muted ? "text-muted-foreground" : ""}`}>
      <span className={muted ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
