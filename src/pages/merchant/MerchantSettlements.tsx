import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function MerchantSettlements() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_settlements").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setSettlements(data || []);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Settlements</h1><p className="text-muted-foreground">Settlement batches and breakdowns</p></div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-4">Reference</th><th className="text-left py-3 px-4">Gross</th><th className="text-left py-3 px-4">Fees</th><th className="text-left py-3 px-4">Net</th><th className="text-left py-3 px-4">Status</th><th className="text-left py-3 px-4">Period</th></tr></thead>
              <tbody>
                {settlements.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No settlements yet</td></tr> : settlements.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-4 font-mono text-xs">{s.settlement_ref}</td>
                    <td className="py-3 px-4">{Number(s.gross_amount || 0).toLocaleString()} {s.currency}</td>
                    <td className="py-3 px-4">{Number(s.total_fees || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 font-medium">{Number(s.net_amount || 0).toLocaleString()}</td>
                    <td className="py-3 px-4"><Badge variant={s.status === "settled" ? "default" : "secondary"}>{s.status}</Badge></td>
                    <td className="py-3 px-4">{s.period_start ? format(new Date(s.period_start), "MMM d") : "-"} – {s.period_end ? format(new Date(s.period_end), "MMM d") : "-"}</td>
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
