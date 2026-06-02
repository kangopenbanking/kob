import { useNavigate, useLocation } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useDailyNeedsCart, formatXAF } from "@/hooks/useDailyNeedsCart";

/**
 * Floating "View cart" bar shown on Daily Needs sub-pages while the cart has items.
 * Hidden on the cart and checkout pages themselves.
 */
export function CartFloatingBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { itemCount, subtotal, store_id } = useDailyNeedsCart();

  if (itemCount === 0) return null;
  if (pathname.endsWith("/cart") || pathname.endsWith("/checkout")) return null;
  if (!pathname.startsWith("/app/daily-needs") && !pathname.startsWith("/app/pharmacy")) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 px-4 pointer-events-none">
      <button
        type="button"
        onClick={() => navigate("/app/daily-needs/cart")}
        className="pointer-events-auto w-full max-w-md mx-auto flex items-center justify-between gap-3 rounded-2xl bg-primary text-primary-foreground shadow-lg px-4 h-12 hover:opacity-95 transition"
        aria-label={`View cart with ${itemCount} items`}
      >
        <span className="flex items-center gap-2 font-medium text-sm">
          <span className="relative inline-flex">
            <ShoppingBag className="size-5" />
            <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-background text-primary text-[10px] font-semibold flex items-center justify-center">
              {itemCount}
            </span>
          </span>
          View cart
        </span>
        <span className="text-sm font-semibold">{formatXAF(subtotal)}</span>
      </button>
    </div>
  );
}
