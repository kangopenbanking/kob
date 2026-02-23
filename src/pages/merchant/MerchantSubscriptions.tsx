import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function MerchantSubscriptions() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data: s } = await supabase.from("gateway_subscriptions").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setSubs(s || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Subscriptions</h1><p className="text-muted-foreground">Manage plans and active subscribers</p></div>
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Active Subscriptions ({subs.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left py-2 px-3">Customer</th><th className="text-left py-2 px-3">Status</th><th className="text-left py-2 px-3">Next Charge</th><th className="text-left py-2 px-3">Created</th></tr></thead>
              <tbody>
                {subs.length === 0 ? <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No subscriptions yet</td></tr> : subs.map(s => (
                  <tr key={s.id} className="border-b last:border-0"><td className="py-2 px-3">{s.customer_email || s.customer_id}</td><td className="py-2 px-3"><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></td><td className="py-2 px-3">{s.next_charge_date ? format(new Date(s.next_charge_date), "MMM d, yyyy") : "-"}</td><td className="py-2 px-3">{s.created_at ? format(new Date(s.created_at), "MMM d, yyyy") : "-"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
