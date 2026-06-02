import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const BusinessOrders = lazy(() => import("@/pages/business-app/BusinessOrders"));

/**
 * Merchant Portal alias for the Business app Orders page so merchants
 * managing orders from the /merchant dashboard get the same workflow
 * available in /biz/orders without duplicating logic.
 */
export default function MerchantOrders() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Orders</h1>
        <p className="text-muted-foreground text-sm">Manage and fulfill customer orders</p>
      </div>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <BusinessOrders />
      </Suspense>
    </div>
  );
}
