import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DailyNeedsCart() {
  const navigate = useNavigate();
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
