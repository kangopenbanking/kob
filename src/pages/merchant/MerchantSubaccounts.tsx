import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function MerchantSubaccounts() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_subaccounts").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setSubs(data || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Subaccounts</h1><p className="text-muted-foreground">Manage split-payment subaccounts</p></div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-4">Name</th><th className="text-left py-3 px-4">Split Type</th><th className="text-left py-3 px-4">Split Value</th><th className="text-left py-3 px-4">Status</th></tr></thead>
              <tbody>
                {subs.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No subaccounts yet</td></tr> : subs.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-4 font-medium">{s.business_name || s.subaccount_id}</td>
                    <td className="py-3 px-4">{s.split_type}</td>
                    <td className="py-3 px-4">{s.split_value}{s.split_type === "percentage" ? "%" : ""}</td>
                    <td className="py-3 px-4"><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
