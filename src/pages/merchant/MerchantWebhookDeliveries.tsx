// Merchant-scoped wrapper for webhook deliveries + replay
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { WebhookDeliveriesPanel } from "@/components/webhooks/WebhookDeliveriesPanel";

export default function MerchantWebhookDeliveries() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
        setMerchantId(m?.id ?? null);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhook deliveries</h1>
        <p className="text-muted-foreground">Inspect recent attempts and replay individual events.</p>
      </div>
      {merchantId && <WebhookDeliveriesPanel merchantId={merchantId} scope="merchant" />}
    </div>
  );
}
