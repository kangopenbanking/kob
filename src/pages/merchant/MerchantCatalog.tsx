import { lazy, Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const BusinessProducts = lazy(() => import("@/pages/business-app/BusinessProducts"));
const BusinessInventory = lazy(() => import("@/pages/business-app/BusinessInventory"));

/**
 * Merchant Portal Catalog — tabs combining Products and Inventory from the
 * Business app so merchants don't have to leave the /merchant portal to
 * manage stock or product listings.
 */
export default function MerchantCatalog() {
  const [tab, setTab] = useState("products");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Catalog</h1>
        <p className="text-muted-foreground text-sm">Manage products, variants and stock levels</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4">
          <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <BusinessProducts />
          </Suspense>
        </TabsContent>
        <TabsContent value="inventory" className="mt-4">
          <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <BusinessInventory />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
