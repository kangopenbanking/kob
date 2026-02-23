import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Store } from "lucide-react";

export default function MerchantProfile() {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
    setMerchant(data);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!merchant) return <div className="text-center py-20 text-muted-foreground">No merchant account found</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Business Profile</h1><p className="text-muted-foreground">Your merchant business information</p></div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center"><Store className="h-6 w-6 text-primary" /></div>
            <CardTitle>{merchant.business_name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div><span className="text-sm text-muted-foreground">Business Type</span><p className="font-medium">{merchant.business_type || "-"}</p></div>
            <div><span className="text-sm text-muted-foreground">Contact Email</span><p className="font-medium">{merchant.contact_email || "-"}</p></div>
            <div><span className="text-sm text-muted-foreground">Contact Phone</span><p className="font-medium">{merchant.contact_phone || "-"}</p></div>
            <div><span className="text-sm text-muted-foreground">Country</span><p className="font-medium">{merchant.country || "-"}</p></div>
            <div><span className="text-sm text-muted-foreground">Default Currency</span><p className="font-medium">{merchant.default_currency || "XAF"}</p></div>
            <div><span className="text-sm text-muted-foreground">Environment</span><p className="font-medium">{merchant.environment || "sandbox"}</p></div>
            <div><span className="text-sm text-muted-foreground">Website</span><p className="font-medium">{merchant.website_url || "-"}</p></div>
            <div><span className="text-sm text-muted-foreground">Callback URL</span><p className="font-medium truncate">{merchant.callback_url || "-"}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
