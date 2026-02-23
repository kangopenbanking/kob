import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Download, Search, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

export default function MerchantTransactions() {
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data } = await supabase.from("gateway_charges").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false }).limit(200);
      setCharges(data || []);
    }
    setLoading(false);
  };

  const filtered = charges.filter(c => {
    if (search && !(c.charge_ref?.toLowerCase().includes(search.toLowerCase()) || c.customer_email?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (channelFilter !== "all" && c.channel !== channelFilter) return false;
    return true;
  });

  const channels = [...new Set(charges.map(c => c.channel).filter(Boolean))];
  const statuses = [...new Set(charges.map(c => c.status).filter(Boolean))];

  const totalFiltered = filtered.reduce((s, c) => s + Number(c.amount || 0), 0);
  const successfulFiltered = filtered.filter(c => c.status === "successful");
  const successfulTotal = successfulFiltered.reduce((s, c) => s + Number(c.amount || 0), 0);

  const exportCSV = () => {
    const headers = ["Reference", "Amount", "Currency", "Status", "Channel", "Customer Email", "Date"];
    const rows = filtered.map(c => [c.charge_ref, c.amount, c.currency, c.status, c.channel, c.customer_email || "", c.created_at]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Transactions</h1><p className="text-muted-foreground">{filtered.length} transactions · {successfulTotal.toLocaleString()} {charges[0]?.currency || "XAF"} successful</p></div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" />Export CSV</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by reference or email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {channels.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4">Reference</th>
                <th className="text-left py-3 px-4">Amount</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Channel</th>
                <th className="text-left py-3 px-4">Customer</th>
                <th className="text-left py-3 px-4">Date</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No transactions found</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-4 font-mono text-xs">{c.charge_ref}</td>
                    <td className="py-3 px-4 font-medium">{Number(c.amount).toLocaleString()} {c.currency}</td>
                    <td className="py-3 px-4"><Badge variant={c.status === "successful" ? "default" : c.status === "failed" ? "destructive" : "secondary"}>{c.status}</Badge></td>
                    <td className="py-3 px-4">{c.channel || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.customer_email || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{c.created_at ? format(new Date(c.created_at), "MMM d, yyyy HH:mm") : "—"}</td>
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
