import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function MerchantPayouts() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_payouts").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setPayouts(data || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Payouts</h1><p className="text-muted-foreground">View payout history</p></div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-4">Reference</th><th className="text-left py-3 px-4">Amount</th><th className="text-left py-3 px-4">Status</th><th className="text-left py-3 px-4">Destination</th><th className="text-left py-3 px-4">Date</th></tr></thead>
              <tbody>
                {payouts.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No payouts yet</td></tr> : payouts.map(p => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-4 font-mono text-xs">{p.payout_ref}</td>
                    <td className="py-3 px-4">{Number(p.amount).toLocaleString()} {p.currency}</td>
                    <td className="py-3 px-4"><Badge variant={p.status === "completed" ? "default" : "secondary"}>{p.status}</Badge></td>
                    <td className="py-3 px-4">{p.destination_type}</td>
                    <td className="py-3 px-4">{p.created_at ? format(new Date(p.created_at), "MMM d, yyyy") : "-"}</td>
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
