import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, ArrowUpDown, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function MerchantDashboard() {
  const [merchant, setMerchant] = useState<any>(null);
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, txCount: 0, successRate: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: m } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
      setMerchant(m);

      if (m) {
        const { data: ch } = await supabase.from("gateway_charges").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false }).limit(10);
        setCharges(ch || []);

        const { data: allCh } = await supabase.from("gateway_charges").select("amount, status, currency").eq("merchant_id", m.id);
        if (allCh) {
          const total = allCh.filter(c => c.status === "successful").reduce((s, c) => s + Number(c.amount), 0);
          const success = allCh.filter(c => c.status === "successful").length;
          setStats({ totalRevenue: total, txCount: allCh.length, successRate: allCh.length > 0 ? Math.round((success / allCh.length) * 100) : 0 });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!merchant) {
    return (
      <div className="text-center py-20 space-y-4">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Merchant Account Found</h2>
        <p className="text-muted-foreground">Your merchant account has not been set up yet. Please contact your institution.</p>
      </div>
    );
  }

  const statusColor = (s: string) => {
    if (s === "active" || s === "verified") return "default";
    if (s === "submitted" || s === "under_review") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{merchant.business_name || "Merchant Dashboard"}</h1>
        <p className="text-muted-foreground">Welcome to your merchant portal</p>
      </div>

      {merchant.kyb_status !== "verified" && merchant.kyb_status !== "active" && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium">KYB Verification: <Badge variant={statusColor(merchant.kyb_status)}>{merchant.kyb_status?.toUpperCase()}</Badge></p>
              <p className="text-sm text-muted-foreground">Complete your KYB to start accepting payments.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} {merchant.default_currency || "XAF"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.txCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest 10 charges</CardDescription>
        </CardHeader>
        <CardContent>
          {charges.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 px-3">Reference</th><th className="text-left py-2 px-3">Amount</th><th className="text-left py-2 px-3">Status</th><th className="text-left py-2 px-3">Channel</th><th className="text-left py-2 px-3">Date</th></tr></thead>
                <tbody>
                  {charges.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-mono text-xs">{c.charge_ref?.slice(0, 16)}</td>
                      <td className="py-2 px-3">{Number(c.amount).toLocaleString()} {c.currency}</td>
                      <td className="py-2 px-3"><Badge variant={c.status === "successful" ? "default" : "secondary"}>{c.status}</Badge></td>
                      <td className="py-2 px-3">{c.channel}</td>
                      <td className="py-2 px-3">{c.created_at ? format(new Date(c.created_at), "MMM d, HH:mm") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
