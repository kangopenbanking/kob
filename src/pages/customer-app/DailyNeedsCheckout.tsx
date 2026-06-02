import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DailyNeedsCheckout() {
  const navigate = useNavigate();
  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft /></Button>
        <h1 className="text-xl font-semibold">Checkout</h1>
      </div>
      <Card className="p-4 space-y-3">
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>—</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery</span><span>—</span></div>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Service fee</span><span>—</span></div>
        <div className="flex justify-between font-semibold pt-3 border-t"><span>Total</span><span>—</span></div>
      </Card>
      <Button className="w-full h-12 rounded-xl" disabled>Pay with Wallet</Button>
      <p className="text-xs text-center text-muted-foreground">Full checkout wires in Phase 6 (wallet escrow).</p>
    </div>
  );
}
