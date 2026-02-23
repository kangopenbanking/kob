import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Webhook } from "lucide-react";
import { format } from "date-fns";

export default function MerchantWebhooks() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_merchant_webhooks").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setWebhooks(data || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Webhooks</h1><p className="text-muted-foreground">Configure webhook endpoints and view delivery logs</p></div>
      {webhooks.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No webhooks configured yet</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {webhooks.map(w => (
            <Card key={w.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base truncate max-w-md">{w.url}</CardTitle>
                  </div>
                  <Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Active" : "Inactive"}</Badge>
                </div>
                <CardDescription>Events: {Array.isArray(w.events) ? w.events.join(", ") : "All"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">Created {w.created_at ? format(new Date(w.created_at), "MMM d, yyyy") : "—"}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
