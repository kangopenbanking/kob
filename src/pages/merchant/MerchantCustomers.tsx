import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function MerchantCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_customers").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setCustomers(data || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Customers</h1><p className="text-muted-foreground">Tokenized customers and their payment history</p></div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-4">Email</th><th className="text-left py-3 px-4">Name</th><th className="text-left py-3 px-4">Phone</th><th className="text-left py-3 px-4">Created</th></tr></thead>
              <tbody>
                {customers.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No customers yet</td></tr> : customers.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-4">{c.email || "-"}</td>
                    <td className="py-3 px-4">{c.name || "-"}</td>
                    <td className="py-3 px-4">{c.phone || "-"}</td>
                    <td className="py-3 px-4">{c.created_at ? format(new Date(c.created_at), "MMM d, yyyy") : "-"}</td>
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
